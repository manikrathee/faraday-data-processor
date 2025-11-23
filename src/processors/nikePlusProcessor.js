const fs = require('fs-extra');
const BaseProcessor = require('./baseProcessor');

/**
 * Processor for Nike+ FuelBand JSON and TCX files
 * Handles activity tracking with fuel points, steps, calories, distance
 */
class NikePlusProcessor extends BaseProcessor {
  constructor() {
    super('nike_plus', 'fitness');
  }

  /**
   * Parse Nike+ activity JSON file
   * @param {string} filePath - Path to JSON file
   * @returns {Promise<Object[]>} Array of processed records
   */
  async processJsonFile(filePath) {
    const content = await this.fileProcessor.readFileAuto(filePath);
    const data = JSON.parse(content);
    
    const records = [];
    
    // Extract activity metadata from filename
    const filename = filePath.split('/').pop();
    const activityMatch = filename.match(/NikePlus-(\d{4}-\d{2}-\d{2})-([^-]+)/);
    const dateStr = activityMatch ? activityMatch[1] : null;
    const activityId = data.activityId || activityMatch?.[2];
    
    if (!dateStr) {
      this.logError('Could not extract date from filename', filePath);
      return records;
    }

    // Create main activity record
    const baseTimestamp = `${dateStr} 00:00:00`;
    const record = this.createBaseRecord(data, baseTimestamp, 'activity');
    
    // Activity metadata
    record.activity_id = activityId;
    record.activity_type = data.activityType || 'ALL_DAY';
    record.device_type = data.deviceType || 'FUELBAND';
    record.timezone = data.activityTimeZone || 'America/Los_Angeles';
    
    // Metric summary
    if (data.metricSummary) {
      const summary = data.metricSummary;
      
      if (summary.steps) {
        record.steps = this.createMetricValue(summary.steps, 'steps', 0.9);
      }
      
      if (summary.calories) {
        record.calories = this.createMetricValue(summary.calories, 'calories', 0.8);
      }
      
      if (summary.distance) {
        record.distance = this.createMetricValue(summary.distance, 'miles', 0.7);
      }
      
      if (summary.fuel) {
        record.fuel_points = this.createMetricValue(summary.fuel, 'fuel', 1.0);
      }
      
      if (summary.duration) {
        // Parse duration string like "9:06:00.000"
        const durationMinutes = this.parseDurationToMinutes(summary.duration);
        if (durationMinutes > 0) {
          record.duration = this.createMetricValue(durationMinutes, 'minutes', 0.9);
        }
      }
    }
    
    records.push(record);
    
    // Process minute-by-minute metrics if available
    if (data.metrics && data.metrics.length > 0) {
      const minuteRecords = this.processMinuteMetrics(data.metrics, baseTimestamp, activityId);
      records.push(...minuteRecords);
    }
    
    return records;
  }

  /**
   * Process minute-by-minute metric data
   * @param {Array} metrics - Array of metric objects
   * @param {string} baseTimestamp - Base timestamp for the activity
   * @param {string} activityId - Activity identifier
   * @returns {Array} Array of minute-level records
   */
  processMinuteMetrics(metrics, baseTimestamp, activityId) {
    const records = [];
    
    for (const metric of metrics) {
      if (!metric.values || !Array.isArray(metric.values)) continue;
      
      const metricType = metric.metricType?.toLowerCase();
      const intervalMinutes = metric.intervalMetric || 1;
      
      // Process each minute value
      metric.values.forEach((value, index) => {
        if (value === "0" || value === 0) return; // Skip zero values
        
        // Calculate timestamp for this minute
        const minuteOffset = index * intervalMinutes;
        const timestamp = this.addMinutesToTimestamp(baseTimestamp, minuteOffset);
        
        const record = this.createBaseRecord(
          { originalValue: value, metricType: metric.metricType },
          timestamp,
          `minute_${metricType}`
        );
        
        record.activity_id = activityId;
        record.minute_offset = minuteOffset;
        record.interval_minutes = intervalMinutes;
        
        // Create metric value based on type
        switch (metricType) {
          case 'fuel':
            record.fuel_points = this.createMetricValue(parseInt(value), 'fuel', 0.9);
            break;
          case 'steps':
            record.steps = this.createMetricValue(parseInt(value), 'steps', 0.9);
            break;
          case 'calories':
            record.calories = this.createMetricValue(parseInt(value), 'calories', 0.8);
            break;
          default:
            record.metric_value = this.createMetricValue(parseFloat(value), metricType, 0.7);
        }
        
        if (this.validateRecord(record)) {
          records.push(record);
        }
      });
    }
    
    return records;
  }

  /**
   * Parse duration string to minutes
   * @param {string} durationStr - Duration in format "H:MM:SS.mmm"
   * @returns {number} Duration in minutes
   */
  parseDurationToMinutes(durationStr) {
    try {
      const parts = durationStr.split(':');
      if (parts.length >= 3) {
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);
        const seconds = parseFloat(parts[2]);
        return hours * 60 + minutes + seconds / 60;
      }
    } catch (error) {
      this.logError('Failed to parse duration', { duration: durationStr, error: error.message });
    }
    return 0;
  }

  /**
   * Add minutes to a timestamp
   * @param {string} timestamp - Base timestamp
   * @param {number} minutes - Minutes to add
   * @returns {string} New timestamp
   */
  addMinutesToTimestamp(timestamp, minutes) {
    const date = new Date(timestamp);
    date.setMinutes(date.getMinutes() + minutes);
    return this.dateNormalizer.normalize(date.toISOString());
  }

  /**
   * Process TCX file (Training Center XML)
   * @param {string} filePath - Path to TCX file
   * @returns {Promise<Object[]>} Array of processed records
   */
  async processTcxFile(filePath) {
    // For now, return empty array - TCX processing would require XML parsing
    // Could be implemented later if detailed workout data is needed
    console.log(`TCX file processing not implemented yet: ${filePath}`);
    return [];
  }

  /**
   * Process a single Nike+ file (JSON or TCX)
   * @param {string} filePath - Path to file
   * @returns {Promise<Object[]>} Array of processed records
   */
  async processFile(filePath) {
    const filename = filePath.split('/').pop();
    
    // Skip log files and other non-data files
    if (filename.endsWith('.log') || filename.includes('diagnostic') || filename.includes('readme')) {
      return [];
    }
    
    try {
      if (filename.endsWith('.json')) {
        return await this.processJsonFile(filePath);
      } else if (filename.endsWith('.tcx')) {
        return await this.processTcxFile(filePath);
      } else {
        console.log(`Skipping unsupported file type: ${filename}`);
        return [];
      }
    } catch (error) {
      this.logError(`Failed to process Nike+ file: ${filePath}`, error.message);
      return [];
    }
  }

  /**
   * Get Nike+ files from directories
   * @param {string} basePath - Base path to Nike+ data
   * @returns {Promise<string[]>} Array of file paths
   */
  async getNikePlusFiles(basePath) {
    const files = [];
    
    // Check both "NikePlus Run Data" and "NikePlus complete" directories
    const directories = [
      `${basePath}/Run Data/NikePlus Run Data`,
      `${basePath}/Run Data/NikePlus complete`
    ];
    
    for (const dir of directories) {
      if (await fs.pathExists(dir)) {
        const dirFiles = await fs.readdir(dir);
        const fullPaths = dirFiles
          .filter(file => file.endsWith('.json') || file.endsWith('.tcx'))
          .map(file => `${dir}/${file}`);
        files.push(...fullPaths);
      }
    }
    
    return files;
  }
}

module.exports = NikePlusProcessor;