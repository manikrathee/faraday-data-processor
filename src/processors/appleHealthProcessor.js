const fs = require('fs-extra');
const xml2js = require('xml2js');
const BaseProcessor = require('./baseProcessor');

/**
 * Processor for Apple Health XML exports
 * Handles large XML files with streaming and comprehensive health data
 */
class AppleHealthProcessor extends BaseProcessor {
  constructor() {
    super('apple_health', 'mixed');
    this.parser = new xml2js.Parser({ 
      trim: true, 
      explicitArray: false,
      mergeAttrs: true 
    });
    
    // Map Apple Health types to our data types
    this.typeMapping = {
      // Fitness metrics
      'HKQuantityTypeIdentifierStepCount': 'fitness',
      'HKQuantityTypeIdentifierDistanceWalkingRunning': 'fitness',
      'HKQuantityTypeIdentifierActiveEnergyBurned': 'fitness',
      'HKQuantityTypeIdentifierBasalEnergyBurned': 'fitness',
      'HKQuantityTypeIdentifierFlightsClimbed': 'fitness',
      
      // Health metrics
      'HKQuantityTypeIdentifierHeartRate': 'health',
      'HKQuantityTypeIdentifierRestingHeartRate': 'health',
      'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': 'health',
      'HKQuantityTypeIdentifierBloodPressureSystolic': 'health',
      'HKQuantityTypeIdentifierBloodPressureDiastolic': 'health',
      'HKQuantityTypeIdentifierBloodGlucose': 'health',
      'HKQuantityTypeIdentifierBodyMass': 'health',
      'HKQuantityTypeIdentifierHeight': 'health',
      'HKQuantityTypeIdentifierBodyMassIndex': 'health',
      'HKQuantityTypeIdentifierOxygenSaturation': 'health',
      'HKQuantityTypeIdentifierBodyTemperature': 'health',
      
      // Sleep
      'HKCategoryTypeIdentifierSleepAnalysis': 'sleep',
      
      // Workouts
      'HKWorkoutTypeIdentifier': 'fitness'
    };
    
    this.unitMapping = {
      'count': 'steps',
      'mi': 'miles',
      'km': 'kilometers', 
      'Cal': 'calories',
      'kcal': 'calories',
      'count/min': 'bpm',
      'ms': 'milliseconds',
      'mmHg': 'mmHg',
      'mg/dL': 'mg/dL',
      'lb': 'pounds',
      'kg': 'kilograms',
      'in': 'inches',
      'cm': 'centimeters',
      '%': 'percent',
      'degF': 'fahrenheit',
      'degC': 'celsius'
    };
  }

