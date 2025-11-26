const csv = require('csv-parser');
const fs = require('fs');
const BaseProcessor = require('./baseProcessor');

/**
 * Processor for Gyroscope app CSV exports
 * Handles multiple data types: steps, sleep, workouts, etc.
 */
class GyroscopeProcessor extends BaseProcessor {
  constructor() {
    super('gyroscope', 'mixed');
    
    // Map Gyroscope file types to our data types
    this.fileTypeMapping = {
      'steps': 'fitness',
      'running': 'fitness',
      'cycling': 'fitness', 
      'workouts': 'fitness',
      'sleep': 'sleep',
      'bp': 'health',
      'glucose': 'health',
      'hrv': 'health',
      'rhr': 'health',
      'mood': 'health',
      'meditation': 'health',
      'symptoms': 'health',
      'injuries': 'health',
      'ketones': 'health',
      'gvisits': 'location',
      'photos': 'media'
    };
  }

  /**
   * Determine data type from filename
   * @param {string} filePath - File path
   * @returns {string} Data type
   */
  getDataTypeFromFilename(filePath) {
    const filename = filePath.split('/').pop();
    const match = filename.match(/gyroscope-\w+-(\w+)-export\.csv/);
    
    if (match) {
      const fileType = match[1];
      return this.fileTypeMapping[fileType] || 'unknown';
    }
    
    return 'unknown';
  }

