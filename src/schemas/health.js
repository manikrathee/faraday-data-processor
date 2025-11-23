const { BaseRecord, MetricValue } = require('./base');

/**
 * Health data schema - heart rate, blood pressure, glucose, etc.
 */
const HealthRecord = {
  ...BaseRecord,
  dataType: 'health',
  subType: String,      // 'heart_rate', 'blood_pressure', 'glucose', 'weight', etc.
  
  // Vital signs
  heart_rate: MetricValue,     // bpm
  blood_pressure: {
    systolic: MetricValue,     // mmHg
    diastolic: MetricValue     // mmHg
  },
  glucose: MetricValue,        // mg/dL
  weight: MetricValue,         // kg or lbs
  bmi: MetricValue,
  
  // Health metrics
  resting_heart_rate: MetricValue,
  heart_rate_variability: MetricValue,
  oxygen_saturation: MetricValue, // %
  
  // Symptoms/conditions
  symptoms: [String],          // array of symptoms
  severity: String,            // 'low', 'medium', 'high'
  
  // Context
  measurement_method: String,   // 'manual', 'device', 'estimated'
  device_type: String,         // specific device used
  notes: String
};

module.exports = { HealthRecord };