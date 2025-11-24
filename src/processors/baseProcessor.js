const { v4: uuidv4 } = require('uuid');
const DateNormalizer = require('../utils/dateNormalizer');
const FileProcessor = require('../utils/fileProcessor');
const DatabaseConnection = require('../database/connection');
const DataMapper = require('../database/dataMapper');

/**
 * Base processor class for all data source processors
 * Provides common functionality and interface
 */
class BaseProcessor {
  constructor(sourceName, dataType, options = {}) {
    this.sourceName = sourceName;
    this.dataType = dataType;
    this.dateNormalizer = new DateNormalizer();
    this.fileProcessor = new FileProcessor();
    this.processed = [];
    this.errors = [];
    
    // Database integration
    this.enableDatabase = options.enableDatabase || false;
    this.dbPath = options.dbPath || './data/health_data.db';
    this.db = null;
    this.dataMapper = null;
  }

  /**
   * Create a base record with common fields
   * @param {Object} rawData - Original raw data
   * @param {string} timestamp - Event timestamp
   * @param {string} subType - Data subtype
   * @returns {Object} Base record structure
   */
  createBaseRecord(rawData, timestamp, subType = null) {
    return {
      id: uuidv4(),
      timestamp: this.dateNormalizer.normalize(timestamp),
      source: this.sourceName,
      dataType: this.dataType,
      subType: subType,
      processed_at: this.dateNormalizer.getCurrentTimestamp(),
      raw_data: rawData
    };
  }

  /**
   * Create a metric value object with unit and confidence
   * @param {number} value - Numeric value
   * @param {string} unit - Unit of measurement
   * @param {number} confidence - Confidence score 0-1
   * @returns {Object} Metric value object
   */
  createMetricValue(value, unit, confidence = 1.0) {
    return {
      value: Number(value),
      unit: unit,
      confidence: Number(confidence)
    };
  }

  /**
   * Validate required fields in a record
   * @param {Object} record - Record to validate
   * @param {string[]} requiredFields - Array of required field names
   * @returns {boolean} True if valid
   */
  validateRecord(record, requiredFields = ['timestamp']) {
    for (const field of requiredFields) {
      if (!record[field] || record[field] === null || record[field] === undefined) {
        this.logError(`Missing required field: ${field}`, record);
        return false;
      }
    }
    return true;
  }

  /**
   * Log processing error
   * @param {string} message - Error message
   * @param {Object} data - Related data
   */
  logError(message, data = null) {
    const error = {
      timestamp: this.dateNormalizer.getCurrentTimestamp(),
      processor: this.constructor.name,
      message: message,
      data: data
    };
    this.errors.push(error);
    console.error(`[${this.constructor.name}] ${message}`, data);
  }

  /**
   * Process a single file
   * @param {string} filePath - Path to file
   * @returns {Object[]} Array of processed records
   */
  async processFile(filePath) {
    throw new Error('processFile method must be implemented by subclass');
  }

  /**
   * Process multiple files
   * @param {string[]} filePaths - Array of file paths
   * @param {boolean} incremental - Only process changed files
   * @returns {Object} Processing results
   */
  async processFiles(filePaths, incremental = false) {
    let filesToProcess = filePaths;
    
    if (incremental) {
      filesToProcess = await this.fileProcessor.getChangedFiles(filePaths);
      console.log(`Processing ${filesToProcess.length} of ${filePaths.length} files (incremental)`);
    }

    const startTime = Date.now();
    this.processed = [];
    this.errors = [];

    for (const filePath of filesToProcess) {
      try {
        console.log(`Processing: ${filePath}`);
        const records = await this.processFile(filePath);
        this.processed.push(...records);
        
        if (incremental) {
          await this.fileProcessor.markFileProcessed(filePath);
        }
      } catch (error) {
        this.logError(`Failed to process file: ${filePath}`, error.message);
      }
    }

    const duration = Date.now() - startTime;
    
    if (incremental) {
      await this.fileProcessor.saveChecksumCache();
    }

    return {
      processed: this.processed.length,
      errors: this.errors.length,
      duration: duration,
      records: this.processed,
      errorLog: this.errors
    };
  }

  /**
   * Save processed records to JSON file
   * @param {string} outputPath - Output file path
   * @param {Object[]} records - Records to save
   */
  async saveToJson(outputPath, records = null) {
    const dataToSave = records || this.processed;
    await this.fileProcessor.ensureOutputDir(outputPath);
    await this.fileProcessor.writeJsonAtomic(outputPath, {
      meta: {
        source: this.sourceName,
        dataType: this.dataType,
        recordCount: dataToSave.length,
        generatedAt: this.dateNormalizer.getCurrentTimestamp(),
        processor: this.constructor.name
      },
      data: dataToSave
    });
    console.log(`Saved ${dataToSave.length} records to ${outputPath}`);
  }

  /**
   * Get processing statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      totalRecords: this.processed.length,
      totalErrors: this.errors.length,
      successRate: this.processed.length / (this.processed.length + this.errors.length) || 0,
      dataTypes: [...new Set(this.processed.map(r => r.subType))],
      dateRange: this.getDateRange()
    };
  }

  /**
   * Get date range of processed records
   * @returns {Object} Date range object
   */
  getDateRange() {
    if (this.processed.length === 0) return null;
    
    const dates = this.processed.map(r => new Date(r.timestamp)).sort();
    return {
      earliest: this.dateNormalizer.normalize(dates[0].toISOString()),
      latest: this.dateNormalizer.normalize(dates[dates.length - 1].toISOString())
    };
  }

