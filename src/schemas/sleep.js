const { BaseRecord, MetricValue } = require('./base');

/**
 * Sleep data schema - sleep sessions, quality, stages
 */
const SleepRecord = {
  ...BaseRecord,
  dataType: 'sleep',
  subType: String,      // 'session', 'quality', 'stages'
  
  // Sleep session
  bedtime: String,      // MM/DD/YYYY HH:MM:SS
  sleep_start: String,  // MM/DD/YYYY HH:MM:SS
  sleep_end: String,    // MM/DD/YYYY HH:MM:SS
  wake_time: String,    // MM/DD/YYYY HH:MM:SS
  
  // Duration metrics (in minutes)
  time_in_bed: MetricValue,
  sleep_duration: MetricValue,
  time_to_sleep: MetricValue,    // sleep latency
  time_awake: MetricValue,       // awake during sleep
  
  // Quality metrics
  sleep_quality: MetricValue,    // 0-100 or percentage
  sleep_efficiency: MetricValue, // percentage
  
  // Sleep stages (in minutes)
  light_sleep: MetricValue,
  deep_sleep: MetricValue,
  rem_sleep: MetricValue,
  awake_time: MetricValue,
  
  // Wake ups
  wake_ups: MetricValue,         // number of times
  
  // Context
  sleep_notes: String,
  wake_mood: String,            // mood upon waking
  sleep_environment: {
    temperature: Number,
    noise_level: String,
    light_level: String
  }
};

module.exports = { SleepRecord };