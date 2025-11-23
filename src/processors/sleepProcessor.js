const csv = require('csv-parser');
const fs = require('fs');
const BaseProcessor = require('./baseProcessor');

/**
 * Processor for sleep tracking CSV files
 * Handles various sleep data formats with automatic detection
 */
class SleepProcessor extends BaseProcessor {
  constructor() {
    super('sleep_tracker', 'sleep');
  }

  /**
   * Process a sleep data CSV file
   * @param {string} filePath - Path to CSV file
   * @returns {Promise<Object[]>} Array of processed records
   */
  async processFile(filePath) {
    const records = [];
    
    // Detect delimiter and format
    const sampleContent = await this.getSampleContent(filePath);
    const delimiter = this.detectDelimiter(sampleContent);
    const format = this.detectSleepFormat(sampleContent);
    
    console.log(`Processing sleep file with ${delimiter} delimiter, format: ${format}`);
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv({ separator: delimiter }))
        .on('data', (row) => {
          try {
            const record = this.processSleepRecord(row, format);
            if (record && this.validateRecord(record)) {
              records.push(record);
            }
          } catch (error) {
            this.logError(`Error processing row in ${filePath}`, { row, error: error.message });
          }
        })
        .on('end', () => {
          console.log(`Processed ${records.length} sleep records from ${filePath}`);
          resolve(records);
        })
        .on('error', reject);
    });
  }

  /**
   * Get sample content from file to detect format
   * @param {string} filePath - Path to file
   * @returns {Promise<string>} Sample content
   */
  async getSampleContent(filePath) {
    const content = await this.fileProcessor.readFileAuto(filePath);
    return content.split('\n').slice(0, 5).join('\n'); // First 5 lines
  }

  /**
   * Detect CSV delimiter
   * @param {string} content - Sample content
   * @returns {string} Detected delimiter
   */
  detectDelimiter(content) {
    const semicolonCount = (content.match(/;/g) || []).length;
    const commaCount = (content.match(/,/g) || []).length;
    
    return semicolonCount > commaCount ? ';' : ',';
  }

  /**
   * Detect sleep data format from headers
   * @param {string} content - Sample content
   * @returns {string} Detected format
   */
  detectSleepFormat(content) {
    const firstLine = content.split('\n')[0].toLowerCase();
    
    if (firstLine.includes('start') && firstLine.includes('end')) {
      if (firstLine.includes('quality')) {
        return 'quality_format'; // Start;End;Sleep quality;Time in bed;Wake up;Sleep Notes
      }
      return 'simple_start_end'; // start_time,end_time,service
    }
    
    if (firstLine.includes('bedtime') || firstLine.includes('sleep_start')) {
      return 'detailed_format'; // Detailed sleep metrics
    }
    
    return 'unknown';
  }

  /**
   * Process a single sleep record based on detected format
   * @param {Object} row - CSV row data
   * @param {string} format - Detected format
   * @returns {Object|null} Processed sleep record
   */
  processSleepRecord(row, format) {
    const keys = Object.keys(row);
    if (keys.length === 0) return null;
    
    // Skip empty rows
    if (keys.every(key => !row[key] || row[key].trim() === '')) {
      return null;
    }
    
    switch (format) {
      case 'quality_format':
        return this.processQualityFormatRecord(row);
      case 'simple_start_end':
        return this.processSimpleStartEndRecord(row);
      case 'detailed_format':
        return this.processDetailedFormatRecord(row);
      default:
        return this.processGenericSleepRecord(row);
    }
  }

  /**
   * Process quality format: Start;End;Sleep quality;Time in bed;Wake up;Sleep Notes
   * @param {Object} row - CSV row data
   * @returns {Object|null} Processed record
   */
  processQualityFormatRecord(row) {
    const startField = this.findField(row, ['start', 'Start']);
    const endField = this.findField(row, ['end', 'End']);
    
    if (!startField || !endField) return null;
    
    const record = this.createBaseRecord(row, row[startField], 'sleep_session');
    
    // Sleep times
    record.sleep_start = this.dateNormalizer.normalize(row[startField]);
    record.sleep_end = this.dateNormalizer.normalize(row[endField]);
    
    // Calculate duration
    const durationMinutes = this.dateNormalizer.calculateDuration(row[startField], row[endField]);
    record.sleep_duration = this.createMetricValue(durationMinutes, 'minutes', 0.8);
    
    // Sleep quality (percentage)
    const qualityField = this.findField(row, ['Sleep quality', 'quality', 'Quality']);
    if (qualityField && row[qualityField]) {
      const qualityStr = row[qualityField].replace('%', '');
      const quality = parseFloat(qualityStr);
      if (!isNaN(quality)) {
        record.sleep_quality = this.createMetricValue(quality, 'percent', 0.7);
      }
    }
    
    // Time in bed
    const bedTimeField = this.findField(row, ['Time in bed', 'time_in_bed', 'bedtime']);
    if (bedTimeField && row[bedTimeField]) {
      const bedTimeMinutes = this.parseTimeToMinutes(row[bedTimeField]);
      if (bedTimeMinutes > 0) {
        record.time_in_bed = this.createMetricValue(bedTimeMinutes, 'minutes', 0.8);
      }
    }
    
    // Wake up mood/feeling
    const wakeField = this.findField(row, ['Wake up', 'wake_up', 'wake_mood']);
    if (wakeField && row[wakeField]) {
      record.wake_mood = row[wakeField];
    }
    
    // Sleep notes
    const notesField = this.findField(row, ['Sleep Notes', 'notes', 'Notes']);
    if (notesField && row[notesField]) {
      record.sleep_notes = row[notesField];
    }
    
    return record;
  }

  /**
   * Process simple format: start_time,end_time,service
   * @param {Object} row - CSV row data
   * @returns {Object|null} Processed record
   */
  processSimpleStartEndRecord(row) {
    const startField = this.findField(row, ['start_time', 'start', 'Start']);
    const endField = this.findField(row, ['end_time', 'end', 'End']);
    
    if (!startField || !endField) return null;
    
    const record = this.createBaseRecord(row, row[startField], 'sleep_session');
    
    record.sleep_start = this.dateNormalizer.normalize(row[startField]);
    record.sleep_end = this.dateNormalizer.normalize(row[endField]);
    
    // Calculate duration
    const durationMinutes = this.dateNormalizer.calculateDuration(row[startField], row[endField]);
    record.sleep_duration = this.createMetricValue(durationMinutes, 'minutes', 0.8);
    
    // Service/source
    const serviceField = this.findField(row, ['service', 'source', 'Service']);
    if (serviceField && row[serviceField]) {
      record.measurement_source = row[serviceField];
    }
    
    return record;
  }

  /**
   * Process detailed format with multiple sleep metrics
   * @param {Object} row - CSV row data
   * @returns {Object|null} Processed record
   */
  processDetailedFormatRecord(row) {
    // Find timestamp field
    const timestampField = this.findField(row, [
      'date', 'Date', 'timestamp', 'bedtime', 'sleep_start'
    ]);
    
    if (!timestampField) return null;
    
    const record = this.createBaseRecord(row, row[timestampField], 'detailed_sleep');
    
    // Map common sleep metrics
    const fieldMappings = {
      sleep_duration: ['sleep_duration', 'duration', 'total_sleep'],
      sleep_efficiency: ['sleep_efficiency', 'efficiency'],
      deep_sleep: ['deep_sleep', 'deep', 'deep_sleep_minutes'],
      light_sleep: ['light_sleep', 'light', 'light_sleep_minutes'],
      rem_sleep: ['rem_sleep', 'rem', 'rem_sleep_minutes'],
      awake_time: ['awake_time', 'awake', 'wake_time'],
      wake_ups: ['wake_ups', 'wakeups', 'wake_count'],
      time_to_sleep: ['time_to_sleep', 'sleep_latency', 'time_to_fall_asleep']
    };
    
    for (const [metricName, possibleFields] of Object.entries(fieldMappings)) {
      const field = this.findField(row, possibleFields);
      if (field && row[field]) {
        const value = this.parseNumericValue(row[field]);
        if (value !== null) {
          const unit = this.determineUnit(field, value);
          record[metricName] = this.createMetricValue(value, unit, 0.8);
        }
      }
    }
    
    return record;
  }

  /**
   * Process generic sleep record when format is unknown
   * @param {Object} row - CSV row data
   * @returns {Object|null} Processed record
   */
  processGenericSleepRecord(row) {
    // Try to find any date/time field
    const keys = Object.keys(row);
    const timeField = keys.find(key => 
      key.toLowerCase().includes('date') || 
      key.toLowerCase().includes('time') ||
      key.toLowerCase().includes('start')
    );
    
    if (!timeField || !row[timeField]) return null;
    
    const record = this.createBaseRecord(row, row[timeField], 'generic_sleep');
    
    // Add all numeric fields as metrics
    keys.forEach(key => {
      const value = this.parseNumericValue(row[key]);
      if (value !== null && key !== timeField) {
        const unit = this.determineUnit(key, value);
        const metricName = key.toLowerCase().replace(/[^a-z0-9]/g, '_');
        record[metricName] = this.createMetricValue(value, unit, 0.6);
      }
    });
    
    return record;
  }

  /**
   * Find field in row by possible names
   * @param {Object} row - CSV row data
   * @param {string[]} possibleNames - Array of possible field names
   * @returns {string|null} Found field name
   */
  findField(row, possibleNames) {
    for (const name of possibleNames) {
      if (row.hasOwnProperty(name)) {
        return name;
      }
    }
    return null;
  }

  /**
   * Parse time string to minutes (e.g., "7:20" -> 440)
   * @param {string} timeStr - Time string
   * @returns {number} Minutes or 0 if invalid
   */
  parseTimeToMinutes(timeStr) {
    try {
      if (timeStr.includes(':')) {
        const [hours, minutes] = timeStr.split(':');
        return parseInt(hours) * 60 + parseInt(minutes);
      }
      return parseFloat(timeStr) || 0;
    } catch (error) {
      return 0;
    }
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
   * Determine unit based on field name and value
   * @param {string} fieldName - Field name
   * @param {number} value - Numeric value
   * @returns {string} Unit
   */
  determineUnit(fieldName, value) {
    const field = fieldName.toLowerCase();
    
    if (field.includes('percent') || field.includes('%') || (value <= 1 && value >= 0)) {
      return 'percent';
    }
    if (field.includes('hour')) {
      return 'hours';
    }
    if (field.includes('minute') || field.includes('duration') || field.includes('time')) {
      return 'minutes';
    }
    if (field.includes('count') || field.includes('wake')) {
      return 'count';
    }
    
    return 'units';
  }

  /**
   * Find sleep data files
   * @param {string} basePath - Base path to data
   * @returns {Promise<string[]>} Array of sleep file paths
   */
  async getSleepFiles(basePath) {
    const fs = require('fs-extra');
    const path = require('path');
    
    const files = [];
    
    // Look for sleep data files
    const items = await fs.readdir(basePath);
    
    for (const item of items) {
      const itemPath = path.join(basePath, item);
      const stats = await fs.stat(itemPath);
      
      if (stats.isFile() && item.endsWith('.csv')) {
        const lowerName = item.toLowerCase();
        if (lowerName.includes('sleep') || lowerName === 'sleepdata.csv') {
          files.push(itemPath);
        }
      }
    }
    
    return files;
  }
}

module.exports = SleepProcessor;