  /**
   * Initialize database connection
   * @param {string} dbPath - Optional database path override
   */
  async initializeDatabase(dbPath = null) {
    if (dbPath) this.dbPath = dbPath;
    
    this.db = new DatabaseConnection(this.dbPath);
    await this.db.connect();
    
    // Create tables if they don't exist
    const exists = await this.db.databaseExists();
    if (!exists) {
      await this.db.createTables();
    }
    
    this.dataMapper = new DataMapper(this.db);
    this.enableDatabase = true;
    
    console.log(`📊 Database initialized: ${this.dbPath}`);
  }

  /**
   * Close database connection
   */
  closeDatabase() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.dataMapper = null;
      this.enableDatabase = false;
    }
  }

  /**
   * Save processed records to database
   * @param {Object[]} records - Records to save (defaults to this.processed)
   * @returns {Object} Insert results
   */
  async saveToDatabase(records = null) {
    if (!this.enableDatabase) {
      throw new Error('Database not enabled. Call initializeDatabase() first.');
    }

    const dataToSave = records || this.processed;
    if (dataToSave.length === 0) {
      return { totalRecords: 0, inserted: 0, errors: 0 };
    }

    console.log(`💾 Saving ${dataToSave.length} records to database...`);
    const result = this.dataMapper.insertRecords(dataToSave);
    
    console.log(`✅ Database: ${result.inserted} records saved, ${result.errors} errors`);
    
    if (result.errors > 0) {
      console.log('Database errors:');
      result.errorDetails.slice(0, 5).forEach(error => {
        console.log(`  - ${error.recordId}: ${error.error}`);
      });
      if (result.errorDetails.length > 5) {
        console.log(`  ... and ${result.errorDetails.length - 5} more errors`);
      }
    }
    
    return result;
  }

  /**
   * Process files with optional database integration
   * @param {string[]} filePaths - Array of file paths
   * @param {boolean} incremental - Only process changed files
   * @param {boolean} saveToDb - Save results to database
   * @returns {Object} Processing results
   */
  async processFilesWithDatabase(filePaths, incremental = false, saveToDb = false) {
    // Regular processing
    const result = await this.processFiles(filePaths, incremental);
    
    // Save to database if requested and enabled
    if (saveToDb && this.enableDatabase) {
      const dbResult = await this.saveToDatabase();
      result.databaseResult = dbResult;
    }
    
    return result;
  }

  /**
   * Delete records from database by source (for reprocessing)
   * @param {string} source - Source name to delete (defaults to this.sourceName)
   * @returns {Object} Deletion results
   */
  async deleteFromDatabase(source = null) {
    if (!this.enableDatabase) {
      throw new Error('Database not enabled. Call initializeDatabase() first.');
    }

    const sourceToDelete = source || this.sourceName;
    console.log(`🗑️  Deleting ${sourceToDelete} records from database...`);
    
    const result = this.dataMapper.deleteBySource(sourceToDelete);
    console.log(`✅ Deleted ${result.deletedRecords} records and ${result.deletedRelated} related entries`);
    
    return result;
  }

  /**
   * Get database statistics
   * @returns {Object} Database statistics
   */
  async getDatabaseStats() {
    if (!this.enableDatabase) {
      throw new Error('Database not enabled. Call initializeDatabase() first.');
    }

    return await this.db.getStats();
  }

  /**
   * Check if database exists and has data
   * @returns {boolean} True if database exists with data
   */
  async hasDatabaseData() {
    if (!this.enableDatabase) return false;
    
    try {
      const stats = await this.getDatabaseStats();
      return stats.totalRecords > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get records from database by date range
   * @param {string} startDate - Start date (MM/DD/YYYY)
   * @param {string} endDate - End date (MM/DD/YYYY)
   * @returns {Array} Records in date range
   */
  async getRecordsByDateRange(startDate, endDate) {
    if (!this.enableDatabase) {
      throw new Error('Database not enabled. Call initializeDatabase() first.');
    }

    return this.dataMapper.getRecordsByDateRange(startDate, endDate);
  }

  /**
   * Reprocess and update database
   * @param {string[]} filePaths - Files to reprocess
   * @param {boolean} clearExisting - Clear existing data first
   * @returns {Object} Reprocessing results
   */
  async reprocessToDatabase(filePaths, clearExisting = true) {
    if (!this.enableDatabase) {
      throw new Error('Database not enabled. Call initializeDatabase() first.');
    }

    const results = {
      deleted: null,
      processed: null,
      saved: null
    };

    // Clear existing data if requested
    if (clearExisting) {
      results.deleted = await this.deleteFromDatabase();
    }

    // Reprocess files
    results.processed = await this.processFiles(filePaths, false); // Force full reprocess

    // Save to database
    if (results.processed.records.length > 0) {
      results.saved = await this.saveToDatabase();
    }

    return results;
  }
}

module.exports = BaseProcessor;