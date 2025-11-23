const csv = require('csv-parser');
const fs = require('fs');
const BaseProcessor = require('./baseProcessor');

/**
 * Processor for manually tracked health data CSV files
 * Handles symptoms, conditions, medications, and other self-tracked health metrics
 */
class ManualHealthProcessor extends BaseProcessor {
  constructor() {
    super('manual_health', 'health');
  }

  /**
   * Process a manual health CSV file
   * @param {string} filePath - Path to CSV file
   * @returns {Promise<Object[]>} Array of processed records
   */
  async processFile(filePath) {
    const records = [];
    const filename = filePath.split('/').pop().toLowerCase();
    
    // Determine health data type from filename
    const healthType = this.determineHealthType(filename);
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          try {
            const record = this.processHealthRecord(row, healthType);
            if (record && this.validateRecord(record)) {
              records.push(record);
            }
          } catch (error) {
            this.logError(`Error processing row in ${filePath}`, { row, error: error.message });
          }
        })
        .on('end', () => {
          console.log(`Processed ${records.length} manual health records from ${filePath}`);
          resolve(records);
        })
        .on('error', reject);
    });
  }

  /**
   * Determine health data type from filename
   * @param {string} filename - Name of the file
   * @returns {string} Health data type
   */
  determineHealthType(filename) {
    if (filename.includes('migraine') || filename.includes('headache')) {
      return 'migraine';
    }
    if (filename.includes('symptom')) {
      return 'symptoms';
    }
    if (filename.includes('medication') || filename.includes('drug')) {
      return 'medication';
    }
    if (filename.includes('mood') || filename.includes('mental')) {
      return 'mood';
    }
    if (filename.includes('pain')) {
      return 'pain';
    }
    if (filename.includes('weight') || filename.includes('bmi')) {
      return 'weight';
    }
    if (filename.includes('blood_pressure') || filename.includes('bp')) {
      return 'blood_pressure';
    }
    if (filename.includes('glucose') || filename.includes('blood_sugar')) {
      return 'glucose';
    }
    
    return 'general';
  }

  /**
   * Process a health record based on type
   * @param {Object} row - CSV row data
   * @param {string} healthType - Type of health data
   * @returns {Object|null} Processed record
   */
  processHealthRecord(row, healthType) {
    // Find date field
    const dateField = this.findDateField(row);
    if (!dateField || !row[dateField]) {
      return null;
    }
    
    const record = this.createBaseRecord(row, row[dateField], healthType);
    
    // Process based on health type
    switch (healthType) {
      case 'migraine':
        return this.processMigrainerecord(record, row);
      case 'symptoms':
        return this.processSymptomRecord(record, row);
      case 'medication':
        return this.processMedicationRecord(record, row);
      case 'mood':
        return this.processMoodRecord(record, row);
      case 'pain':
        return this.processPainRecord(record, row);
      case 'weight':
        return this.processWeightRecord(record, row);
      case 'blood_pressure':
        return this.processBloodPressureRecord(record, row);
      case 'glucose':
        return this.processGlucoseRecord(record, row);
      default:
        return this.processGeneralHealthRecord(record, row);
    }
  }

  /**
   * Process migraine record (date,severity,duration_hours)
   * @param {Object} record - Base record
   * @param {Object} row - CSV row data
   * @returns {Object} Processed record
   */
  processMigrainerecord(record, row) {
    // Severity mapping
    const severityMap = {
      'L': 'low',
      'M': 'medium', 
      'H': 'high',
      'low': 'low',
      'medium': 'medium',
      'high': 'high'
    };
    
    record.condition = 'migraine';
    
    if (row.severity) {
      record.severity = severityMap[row.severity] || row.severity;
      
      // Convert severity to numeric scale (1-5)
      const severityScore = {
        'low': 2,
        'medium': 3, 
        'high': 4
      }[record.severity] || 3;
      
      record.severity_score = this.createMetricValue(severityScore, 'scale_1_5', 1.0);
    }
    
    if (row.duration_hours) {
      const hours = parseFloat(row.duration_hours);
      record.duration = this.createMetricValue(hours, 'hours', 1.0);
      record.duration_minutes = this.createMetricValue(hours * 60, 'minutes', 1.0);
    }
    
    // Add migraine-specific fields
    record.symptom_type = 'headache';
    record.impact_level = record.severity;
    
    return record;
  }

  /**
   * Process general symptom record
   * @param {Object} record - Base record
   * @param {Object} row - CSV row data
   * @returns {Object} Processed record
   */
  processSymptomRecord(record, row) {
    // Common symptom fields
    const symptomFields = ['symptom', 'symptoms', 'condition', 'issue'];
    const severityFields = ['severity', 'intensity', 'level', 'rating'];
    const durationFields = ['duration', 'duration_hours', 'duration_minutes'];
    
    // Find and map symptom
    const symptomField = this.findFieldByNames(row, symptomFields);
    if (symptomField) {
      record.symptoms = [row[symptomField]];
      record.primary_symptom = row[symptomField];
    }
    
    // Find and map severity
    const severityField = this.findFieldByNames(row, severityFields);
    if (severityField) {
      record.severity = row[severityField];
      
      // Try to convert to numeric
      const numericSeverity = this.parseNumericValue(row[severityField]);
      if (numericSeverity !== null) {
        record.severity_score = this.createMetricValue(numericSeverity, 'scale', 0.9);
      }
    }
    
    // Find and map duration
    const durationField = this.findFieldByNames(row, durationFields);
    if (durationField) {
      const duration = this.parseNumericValue(row[durationField]);
      if (duration !== null) {
        const unit = durationField.includes('hour') ? 'hours' : 'minutes';
        record.duration = this.createMetricValue(duration, unit, 0.9);
      }
    }
    
    return record;
  }

  /**
   * Process medication record
   * @param {Object} record - Base record
   * @param {Object} row - CSV row data
   * @returns {Object} Processed record
   */
  processMedicationRecord(record, row) {
    const medicationFields = ['medication', 'drug', 'medicine', 'name'];
    const dosageFields = ['dosage', 'dose', 'amount', 'mg', 'ml'];
    const frequencyFields = ['frequency', 'times_per_day', 'schedule'];
    
    const medicationField = this.findFieldByNames(row, medicationFields);
    if (medicationField) {
      record.medication_name = row[medicationField];
    }
    
    const dosageField = this.findFieldByNames(row, dosageFields);
    if (dosageField) {
      const dosage = this.parseNumericValue(row[dosageField]);
      if (dosage !== null) {
        const unit = dosageField.includes('ml') ? 'ml' : 'mg';
        record.dosage = this.createMetricValue(dosage, unit, 1.0);
      }
    }
    
    const frequencyField = this.findFieldByNames(row, frequencyFields);
    if (frequencyField) {
      record.frequency = row[frequencyField];
    }
    
    record.medication_taken = true;
    
    return record;
  }

  /**
   * Process mood record
   * @param {Object} record - Base record
   * @param {Object} row - CSV row data
   * @returns {Object} Processed record
   */
  processMoodRecord(record, row) {
    const moodFields = ['mood', 'feeling', 'emotion', 'state'];
    const scoreFields = ['score', 'rating', 'level', 'scale'];
    
    const moodField = this.findFieldByNames(row, moodFields);
    if (moodField) {
      record.mood = row[moodField];
    }
    
    const scoreField = this.findFieldByNames(row, scoreFields);
    if (scoreField) {
      const score = this.parseNumericValue(row[scoreField]);
      if (score !== null) {
        record.mood_score = this.createMetricValue(score, 'scale', 0.9);
      }
    }
    
    return record;
  }

  /**
   * Process pain record
   * @param {Object} record - Base record
   * @param {Object} row - CSV row data
   * @returns {Object} Processed record
   */
  processPainRecord(record, row) {
    const locationFields = ['location', 'area', 'body_part'];
    const intensityFields = ['intensity', 'level', 'rating', 'pain_scale'];
    
    record.symptom_type = 'pain';
    
    const locationField = this.findFieldByNames(row, locationFields);
    if (locationField) {
      record.pain_location = row[locationField];
    }
    
    const intensityField = this.findFieldByNames(row, intensityFields);
    if (intensityField) {
      const intensity = this.parseNumericValue(row[intensityField]);
      if (intensity !== null) {
        record.pain_intensity = this.createMetricValue(intensity, 'scale_1_10', 0.9);
      }
    }
    
    return record;
  }

  /**
   * Process weight record
   * @param {Object} record - Base record
   * @param {Object} row - CSV row data
   * @returns {Object} Processed record
   */
  processWeightRecord(record, row) {
    const weightFields = ['weight', 'body_weight', 'mass'];
    const bmiFields = ['bmi', 'body_mass_index'];
    
    const weightField = this.findFieldByNames(row, weightFields);
    if (weightField) {
      const weight = this.parseNumericValue(row[weightField]);
      if (weight !== null) {
        const unit = weight > 50 ? 'kg' : 'lbs'; // Rough guess
        record.weight = this.createMetricValue(weight, unit, 0.9);
      }
    }
    
    const bmiField = this.findFieldByNames(row, bmiFields);
    if (bmiField) {
      const bmi = this.parseNumericValue(row[bmiField]);
      if (bmi !== null) {
        record.bmi = this.createMetricValue(bmi, 'kg/m²', 0.9);
      }
    }
    
    return record;
  }

  /**
   * Process blood pressure record
   * @param {Object} record - Base record
   * @param {Object} row - CSV row data
   * @returns {Object} Processed record
   */
  processBloodPressureRecord(record, row) {
    const systolicFields = ['systolic', 'sys', 'top_number'];
    const diastolicFields = ['diastolic', 'dia', 'bottom_number'];
    
    const systolicField = this.findFieldByNames(row, systolicFields);
    const diastolicField = this.findFieldByNames(row, diastolicFields);
    
    if (systolicField || diastolicField) {
      record.blood_pressure = {};
      
      if (systolicField) {
        const systolic = this.parseNumericValue(row[systolicField]);
        if (systolic !== null) {
          record.blood_pressure.systolic = this.createMetricValue(systolic, 'mmHg', 0.9);
        }
      }
      
      if (diastolicField) {
        const diastolic = this.parseNumericValue(row[diastolicField]);
        if (diastolic !== null) {
          record.blood_pressure.diastolic = this.createMetricValue(diastolic, 'mmHg', 0.9);
        }
      }
    }
    
    return record;
  }

  /**
   * Process glucose record
   * @param {Object} record - Base record
   * @param {Object} row - CSV row data
   * @returns {Object} Processed record
   */
  processGlucoseRecord(record, row) {
    const glucoseFields = ['glucose', 'blood_glucose', 'blood_sugar', 'bg'];
    
    const glucoseField = this.findFieldByNames(row, glucoseFields);
    if (glucoseField) {
      const glucose = this.parseNumericValue(row[glucoseField]);
      if (glucose !== null) {
        record.glucose = this.createMetricValue(glucose, 'mg/dL', 0.9);
      }
    }
    
    return record;
  }

  /**
   * Process general health record
   * @param {Object} record - Base record
   * @param {Object} row - CSV row data
   * @returns {Object} Processed record
   */
  processGeneralHealthRecord(record, row) {
    // Add all fields as generic metrics
    Object.keys(row).forEach(key => {
      if (key !== record.timestamp && row[key]) {
        const value = this.parseNumericValue(row[key]);
        if (value !== null) {
          const metricName = key.toLowerCase().replace(/[^a-z0-9]/g, '_');
          record[metricName] = this.createMetricValue(value, 'units', 0.7);
        } else {
          // Non-numeric value
          const fieldName = key.toLowerCase().replace(/[^a-z0-9]/g, '_');
          record[fieldName] = row[key];
        }
      }
    });
    
    return record;
  }

  /**
   * Find date field in row
   * @param {Object} row - CSV row data
   * @returns {string|null} Date field name
   */
  findDateField(row) {
    const dateFields = ['date', 'Date', 'timestamp', 'time', 'datetime', 'when'];
    return this.findFieldByNames(row, dateFields);
  }

  /**
   * Find field by possible names
   * @param {Object} row - CSV row data
   * @param {string[]} names - Possible field names
   * @returns {string|null} Found field name
   */
  findFieldByNames(row, names) {
    for (const name of names) {
      if (row.hasOwnProperty(name)) {
        return name;
      }
    }
    return null;
  }

  /**
   * Parse numeric value from string
   * @param {string} valueStr - Value string
   * @returns {number|null} Numeric value or null
   */
  parseNumericValue(valueStr) {
    if (!valueStr || typeof valueStr !== 'string') return null;
    
    const cleaned = valueStr.replace(/[^\d.-]/g, '');
    const value = parseFloat(cleaned);
    
    return isNaN(value) ? null : value;
  }

  /**
   * Find manual health data files
   * @param {string} basePath - Base path to data
   * @returns {Promise<string[]>} Array of manual health file paths
   */
  async getManualHealthFiles(basePath) {
    const fs = require('fs-extra');
    const path = require('path');
    
    const files = [];
    
    // Look for manual health data files
    const items = await fs.readdir(basePath);
    
    for (const item of items) {
      if (item.endsWith('.csv')) {
        const lowerName = item.toLowerCase();
        
        // Check for health-related keywords
        const healthKeywords = [
          'migraine', 'symptom', 'pain', 'medication', 'mood', 'mental',
          'weight', 'bmi', 'blood_pressure', 'bp', 'glucose', 'sugar',
          'manual', 'health', 'diary', 'log', 'track'
        ];
        
        if (healthKeywords.some(keyword => lowerName.includes(keyword))) {
          files.push(path.join(basePath, item));
        }
      }
    }
    
    return files;
  }
}

module.exports = ManualHealthProcessor;