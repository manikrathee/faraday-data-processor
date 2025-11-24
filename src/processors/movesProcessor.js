const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const BaseProcessor = require('./baseProcessor');

/**
 * Processor for Moves app CSV and JSON data
 * Handles activities, places, and storyline data
 */
class MovesProcessor extends BaseProcessor {
  constructor() {
    super('moves', 'mixed');
    
    // Map Moves data types to our data types
    this.dataTypeMapping = {
      'activities': 'fitness',
      'places': 'location', 
      'storyline': 'location',
      'summary': 'fitness'
    };
  }

  /**
   * Process a Moves data file
   * @param {string} filePath - Path to CSV or JSON file
   * @returns {Promise<Object[]>} Array of processed records
   */
  async processFile(filePath) {
    const fileExtension = path.extname(filePath).toLowerCase();
    
    if (fileExtension === '.csv') {
      return this.processCsvFile(filePath);
    } else if (fileExtension === '.json') {
      return this.processJsonFile(filePath);
    } else {
      throw new Error(`Unsupported file format: ${fileExtension}`);
    }
  }

  /**
   * Process Moves CSV file
   * @param {string} filePath - Path to CSV file
   * @returns {Promise<Object[]>} Array of processed records
   */
  async processCsvFile(filePath) {
    const records = [];
    const filename = path.basename(filePath, '.csv');
    const dataType = this.determineDataType(filename);
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          try {
            let record = null;
            
            switch (filename) {
              case 'activities':
                record = this.processActivityRecord(row);
                break;
              case 'places':
                record = this.processPlaceRecord(row);
                break;
              case 'storyline':
                record = this.processStorylineRecord(row);
                break;
              case 'summary':
                record = this.processSummaryRecord(row);
                break;
              default:
                // Try to determine by headers
                if (row.Activity && row.Group) {
                  record = this.processActivityRecord(row);
                } else if (row.Name && row.Latitude) {
                  record = this.processPlaceRecord(row);
                } else {
                  record = this.processGenericRecord(row, dataType);
                }
            }
            
            if (record && this.validateRecord(record)) {
              records.push(record);
            }
          } catch (error) {
            this.logError(`Error processing row in ${filePath}`, { row, error: error.message });
          }
        })
        .on('end', () => {
          console.log(`Processed ${records.length} Moves records from ${filePath}`);
          resolve(records);
        })
        .on('error', reject);
    });
  }

  /**
   * Process Moves JSON file
   * @param {string} filePath - Path to JSON file
   * @returns {Promise<Object[]>} Array of processed records
   */
  async processJsonFile(filePath) {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const data = JSON.parse(content);
    const records = [];
    const filename = path.basename(filePath, '.json');
    
    if (Array.isArray(data)) {
      data.forEach(item => {
        try {
          let record = null;
          
          switch (filename) {
            case 'activities':
              record = this.processActivityJsonRecord(item);
              break;
            case 'places':
              record = this.processPlaceJsonRecord(item);
              break;
            case 'storyline':
              record = this.processStorylineJsonRecord(item);
              break;
            default:
              record = this.processGenericJsonRecord(item, filename);
          }
          
          if (record && this.validateRecord(record)) {
            records.push(record);
          }
        } catch (error) {
          this.logError(`Error processing JSON item in ${filePath}`, { item, error: error.message });
        }
      });
    }
    
    console.log(`Processed ${records.length} Moves JSON records from ${filePath}`);
    return records;
  }

  /**
   * Process activity record from CSV
   * Format: Date,Activity,Group,Start,End,Duration,Distance,Steps,Calories
   * @param {Object} row - CSV row data
   * @returns {Object|null} Processed record
   */
  processActivityRecord(row) {
    if (!row.Start || !row.Activity) return null;
    
    const record = this.createBaseRecord(row, row.Start, 'activity');
    record.dataType = 'fitness';
    
    // Activity details
    record.activity_type = row.Activity || 'unknown';
    record.activity_group = row.Group || record.activity_type;
    
    // Time details
    record.start_time = this.dateNormalizer.normalize(row.Start);
    if (row.End) {
      record.end_time = this.dateNormalizer.normalize(row.End);
    }
    
    // Duration (convert seconds to minutes)
    if (row.Duration) {
      const durationSeconds = parseFloat(row.Duration);
      const durationMinutes = durationSeconds / 60;
      record.duration = this.createMetricValue(durationMinutes, 'minutes', 0.8);
    }
    
    // Distance (convert to meters if needed)
    if (row.Distance) {
      const distance = parseFloat(row.Distance);
      // Moves distance appears to be in miles, convert to meters
      const distanceMeters = distance * 1609.34;
      record.distance = this.createMetricValue(distanceMeters, 'meters', 0.8);
    }
    
    // Steps
    if (row.Steps) {
      record.steps = this.createMetricValue(parseInt(row.Steps), 'steps', 0.9);
    }
    
    // Calories
    if (row.Calories) {
      record.calories = this.createMetricValue(parseFloat(row.Calories), 'calories', 0.7);
    }
    
    record.measurement_source = 'moves';
    return record;
  }

  /**
   * Process place record from CSV
   * Format: Date,Name,Start,End,Duration,Latitude,Longitude,Category,Link
   * @param {Object} row - CSV row data
   * @returns {Object|null} Processed record
   */
  processPlaceRecord(row) {
    if (!row.Start || !row.Name) return null;
    
    const record = this.createBaseRecord(row, row.Start, 'location');
    record.dataType = 'location';
    
    // Location details
    record.place_name = row.Name;
    record.category = row.Category || 'unknown';
    
    if (row.Latitude && row.Longitude) {
      record.location = {
        latitude: parseFloat(row.Latitude),
        longitude: parseFloat(row.Longitude)
      };
    }
    
    // Time details
    record.arrival_time = this.dateNormalizer.normalize(row.Start);
    if (row.End) {
      record.departure_time = this.dateNormalizer.normalize(row.End);
    }
    
    // Duration (convert seconds to minutes)
    if (row.Duration) {
      const durationSeconds = parseFloat(row.Duration);
      const durationMinutes = durationSeconds / 60;
      record.visit_duration = this.createMetricValue(durationMinutes, 'minutes', 0.9);
    }
    
    // External link (Foursquare, etc.)
    if (row.Link && row.Link.trim()) {
      record.external_link = row.Link;
    }
    
    record.measurement_source = 'moves';
    return record;
  }

  /**
   * Process storyline record (generic location/activity mix)
   * @param {Object} row - CSV row data
   * @returns {Object|null} Processed record
   */
  processStorylineRecord(row) {
    if (!row.Start) return null;
    
    // Determine if it's more like an activity or location
    if (row.Activity && row.Group) {
      return this.processActivityRecord(row);
    } else if (row.Name && row.Latitude) {
      return this.processPlaceRecord(row);
    } else {
      // Generic storyline entry
      const record = this.createBaseRecord(row, row.Start, 'storyline');
      record.dataType = 'location';
      
      record.start_time = this.dateNormalizer.normalize(row.Start);
      if (row.End) {
        record.end_time = this.dateNormalizer.normalize(row.End);
      }
      
      record.measurement_source = 'moves';
      return record;
    }
  }

  /**
   * Process summary record (daily summaries)
   * @param {Object} row - CSV row data
   * @returns {Object|null} Processed record
   */
  processSummaryRecord(row) {
    if (!row.Date) return null;
    
    const record = this.createBaseRecord(row, row.Date, 'daily_summary');
    record.dataType = 'fitness';
    
    // Parse common summary fields
    if (row.Steps) {
      record.steps = this.createMetricValue(parseInt(row.Steps), 'steps', 0.9);
    }
    
    if (row.Distance) {
      const distance = parseFloat(row.Distance);
      const distanceMeters = distance * 1609.34; // Convert miles to meters
      record.distance = this.createMetricValue(distanceMeters, 'meters', 0.8);
    }
    
    if (row.Calories) {
      record.calories = this.createMetricValue(parseFloat(row.Calories), 'calories', 0.7);
    }
    
    if (row.Duration) {
      const durationMinutes = parseFloat(row.Duration) / 60;
      record.active_duration = this.createMetricValue(durationMinutes, 'minutes', 0.8);
    }
    
    record.measurement_source = 'moves';
    return record;
  }

  /**
   * Process generic record for unknown formats
   * @param {Object} row - CSV row data
   * @param {string} dataType - Determined data type
   * @returns {Object|null} Processed record
   */
  processGenericRecord(row, dataType) {
    // Find a timestamp field
    const timeField = Object.keys(row).find(key => 
      key.toLowerCase().includes('date') || 
      key.toLowerCase().includes('time') ||
      key.toLowerCase().includes('start')
    );
    
    if (!timeField || !row[timeField]) return null;
    
    const record = this.createBaseRecord(row, row[timeField], 'generic');
    record.dataType = dataType || 'mixed';
    record.measurement_source = 'moves';
    
    return record;
  }

  /**
   * Determine data type from filename
   * @param {string} filename - File name
   * @returns {string} Data type
   */
  determineDataType(filename) {
    return this.dataTypeMapping[filename] || 'mixed';
  }

  /**
   * Process JSON activity record
   * @param {Object} item - JSON item
   * @returns {Object|null} Processed record
   */
  processActivityJsonRecord(item) {
    if (!item.startTime) return null;
    
    const record = this.createBaseRecord(item, item.startTime, 'activity');
    record.dataType = 'fitness';
    
    record.activity_type = item.activity || 'unknown';
    record.start_time = this.dateNormalizer.normalize(item.startTime);
    
    if (item.endTime) {
      record.end_time = this.dateNormalizer.normalize(item.endTime);
    }
    
    if (item.duration) {
      record.duration = this.createMetricValue(item.duration / 60, 'minutes', 0.8);
    }
    
    if (item.distance) {
      record.distance = this.createMetricValue(item.distance, 'meters', 0.8);
    }
    
    record.measurement_source = 'moves';
    return record;
  }

  /**
   * Process JSON place record
   * @param {Object} item - JSON item
   * @returns {Object|null} Processed record
   */
  processPlaceJsonRecord(item) {
    if (!item.startTime) return null;
    
    const record = this.createBaseRecord(item, item.startTime, 'location');
    record.dataType = 'location';
    
    if (item.place) {
      record.place_name = item.place.name || 'Unknown';
      record.category = item.place.type || 'unknown';
      
      if (item.place.location) {
        record.location = {
          latitude: item.place.location.lat,
          longitude: item.place.location.lon
        };
      }
    }
    
    record.arrival_time = this.dateNormalizer.normalize(item.startTime);
    if (item.endTime) {
      record.departure_time = this.dateNormalizer.normalize(item.endTime);
    }
    
    record.measurement_source = 'moves';
    return record;
  }

  /**
   * Process JSON storyline record
   * @param {Object} item - JSON item
   * @returns {Object|null} Processed record
   */
  processStorylineJsonRecord(item) {
    // Storyline JSON can contain multiple segments
    const records = [];
    
    if (item.segments && Array.isArray(item.segments)) {
      item.segments.forEach(segment => {
        if (segment.type === 'place' && segment.place) {
          const placeRecord = this.processPlaceJsonRecord(segment);
          if (placeRecord) records.push(placeRecord);
        } else if (segment.type === 'move' && segment.activities) {
          segment.activities.forEach(activity => {
            const activityRecord = this.processActivityJsonRecord(activity);
            if (activityRecord) records.push(activityRecord);
          });
        }
      });
    }
    
    return records.length > 0 ? records[0] : null; // Return first record for now
  }

  /**
   * Process generic JSON record
   * @param {Object} item - JSON item
   * @param {string} type - File type
   * @returns {Object|null} Processed record
   */
  processGenericJsonRecord(item, type) {
    const timeField = Object.keys(item).find(key => 
      key.includes('Time') || key.includes('Date') || key.includes('time')
    );
    
    if (!timeField || !item[timeField]) return null;
    
    const record = this.createBaseRecord(item, item[timeField], 'generic');
    record.dataType = this.determineDataType(type);
    record.measurement_source = 'moves';
    
    return record;
  }

  /**
   * Find Moves data files
   * @param {string} basePath - Base path to data
   * @returns {Promise<string[]>} Array of Moves file paths
   */
  async getMovesFiles(basePath) {
    const files = [];
    const movesDir = path.join(basePath, 'moves_export');
    
    if (!await fs.promises.access(movesDir).then(() => true).catch(() => false)) {
      return files;
    }
    
    // Look for CSV files first (more structured)
    const csvFullDir = path.join(movesDir, 'csv', 'full');
    if (await fs.promises.access(csvFullDir).then(() => true).catch(() => false)) {
      const csvFiles = await fs.promises.readdir(csvFullDir);
      csvFiles.forEach(file => {
        if (file.endsWith('.csv')) {
          files.push(path.join(csvFullDir, file));
        }
      });
    }
    
    // Look for JSON files
    const jsonFullDir = path.join(movesDir, 'json', 'full');
    if (await fs.promises.access(jsonFullDir).then(() => true).catch(() => false)) {
      const jsonFiles = await fs.promises.readdir(jsonFullDir);
      jsonFiles.forEach(file => {
        if (file.endsWith('.json')) {
          files.push(path.join(jsonFullDir, file));
        }
      });
    }
    
    return files;
  }
}

module.exports = MovesProcessor;