  /**
   * Process Apple Health XML file with streaming for large files
   * @param {string} filePath - Path to export.xml file
   * @returns {Promise<Object[]>} Array of processed records
   */
  async processFile(filePath) {
    const stats = await fs.stat(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    console.log(`Processing Apple Health export: ${fileSizeMB.toFixed(1)}MB`);
    
    // For large files (>50MB), use streaming approach
    if (fileSizeMB > 50) {
      return await this.processLargeXmlFile(filePath);
    } else {
      return await this.processSmallXmlFile(filePath);
    }
  }

  /**
   * Process smaller XML files by loading entirely into memory
   * @param {string} filePath - Path to XML file
   * @returns {Promise<Object[]>} Array of processed records
   */
  async processSmallXmlFile(filePath) {
    const content = await this.fileProcessor.readFileAuto(filePath);
    const data = await this.parser.parseStringPromise(content);
    
    const records = [];
    
    if (data.HealthData) {
      // Process Record elements
      if (data.HealthData.Record) {
        const recordArray = Array.isArray(data.HealthData.Record) 
          ? data.HealthData.Record 
          : [data.HealthData.Record];
          
        for (const record of recordArray) {
          const processed = this.processHealthRecord(record);
          if (processed && this.validateRecord(processed)) {
            records.push(processed);
          }
        }
      }
      
      // Process Workout elements
      if (data.HealthData.Workout) {
        const workoutArray = Array.isArray(data.HealthData.Workout)
          ? data.HealthData.Workout
          : [data.HealthData.Workout];
          
        for (const workout of workoutArray) {
          const processed = this.processWorkoutRecord(workout);
          if (processed && this.validateRecord(processed)) {
            records.push(processed);
          }
        }
      }
    }
    
    return records;
  }

  /**
   * Process large XML files with streaming (simplified approach)
   * @param {string} filePath - Path to XML file  
   * @returns {Promise<Object[]>} Array of processed records
   */
  async processLargeXmlFile(filePath) {
    console.log('Large file processing - implementing simplified record extraction');
    
    // For very large files, we'll read in chunks and extract records
    const records = [];
    let buffer = '';
    let recordCount = 0;
    const maxRecords = 10000; // Limit for performance
    
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
      
      stream.on('data', (chunk) => {
        buffer += chunk;
        
        // Extract complete Record elements
        let recordMatch;
        const recordRegex = /<Record[^>]*>.*?<\/Record>/g;
        
        while ((recordMatch = recordRegex.exec(buffer)) !== null && recordCount < maxRecords) {
          try {
            const recordXml = recordMatch[0];
            this.parseRecordFromXml(recordXml).then(record => {
              if (record && this.validateRecord(record)) {
                records.push(record);
              }
            });
            recordCount++;
          } catch (error) {
            this.logError('Error parsing XML record', error.message);
          }
        }
        
        // Keep only the unprocessed part of buffer
        const lastRecordEnd = buffer.lastIndexOf('</Record>');
        if (lastRecordEnd > -1) {
          buffer = buffer.substring(lastRecordEnd + 9);
        }
        
        if (recordCount >= maxRecords) {
          console.log(`Limiting to ${maxRecords} records for performance`);
          stream.destroy();
        }
      });
      
      stream.on('end', () => {
        console.log(`Extracted ${records.length} records from large Apple Health file`);
        resolve(records);
      });
      
      stream.on('error', reject);
    });
  }

  /**
   * Parse a single record from XML string
   * @param {string} xmlString - XML string for one record
   * @returns {Promise<Object|null>} Processed record or null
   */
  async parseRecordFromXml(xmlString) {
    try {
      const data = await this.parser.parseStringPromise(xmlString);
      return this.processHealthRecord(data.Record);
    } catch (error) {
      this.logError('Failed to parse XML record', error.message);
      return null;
    }
  }

  /**
   * Process a health record from Apple Health
   * @param {Object} record - Record object from XML
   * @returns {Object|null} Processed record
   */
  processHealthRecord(record) {
    if (!record || !record.type) return null;
    
    const recordType = record.type;
    const dataType = this.typeMapping[recordType] || 'unknown';
    
    if (dataType === 'unknown') {
      // Skip unknown types to avoid noise
      return null;
    }
    
    // Create base record
    const timestamp = record.startDate || record.creationDate;
    if (!timestamp) return null;
    
    const processedRecord = this.createBaseRecord(record, timestamp, this.getSubType(recordType));
    processedRecord.dataType = dataType;
    
    // Add common fields
    processedRecord.device_name = record.sourceName || 'Unknown';
    processedRecord.source_version = record.sourceVersion;
    
    // Process value and unit
    if (record.value !== undefined) {
      const value = parseFloat(record.value);
      const unit = this.unitMapping[record.unit] || record.unit;
      
      // Map to specific metric based on type
      const metricValue = this.createMetricValue(value, unit, this.getConfidenceScore(record));
      
      switch (recordType) {
        case 'HKQuantityTypeIdentifierStepCount':
          processedRecord.steps = metricValue;
          break;
        case 'HKQuantityTypeIdentifierDistanceWalkingRunning':
          processedRecord.distance = metricValue;
          break;
        case 'HKQuantityTypeIdentifierActiveEnergyBurned':
          processedRecord.calories = metricValue;
          break;
        case 'HKQuantityTypeIdentifierHeartRate':
          processedRecord.heart_rate = metricValue;
          break;
        case 'HKQuantityTypeIdentifierRestingHeartRate':
          processedRecord.resting_heart_rate = metricValue;
          break;
        case 'HKQuantityTypeIdentifierBloodPressureSystolic':
          processedRecord.blood_pressure = { systolic: metricValue };
          break;
        case 'HKQuantityTypeIdentifierBloodPressureDiastolic':
          processedRecord.blood_pressure = { diastolic: metricValue };
          break;
        case 'HKQuantityTypeIdentifierBodyMass':
          processedRecord.weight = metricValue;
          break;
        default:
          processedRecord.metric_value = metricValue;
      }
    }
    
    // Add time range if different from timestamp
    if (record.endDate && record.endDate !== record.startDate) {
      processedRecord.end_time = this.dateNormalizer.normalize(record.endDate);
      processedRecord.duration = this.createMetricValue(
        this.dateNormalizer.calculateDuration(record.startDate, record.endDate),
        'minutes',
        0.9
      );
    }
    
    return processedRecord;
  }

  /**
   * Process a workout record from Apple Health
   * @param {Object} workout - Workout object from XML
   * @returns {Object|null} Processed record
   */
  processWorkoutRecord(workout) {
    if (!workout) return null;
    
    const timestamp = workout.startDate;
    if (!timestamp) return null;
    
    const record = this.createBaseRecord(workout, timestamp, 'workout');
    record.dataType = 'fitness';
    
    // Workout details
    record.workout_type = workout.workoutActivityType || 'Unknown';
    record.start_time = this.dateNormalizer.normalize(workout.startDate);
    record.end_time = this.dateNormalizer.normalize(workout.endDate);
    
    // Duration
    if (workout.duration) {
      record.duration = this.createMetricValue(
        parseFloat(workout.duration), 
        workout.durationUnit || 'minutes',
        0.9
      );
    } else if (workout.startDate && workout.endDate) {
      const durationMinutes = this.dateNormalizer.calculateDuration(workout.startDate, workout.endDate);
      record.duration = this.createMetricValue(durationMinutes, 'minutes', 0.9);
    }
    
    // Energy burned
    if (workout.totalEnergyBurned) {
      record.calories = this.createMetricValue(
        parseFloat(workout.totalEnergyBurned),
        workout.totalEnergyBurnedUnit || 'calories',
        0.8
      );
    }
    
    // Distance
    if (workout.totalDistance) {
      record.distance = this.createMetricValue(
        parseFloat(workout.totalDistance),
        workout.totalDistanceUnit || 'miles',
        0.8
      );
    }
    
    return record;
  }

  /**
   * Get subtype from Apple Health record type
   * @param {string} recordType - Apple Health record type
   * @returns {string} Subtype
   */
  getSubType(recordType) {
    const typeMap = {
      'HKQuantityTypeIdentifierStepCount': 'steps',
      'HKQuantityTypeIdentifierHeartRate': 'heart_rate',
      'HKQuantityTypeIdentifierDistanceWalkingRunning': 'distance',
      'HKQuantityTypeIdentifierActiveEnergyBurned': 'calories',
      'HKQuantityTypeIdentifierBloodPressureSystolic': 'blood_pressure',
      'HKQuantityTypeIdentifierBloodPressureDiastolic': 'blood_pressure',
      'HKCategoryTypeIdentifierSleepAnalysis': 'sleep_analysis'
    };
    
    return typeMap[recordType] || recordType.replace('HKQuantityTypeIdentifier', '').toLowerCase();
  }

  /**
   * Get confidence score based on record attributes
   * @param {Object} record - Health record
   * @returns {number} Confidence score 0-1
   */
  getConfidenceScore(record) {
    // Higher confidence for Apple devices and recent data
    let confidence = 0.7;
    
    if (record.sourceName) {
      if (record.sourceName.includes('Apple Watch') || record.sourceName.includes('iPhone')) {
        confidence = 0.9;
      } else if (record.sourceName.includes('Health')) {
        confidence = 0.8;
      }
    }
    
    return confidence;
  }

  /**
   * Find Apple Health export files
   * @param {string} basePath - Base path to data
   * @returns {Promise<string[]>} Array of export.xml file paths
   */
  async getAppleHealthFiles(basePath) {
    const files = [];
    
    // Look for apple_health_export_* directories
    const items = await fs.readdir(basePath, { withFileTypes: true });
    
    for (const item of items) {
      if (item.isDirectory() && item.name.includes('apple_health_export')) {
        const exportFile = `${basePath}/${item.name}/export.xml`;
        if (await fs.pathExists(exportFile)) {
          files.push(exportFile);
        }
      }
    }
    
    return files;
  }
}

module.exports = AppleHealthProcessor;