  /**
   * Get subtype from filename
   * @param {string} filePath - File path
   * @returns {string} Subtype
   */
  getSubTypeFromFilename(filePath) {
    const filename = filePath.split('/').pop();
    const match = filename.match(/gyroscope-\w+-(\w+)-export\.csv/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Process steps data
   * @param {Object} row - CSV row
   * @param {string} subType - Data subtype
   * @returns {Object} Processed record
   */
  processStepsRecord(row, subType) {
    const timestamp = this.extractTimestamp(row);
    const record = this.createBaseRecord(row, timestamp, subType);
    record.dataType = 'fitness';
    
    record.steps = this.createMetricValue(
      parseInt(row.steps) || 0,
      'steps',
      row.service === 'healthkit' ? 0.9 : 0.7
    );
    
    record.measurement_source = row.service;
    
    return record;
  }

  /**
   * Process sleep data
   * @param {Object} row - CSV row
   * @param {string} subType - Data subtype
   * @returns {Object} Processed record
   */
  processSleepRecord(row, subType) {
    const timestamp = this.extractTimestamp(row) || row.start_time;
    const record = this.createBaseRecord(row, timestamp, subType);
    record.dataType = 'sleep';
    
    // Parse start and end times
    record.sleep_start = this.dateNormalizer.normalize(row.start_time);
    record.sleep_end = this.dateNormalizer.normalize(row.end_time);
    
    // Calculate duration
    const durationMinutes = this.dateNormalizer.calculateDuration(row.start_time, row.end_time);
    record.sleep_duration = this.createMetricValue(durationMinutes, 'minutes', 0.8);
    
    record.measurement_source = row.service;
    
    return record;
  }

  /**
   * Process workout data
   * @param {Object} row - CSV row
   * @param {string} subType - Data subtype
   * @returns {Object} Processed record
   */
  processWorkoutRecord(row, subType) {
    const timestamp = this.extractTimestamp(row) || row.start_time;
    const record = this.createBaseRecord(row, timestamp, subType);
    record.dataType = 'fitness';
    
    record.workout_id = row.id;
    record.start_time = this.dateNormalizer.normalize(row.start_time);
    record.end_time = this.dateNormalizer.normalize(row.end_time);
    record.workout_type = row.type || 'unknown';
    record.workout_name = row.name || '';
    
    // Duration
    const durationMinutes = this.dateNormalizer.calculateDuration(row.start_time, row.end_time);
    record.duration = this.createMetricValue(durationMinutes, 'minutes', 0.8);
    
    // Calories
    if (row.calories) {
      record.calories = this.createMetricValue(parseFloat(row.calories), 'calories', 0.7);
    }
    
    record.measurement_source = row.service;
    
    return record;
  }

  /**
   * Extract timestamp from CSV row with field name variations
   * @param {Object} row - CSV row
   * @returns {string} Timestamp string
   */
  extractTimestamp(row) {
    // Try common timestamp field names
    const timestampFields = [
      'timestamp', 'date', 'time', 'Time',   // Standard fields (including capital Time)
      'Start Time', 'start_time',            // Gyroscope location visits
      'End Time', 'end_time'                 // Alternative for some records
    ];
    
    for (const field of timestampFields) {
      if (row[field] && row[field].trim()) {
        return row[field];
      }
    }
    
    return null;
  }

  /**
   * Process health metric data (BP, glucose, HRV, etc.)
   * @param {Object} row - CSV row
   * @param {string} subType - Data subtype
   * @returns {Object} Processed record
   */
  processHealthRecord(row, subType) {
    const timestamp = this.extractTimestamp(row);
    const record = this.createBaseRecord(row, timestamp, subType);
    record.dataType = 'health';
    
    // Handle different health metrics based on subtype
    switch (subType) {
      case 'bp':
        // Blood pressure format: time,systolic,diastolic,service
        const systolicValue = row.systolic ? parseFloat(row.systolic) : null;
        const diastolicValue = row.diastolic ? parseFloat(row.diastolic) : null;
        
        if (systolicValue !== null && diastolicValue !== null && 
            systolicValue > 0 && diastolicValue > 0) {
          record.blood_pressure = {
            systolic: this.createMetricValue(systolicValue, 'mmHg', 0.8),
            diastolic: this.createMetricValue(diastolicValue, 'mmHg', 0.8)
          };
        }
        break;
        
      case 'glucose':
        if (row.glucose) {
          record.glucose = this.createMetricValue(parseFloat(row.glucose), 'mg/dL', 0.8);
        }
        break;
        
      case 'hrv':
        if (row.hrv) {
          record.heart_rate_variability = this.createMetricValue(parseFloat(row.hrv), 'ms', 0.8);
        }
        break;
        
      case 'rhr':
        if (row.rhr || row.heart_rate) {
          record.resting_heart_rate = this.createMetricValue(
            parseFloat(row.rhr || row.heart_rate), 
            'bpm', 
            0.8
          );
        }
        break;
        
      case 'mood':
        record.mood_score = row.mood;
        record.notes = row.notes || '';
        break;
        
      case 'gvisits':
        // Location visits - process as health data type but add location fields
        record.location = {
          name: row.Name || row.name || '',
          latitude: row.Latitude ? parseFloat(row.Latitude) : null,
          longitude: row.Longitude ? parseFloat(row.Longitude) : null
        };
        
        // Duration if both start and end times are available
        if (row['Start Time'] && row['End Time']) {
          record.visit_start = this.dateNormalizer.normalize(row['Start Time']);
          record.visit_end = this.dateNormalizer.normalize(row['End Time']);
          
          const durationMinutes = this.dateNormalizer.calculateDuration(row['Start Time'], row['End Time']);
          record.visit_duration = this.createMetricValue(durationMinutes, 'minutes', 0.8);
        }
        break;
    }
    
    record.measurement_source = row.service || 'gyroscope';
    
    return record;
  }

  /**
   * Process a single CSV file
   * @param {string} filePath - Path to CSV file
   * @returns {Promise<Object[]>} Array of processed records
   */
  async processFile(filePath) {
    const dataType = this.getDataTypeFromFilename(filePath);
    const subType = this.getSubTypeFromFilename(filePath);
    const records = [];
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          try {
            let record = null;
            
            // Route to appropriate processor based on subtype
            switch (subType) {
              case 'steps':
                record = this.processStepsRecord(row, subType);
                break;
              case 'sleep':
                record = this.processSleepRecord(row, subType);
                break;
              case 'workouts':
                record = this.processWorkoutRecord(row, subType);
                break;
              case 'running':
              case 'cycling':
                record = this.processWorkoutRecord(row, subType);
                break;
              default:
                // Handle as health record
                record = this.processHealthRecord(row, subType);
            }
            
            if (record && this.validateRecord(record)) {
              records.push(record);
            }
          } catch (error) {
            this.logError(`Error processing row in ${filePath}`, { row, error: error.message });
          }
        })
        .on('end', () => {
          console.log(`Processed ${records.length} records from ${filePath}`);
          resolve(records);
        })
        .on('error', reject);
    });
  }
}

module.exports = GyroscopeProcessor;