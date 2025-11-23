const { v4: uuidv4 } = require('uuid');
const DateNormalizer = require('../utils/dateNormalizer');
const FileProcessor = require('../utils/fileProcessor');

/**
 * Base processor class for all data source processors
 * Provides common functionality and interface
 */
class BaseProcessor {
  constructor(sourceName, dataType) {
    this.sourceName = sourceName;
    this.dataType = dataType;
    this.dateNormalizer = new DateNormalizer();
    this.fileProcessor = new FileProcessor();
    this.processed = [];
    this.errors = [];
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
}

module.exports = BaseProcessor;