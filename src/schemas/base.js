/**
 * Base schema definitions for all data types
 * Ensures consistent structure across all processors
 */

const BaseRecord = {
  id: String,           // Unique identifier for the record
  timestamp: String,    // MM/DD/YYYY HH:MM:SS format
  source: String,       // Original data source (apple_health, nike_plus, etc.)
  dataType: String,     // Type category (fitness, health, sleep, etc.)
  processed_at: String, // When this record was processed
  raw_data: Object      // Original data for reference
};

const MetricValue = {
  value: Number,
  unit: String,
  confidence: Number    // 0-1, data quality/confidence score
};

module.exports = {
  BaseRecord,
  MetricValue
};