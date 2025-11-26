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
      'HKQuantityTypeIdentifierAppleExerciseTime': 'fitness',
      'HKQuantityTypeIdentifierAppleStandTime': 'fitness',
      
      // Health metrics
      'HKQuantityTypeIdentifierHeartRate': 'health',
      'HKQuantityTypeIdentifierRestingHeartRate': 'health',
      'HKQuantityTypeIdentifierWalkingHeartRateAverage': 'health',
      'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': 'health',
      'HKQuantityTypeIdentifierBloodPressureSystolic': 'health',
      'HKQuantityTypeIdentifierBloodPressureDiastolic': 'health',
      'HKQuantityTypeIdentifierBloodGlucose': 'health',
      'HKQuantityTypeIdentifierBodyMass': 'health',
      'HKQuantityTypeIdentifierHeight': 'health',
      'HKQuantityTypeIdentifierBodyMassIndex': 'health',
      'HKQuantityTypeIdentifierBodyFatPercentage': 'health',
      'HKQuantityTypeIdentifierLeanBodyMass': 'health',
      'HKQuantityTypeIdentifierOxygenSaturation': 'health',
      'HKQuantityTypeIdentifierBodyTemperature': 'health',
      'HKQuantityTypeIdentifierRespiratoryRate': 'health',
      'HKQuantityTypeIdentifierVO2Max': 'health',
      'HKQuantityTypeIdentifierBloodAlcoholContent': 'health',
      'HKQuantityTypeIdentifierDietaryWater': 'health',
      'HKQuantityTypeIdentifierDietaryEnergyConsumed': 'health',
      'HKQuantityTypeIdentifierDietaryCarbohydrates': 'health',
      'HKQuantityTypeIdentifierDietaryProtein': 'health',
      'HKQuantityTypeIdentifierDietaryFatTotal': 'health',
      'HKQuantityTypeIdentifierDietaryFiber': 'health',
      'HKQuantityTypeIdentifierDietarySugar': 'health',
      'HKQuantityTypeIdentifierDietarySodium': 'health',
      'HKQuantityTypeIdentifierEnvironmentalAudioExposure': 'health',
      'HKQuantityTypeIdentifierPhysicalEffort': 'fitness',
      
      // Sleep
      'HKCategoryTypeIdentifierSleepAnalysis': 'sleep',
      
      // Workouts
      'HKWorkoutTypeIdentifier': 'fitness',
      
      // Additional categories that may exist
      'HKCategoryTypeIdentifierAppleStandHour': 'fitness',
      'HKCategoryTypeIdentifierMindfulSession': 'health'
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
   * Process large XML files with streaming (optimized approach)
   * @param {string} filePath - Path to XML file  
   * @returns {Promise<Object[]>} Array of processed records
   */
  async processLargeXmlFile(filePath) {
    console.log('Large file processing - implementing optimized record extraction with sampling');
    
    const records = [];
    let buffer = '';
    let recordCount = 0;
    let totalRecordsFound = 0;
    const maxRecords = 50000; // Target records to process  
    const chunkSize = 1024 * 1024; // 1MB chunks
    const sampleRate = 10; // Process every 10th record to get better distribution
    
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, { 
        encoding: 'utf8',
        highWaterMark: chunkSize 
      });
      
      stream.on('data', async (chunk) => {
        buffer += chunk;
        
        // Process complete records synchronously to avoid async issues
        const recordMatches = [];
        const recordRegex = /<Record[^>]*\/>/g; // Self-closing records first
        let match;
        
        // Extract self-closing Record elements with sampling
        while ((match = recordRegex.exec(buffer)) !== null && recordCount < maxRecords) {
          totalRecordsFound++;
          if (totalRecordsFound % sampleRate === 0) {
            recordMatches.push({ xml: match[0], index: match.index });
            recordCount++;
          }
        }
        
        // Extract paired Record elements with sampling
        const pairedRegex = /<Record[^>]*>.*?<\/Record>/g;
        while ((match = pairedRegex.exec(buffer)) !== null && recordCount < maxRecords) {
          totalRecordsFound++;
          if (totalRecordsFound % sampleRate === 0) {
            recordMatches.push({ xml: match[0], index: match.index });
            recordCount++;
          }
        }
        
        // Process records synchronously
        for (const recordMatch of recordMatches) {
          try {
            const record = await this.parseRecordFromXmlSync(recordMatch.xml);
            if (record && this.validateRecord(record)) {
              records.push(record);
            }
          } catch (error) {
            // Skip invalid records silently for performance
          }
        }
        
        // More aggressive buffer management
        if (recordMatches.length > 0) {
          const lastIndex = Math.max(...recordMatches.map(m => m.index + m.xml.length));
          buffer = buffer.substring(lastIndex);
        } else if (buffer.length > chunkSize * 2) {
          // Prevent buffer from growing too large
          buffer = buffer.substring(chunkSize);
        }
        
        if (recordCount >= maxRecords) {
          console.log(`Reached ${maxRecords} record limit for performance`);
          stream.destroy();
          resolve(records);
        }
      });
      
      stream.on('end', () => {
        console.log(`Sampled ${records.length} records from ${totalRecordsFound} total records in Apple Health file`);
        resolve(records);
      });
      
      stream.on('error', reject);
    });
  }

  /**
   * Parse a single record from XML string synchronously
   * @param {string} xmlString - XML string for one record
   * @returns {Object|null} Processed record or null
   */
  parseRecordFromXmlSync(xmlString) {
    try {
      // Extract attributes directly from XML string for performance
      const attributes = {};
      const attrRegex = /(\w+)="([^"]*)"/g;
      let attrMatch;
      
      while ((attrMatch = attrRegex.exec(xmlString)) !== null) {
        attributes[attrMatch[1]] = attrMatch[2];
      }
      
      return this.processHealthRecord(attributes);
    } catch (error) {
      return null;
    }
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
    
    // Track data type distribution
    if (!this.typeCount) this.typeCount = {};
    if (!this.typeCount[dataType]) this.typeCount[dataType] = 0;
    this.typeCount[dataType]++;
    
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