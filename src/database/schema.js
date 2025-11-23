/**
 * Database schema definitions for health data storage
 * Supports multiple data types with normalized structure
 */

class DatabaseSchema {
  constructor() {
    this.tables = this.defineSchemas();
  }

  /**
   * Define all database table schemas
   * @returns {Object} Schema definitions
   */
  defineSchemas() {
    return {
      // Base health records table
      health_records: {
        name: 'health_records',
        columns: {
          id: 'TEXT PRIMARY KEY',
          timestamp: 'TEXT NOT NULL',
          date_only: 'TEXT NOT NULL', // For easy date filtering
          source: 'TEXT NOT NULL',
          data_type: 'TEXT NOT NULL',
          sub_type: 'TEXT',
          processed_at: 'TEXT NOT NULL',
          raw_data: 'TEXT', // JSON string of original data
          created_at: 'DATETIME DEFAULT CURRENT_TIMESTAMP'
        },
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_health_records_timestamp ON health_records(timestamp)',
          'CREATE INDEX IF NOT EXISTS idx_health_records_source ON health_records(source)',
          'CREATE INDEX IF NOT EXISTS idx_health_records_data_type ON health_records(data_type)',
          'CREATE INDEX IF NOT EXISTS idx_health_records_date_only ON health_records(date_only)',
          'CREATE INDEX IF NOT EXISTS idx_health_records_source_type ON health_records(source, data_type)'
        ]
      },

      // Fitness metrics (steps, calories, distance, workouts)
      fitness_metrics: {
        name: 'fitness_metrics',
        columns: {
          record_id: 'TEXT PRIMARY KEY REFERENCES health_records(id)',
          steps: 'INTEGER',
          steps_unit: 'TEXT DEFAULT "steps"',
          steps_confidence: 'REAL DEFAULT 1.0',
          calories: 'REAL',
          calories_unit: 'TEXT DEFAULT "calories"',
          calories_confidence: 'REAL DEFAULT 1.0',
          distance: 'REAL',
          distance_unit: 'TEXT',
          distance_confidence: 'REAL DEFAULT 1.0',
          duration_minutes: 'REAL',
          duration_confidence: 'REAL DEFAULT 1.0',
          workout_type: 'TEXT',
          workout_name: 'TEXT',
          fuel_points: 'INTEGER',
          fuel_confidence: 'REAL DEFAULT 1.0',
          start_time: 'TEXT',
          end_time: 'TEXT',
          activity_id: 'TEXT' // For linking related activities
        },
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_fitness_metrics_workout_type ON fitness_metrics(workout_type)',
          'CREATE INDEX IF NOT EXISTS idx_fitness_metrics_activity_id ON fitness_metrics(activity_id)'
        ]
      },

