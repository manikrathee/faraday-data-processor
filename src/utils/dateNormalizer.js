const moment = require('moment');

/**
 * Normalizes various date formats to MM/DD/YYYY HH:MM:SS
 * Handles multiple input formats from different data sources
 */
class DateNormalizer {
  constructor() {
    // Define supported input formats
    this.inputFormats = [
      'YYYY-MM-DD HH:mm:ss',     // Standard format
      'YYYY-MM-DD-HH:mm:ss',     // Gyroscope format
      'YYYY-MM-DD',              // Date only
      'MM/DD/YYYY HH:mm:ss',     // Target format
      'MM/DD/YYYY',              // Target date only
      'YYYY-MM-DD HH:mm +ZZOO',  // Twitter format
      'YYYY-MM-DD HH:mm:ss.SSS', // With milliseconds
      'ddd MMM DD HH:mm:ss YYYY' // Nike+ format
    ];
    
    this.targetFormat = 'MM/DD/YYYY HH:mm:ss';
    this.targetDateFormat = 'MM/DD/YYYY';
  }

  /**
   * Normalize a date string to MM/DD/YYYY HH:MM:SS format
   * @param {string} dateString - Input date string
   * @param {string} timezone - Optional timezone (defaults to local)
   * @returns {string} Normalized date string
   */
  normalize(dateString, timezone = null) {
    if (!dateString) return null;
    
    // Try to parse with each supported format
    let parsedDate = null;
    
    for (const format of this.inputFormats) {
      parsedDate = moment(dateString, format, true);
      if (parsedDate.isValid()) {
        break;
      }
    }
    
    // Fallback to moment's flexible parsing
    if (!parsedDate || !parsedDate.isValid()) {
      parsedDate = moment(dateString);
    }
    
    if (!parsedDate.isValid()) {
      throw new Error(`Unable to parse date: ${dateString}`);
    }
    
    // Apply timezone if specified
    if (timezone) {
      parsedDate = parsedDate.tz(timezone);
    }
    
    return parsedDate.format(this.targetFormat);
  }

  /**
   * Normalize date only (no time) to MM/DD/YYYY format
   * @param {string} dateString - Input date string
   * @returns {string} Normalized date string
   */
  normalizeDate(dateString) {
    const normalized = this.normalize(dateString);
    return normalized ? normalized.split(' ')[0] : null;
  }

  /**
   * Calculate duration between two dates in minutes
   * @param {string} startDate - Start date string
   * @param {string} endDate - End date string
   * @returns {number} Duration in minutes
   */
  calculateDuration(startDate, endDate) {
    const start = moment(this.normalize(startDate), this.targetFormat);
    const end = moment(this.normalize(endDate), this.targetFormat);
    
    return end.diff(start, 'minutes');
  }

  /**
   * Get current timestamp in target format
   * @returns {string} Current timestamp
   */
  getCurrentTimestamp() {
    return moment().format(this.targetFormat);
  }

  /**
   * Validate if a date string is in target format
   * @param {string} dateString - Date string to validate
   * @returns {boolean} True if valid
   */
  isValidFormat(dateString) {
    return moment(dateString, this.targetFormat, true).isValid();
  }
}

module.exports = DateNormalizer;