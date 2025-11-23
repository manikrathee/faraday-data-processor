const { BaseRecord, MetricValue } = require('./base');

/**
 * Fitness data schema - steps, calories, workouts, distance
 */
const FitnessRecord = {
  ...BaseRecord,
  dataType: 'fitness',
  subType: String,      // 'steps', 'workout', 'calories', 'distance'
  
  // Activity metrics
  steps: MetricValue,
  calories: MetricValue,
  distance: MetricValue,
  duration: MetricValue, // in minutes
  
  // Workout specific
  workout_type: String,  // 'running', 'cycling', 'strength', etc.
  workout_name: String,
  
  // Nike+ specific
  fuel_points: MetricValue,
  
  // Location data (if available)
  location: {
    start_lat: Number,
    start_lng: Number,
    end_lat: Number,
    end_lng: Number
  },
  
  // Time period
  start_time: String,   // MM/DD/YYYY HH:MM:SS
  end_time: String      // MM/DD/YYYY HH:MM:SS
};

module.exports = { FitnessRecord };