      // Health vitals (heart rate, blood pressure, glucose, weight)
      health_vitals: {
        name: 'health_vitals',
        columns: {
          record_id: 'TEXT PRIMARY KEY REFERENCES health_records(id)',
          heart_rate: 'INTEGER',
          heart_rate_unit: 'TEXT DEFAULT "bpm"',
          heart_rate_confidence: 'REAL DEFAULT 1.0',
          resting_heart_rate: 'INTEGER',
          resting_hr_unit: 'TEXT DEFAULT "bpm"',
          resting_hr_confidence: 'REAL DEFAULT 1.0',
          heart_rate_variability: 'REAL',
          hrv_unit: 'TEXT DEFAULT "ms"',
          hrv_confidence: 'REAL DEFAULT 1.0',
          systolic_bp: 'INTEGER',
          diastolic_bp: 'INTEGER',
          bp_unit: 'TEXT DEFAULT "mmHg"',
          bp_confidence: 'REAL DEFAULT 1.0',
          glucose: 'REAL',
          glucose_unit: 'TEXT DEFAULT "mg/dL"',
          glucose_confidence: 'REAL DEFAULT 1.0',
          weight: 'REAL',
          weight_unit: 'TEXT',
          weight_confidence: 'REAL DEFAULT 1.0',
          bmi: 'REAL',
          bmi_confidence: 'REAL DEFAULT 1.0',
          oxygen_saturation: 'REAL',
          oxygen_unit: 'TEXT DEFAULT "percent"',
          oxygen_confidence: 'REAL DEFAULT 1.0',
          body_temperature: 'REAL',
          temperature_unit: 'TEXT',
          temperature_confidence: 'REAL DEFAULT 1.0',
          device_name: 'TEXT',
          measurement_source: 'TEXT'
        },
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_health_vitals_device ON health_vitals(device_name)',
          'CREATE INDEX IF NOT EXISTS idx_health_vitals_source ON health_vitals(measurement_source)'
        ]
      },

      // Sleep data
      sleep_sessions: {
        name: 'sleep_sessions',
        columns: {
          record_id: 'TEXT PRIMARY KEY REFERENCES health_records(id)',
          bedtime: 'TEXT',
          sleep_start: 'TEXT',
          sleep_end: 'TEXT',
          wake_time: 'TEXT',
          sleep_duration_minutes: 'REAL',
          duration_confidence: 'REAL DEFAULT 1.0',
          time_in_bed_minutes: 'REAL',
          bed_time_confidence: 'REAL DEFAULT 1.0',
          sleep_efficiency: 'REAL', // percentage
          efficiency_confidence: 'REAL DEFAULT 1.0',
          sleep_quality: 'REAL', // 0-100 or percentage
          quality_confidence: 'REAL DEFAULT 1.0',
          deep_sleep_minutes: 'REAL',
          light_sleep_minutes: 'REAL',
          rem_sleep_minutes: 'REAL',
          awake_minutes: 'REAL',
          wake_ups: 'INTEGER',
          time_to_sleep_minutes: 'REAL', // sleep latency
          wake_mood: 'TEXT',
          sleep_notes: 'TEXT',
          measurement_source: 'TEXT'
        },
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_sleep_sessions_start ON sleep_sessions(sleep_start)',
          'CREATE INDEX IF NOT EXISTS idx_sleep_sessions_duration ON sleep_sessions(sleep_duration_minutes)',
          'CREATE INDEX IF NOT EXISTS idx_sleep_sessions_quality ON sleep_sessions(sleep_quality)'
        ]
      },

      // Habit tracking
      habits: {
        name: 'habits',
        columns: {
          record_id: 'TEXT PRIMARY KEY REFERENCES health_records(id)',
          habit_id: 'TEXT',
          habit_name: 'TEXT NOT NULL',
          habit_category: 'TEXT',
          checkin_date: 'TEXT',
          checkin_count: 'INTEGER DEFAULT 1',
          streak_days: 'INTEGER DEFAULT 0',
          prop_count: 'INTEGER DEFAULT 0',
          comment_count: 'INTEGER DEFAULT 0',
          completed: 'BOOLEAN DEFAULT 1',
          completion_confidence: 'REAL DEFAULT 1.0',
          notes: 'TEXT',
          external_url: 'TEXT'
        },
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_habits_name ON habits(habit_name)',
          'CREATE INDEX IF NOT EXISTS idx_habits_category ON habits(habit_category)',
          'CREATE INDEX IF NOT EXISTS idx_habits_checkin_date ON habits(checkin_date)',
          'CREATE INDEX IF NOT EXISTS idx_habits_streak ON habits(streak_days)'
        ]
      },

      // Symptoms and manual health tracking
      symptoms: {
        name: 'symptoms',
        columns: {
          record_id: 'TEXT PRIMARY KEY REFERENCES health_records(id)',
          condition: 'TEXT', // e.g., 'migraine', 'pain', 'mood'
          primary_symptom: 'TEXT',
          symptoms_json: 'TEXT', // JSON array of symptoms
          severity: 'TEXT',
          severity_score: 'REAL',
          severity_confidence: 'REAL DEFAULT 1.0',
          duration_hours: 'REAL',
          duration_confidence: 'REAL DEFAULT 1.0',
          pain_location: 'TEXT',
          pain_intensity: 'REAL',
          pain_confidence: 'REAL DEFAULT 1.0',
          impact_level: 'TEXT',
          notes: 'TEXT',
          medication_taken: 'BOOLEAN DEFAULT 0'
        },
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_symptoms_condition ON symptoms(condition)',
          'CREATE INDEX IF NOT EXISTS idx_symptoms_severity ON symptoms(severity_score)',
          'CREATE INDEX IF NOT EXISTS idx_symptoms_duration ON symptoms(duration_hours)'
        ]
      },

      // Medications
      medications: {
        name: 'medications',
        columns: {
          record_id: 'TEXT PRIMARY KEY REFERENCES health_records(id)',
          medication_name: 'TEXT NOT NULL',
          dosage_value: 'REAL',
          dosage_unit: 'TEXT',
          dosage_confidence: 'REAL DEFAULT 1.0',
          frequency: 'TEXT',
          taken_at: 'TEXT', // when medication was taken
          notes: 'TEXT'
        },
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_medications_name ON medications(medication_name)',
          'CREATE INDEX IF NOT EXISTS idx_medications_taken ON medications(taken_at)'
        ]
      },

      // Location data (for future Moves app support)
      locations: {
        name: 'locations',
        columns: {
          record_id: 'TEXT PRIMARY KEY REFERENCES health_records(id)',
          start_latitude: 'REAL',
          start_longitude: 'REAL',
          end_latitude: 'REAL',
          end_longitude: 'REAL',
          location_name: 'TEXT',
          activity_type: 'TEXT',
          distance_km: 'REAL'
        },
        indexes: [
          'CREATE INDEX IF NOT EXISTS idx_locations_coords ON locations(start_latitude, start_longitude)'
        ]
      }
    };
  }

  /**
   * Get SQL for creating a specific table
   * @param {string} tableName - Name of the table
   * @returns {string} CREATE TABLE SQL
   */
  getCreateTableSQL(tableName) {
    const table = this.tables[tableName];
    if (!table) {
      throw new Error(`Table ${tableName} not found in schema`);
    }

    const columns = Object.entries(table.columns)
      .map(([name, definition]) => `${name} ${definition}`)
      .join(',\n  ');

    return `CREATE TABLE IF NOT EXISTS ${table.name} (\n  ${columns}\n)`;
  }

  /**
   * Get all table creation SQL statements
   * @returns {string[]} Array of CREATE TABLE statements
   */
  getAllCreateTableSQL() {
    return Object.keys(this.tables).map(tableName => 
      this.getCreateTableSQL(tableName)
    );
  }

  /**
   * Get index creation SQL for a table
   * @param {string} tableName - Name of the table
   * @returns {string[]} Array of CREATE INDEX statements
   */
  getCreateIndexSQL(tableName) {
    const table = this.tables[tableName];
    return table.indexes || [];
  }

  /**
   * Get all index creation SQL statements
   * @returns {string[]} Array of CREATE INDEX statements
   */
  getAllCreateIndexSQL() {
    const indexes = [];
    Object.keys(this.tables).forEach(tableName => {
      indexes.push(...this.getCreateIndexSQL(tableName));
    });
    return indexes;
  }

  /**
   * Get table names in dependency order (base tables first)
   * @returns {string[]} Ordered table names
   */
  getTableCreationOrder() {
    return [
      'health_records',
      'fitness_metrics',
      'health_vitals', 
      'sleep_sessions',
      'habits',
      'symptoms',
      'medications',
      'locations'
    ];
  }
}

module.exports = DatabaseSchema;