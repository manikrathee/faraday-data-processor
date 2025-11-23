/**
 * Maps processed health records to database tables
 * Handles the transformation from JSON records to relational data
 */
class DataMapper {
  constructor(dbConnection) {
    this.db = dbConnection;
    this.preparedStatements = {};
    this.initializePreparedStatements();
  }

  /**
   * Initialize frequently used prepared statements for performance
   */
  initializePreparedStatements() {
    // Health records
    this.preparedStatements.insertHealthRecord = this.db.prepare(`
      INSERT OR REPLACE INTO health_records 
      (id, timestamp, date_only, source, data_type, sub_type, processed_at, raw_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Fitness metrics
    this.preparedStatements.insertFitnessMetric = this.db.prepare(`
      INSERT OR REPLACE INTO fitness_metrics 
      (record_id, steps, steps_unit, steps_confidence, calories, calories_unit, calories_confidence,
       distance, distance_unit, distance_confidence, duration_minutes, duration_confidence,
       workout_type, workout_name, fuel_points, fuel_confidence, start_time, end_time, activity_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Health vitals
    this.preparedStatements.insertHealthVital = this.db.prepare(`
      INSERT OR REPLACE INTO health_vitals 
      (record_id, heart_rate, heart_rate_unit, heart_rate_confidence, resting_heart_rate, 
       resting_hr_unit, resting_hr_confidence, heart_rate_variability, hrv_unit, hrv_confidence,
       systolic_bp, diastolic_bp, bp_unit, bp_confidence, glucose, glucose_unit, glucose_confidence,
       weight, weight_unit, weight_confidence, bmi, bmi_confidence, oxygen_saturation, 
       oxygen_unit, oxygen_confidence, body_temperature, temperature_unit, temperature_confidence,
       device_name, measurement_source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Sleep sessions
    this.preparedStatements.insertSleepSession = this.db.prepare(`
      INSERT OR REPLACE INTO sleep_sessions 
      (record_id, bedtime, sleep_start, sleep_end, wake_time, sleep_duration_minutes, 
       duration_confidence, time_in_bed_minutes, bed_time_confidence, sleep_efficiency, 
       efficiency_confidence, sleep_quality, quality_confidence, deep_sleep_minutes, 
       light_sleep_minutes, rem_sleep_minutes, awake_minutes, wake_ups, time_to_sleep_minutes,
       wake_mood, sleep_notes, measurement_source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Habits
    this.preparedStatements.insertHabit = this.db.prepare(`
      INSERT OR REPLACE INTO habits 
      (record_id, habit_id, habit_name, habit_category, checkin_date, checkin_count, 
       streak_days, prop_count, comment_count, completed, completion_confidence, notes, external_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Symptoms
    this.preparedStatements.insertSymptom = this.db.prepare(`
      INSERT OR REPLACE INTO symptoms 
      (record_id, condition, primary_symptom, symptoms_json, severity, severity_score, 
       severity_confidence, duration_hours, duration_confidence, pain_location, pain_intensity, 
       pain_confidence, impact_level, notes, medication_taken)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Medications
    this.preparedStatements.insertMedication = this.db.prepare(`
      INSERT OR REPLACE INTO medications 
      (record_id, medication_name, dosage_value, dosage_unit, dosage_confidence, frequency, taken_at, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }

  /**
   * Insert or update a batch of health records
   * @param {Array} records - Array of processed health records
   * @returns {Object} Insert results
   */
  insertRecords(records) {
    const results = {
      totalRecords: records.length,
      inserted: 0,
      errors: 0,
      errorDetails: []
    };

    const transaction = this.db.db.transaction((records) => {
      for (const record of records) {
        try {
          this.insertSingleRecord(record);
          results.inserted++;
        } catch (error) {
          results.errors++;
          results.errorDetails.push({
            recordId: record.id,
            error: error.message,
            record: record
          });
        }
      }
    });

    transaction(records);
    return results;
  }

  /**
   * Insert a single health record
   * @param {Object} record - Processed health record
   */
  insertSingleRecord(record) {
    // Insert base health record
    const dateOnly = this.extractDateOnly(record.timestamp);
    this.preparedStatements.insertHealthRecord.run(
      record.id,
      record.timestamp,
      dateOnly,
      record.source,
      record.dataType,
      record.subType,
      record.processed_at,
      JSON.stringify(record.raw_data || {})
    );

    // Insert type-specific data based on dataType
    switch (record.dataType) {
      case 'fitness':
        this.insertFitnessRecord(record);
        break;
      case 'health':
        this.insertHealthRecord(record);
        break;
      case 'sleep':
        this.insertSleepRecord(record);
        break;
      case 'habits':
        this.insertHabitRecord(record);
        break;
    }

    // Handle symptoms if present
    if (record.condition || record.symptoms || record.severity) {
      this.insertSymptomRecord(record);
    }

    // Handle medications if present
    if (record.medication_name) {
      this.insertMedicationRecord(record);
    }
  }

  /**
   * Insert fitness-specific data
   * @param {Object} record - Health record
   */
  insertFitnessRecord(record) {
    this.preparedStatements.insertFitnessMetric.run(
      record.id,
      this.extractMetricValue(record.steps),
      this.extractMetricUnit(record.steps, 'steps'),
      this.extractMetricConfidence(record.steps),
      this.extractMetricValue(record.calories),
      this.extractMetricUnit(record.calories, 'calories'),
      this.extractMetricConfidence(record.calories),
      this.extractMetricValue(record.distance),
      this.extractMetricUnit(record.distance),
      this.extractMetricConfidence(record.distance),
      this.extractMetricValue(record.duration),
      this.extractMetricConfidence(record.duration),
      record.workout_type || null,
      record.workout_name || null,
      this.extractMetricValue(record.fuel_points),
      this.extractMetricConfidence(record.fuel_points),
      record.start_time || null,
      record.end_time || null,
      record.activity_id || record.workout_id || null
    );
  }

  /**
   * Insert health vitals data
   * @param {Object} record - Health record
   */
  insertHealthRecord(record) {
    // Handle blood pressure object
    const systolicBP = record.blood_pressure?.systolic ? 
      this.extractMetricValue(record.blood_pressure.systolic) : null;
    const diastolicBP = record.blood_pressure?.diastolic ? 
      this.extractMetricValue(record.blood_pressure.diastolic) : null;
    const bpUnit = record.blood_pressure?.systolic ? 
      this.extractMetricUnit(record.blood_pressure.systolic, 'mmHg') : 'mmHg';
    const bpConfidence = record.blood_pressure?.systolic ? 
      this.extractMetricConfidence(record.blood_pressure.systolic) : null;

    this.preparedStatements.insertHealthVital.run(
      record.id,
      this.extractMetricValue(record.heart_rate),
      this.extractMetricUnit(record.heart_rate, 'bpm'),
      this.extractMetricConfidence(record.heart_rate),
      this.extractMetricValue(record.resting_heart_rate),
      this.extractMetricUnit(record.resting_heart_rate, 'bpm'),
      this.extractMetricConfidence(record.resting_heart_rate),
      this.extractMetricValue(record.heart_rate_variability),
      this.extractMetricUnit(record.heart_rate_variability, 'ms'),
      this.extractMetricConfidence(record.heart_rate_variability),
      systolicBP,
      diastolicBP,
      bpUnit,
      bpConfidence,
      this.extractMetricValue(record.glucose),
      this.extractMetricUnit(record.glucose, 'mg/dL'),
      this.extractMetricConfidence(record.glucose),
      this.extractMetricValue(record.weight),
      this.extractMetricUnit(record.weight),
      this.extractMetricConfidence(record.weight),
      this.extractMetricValue(record.bmi),
      this.extractMetricConfidence(record.bmi),
      this.extractMetricValue(record.oxygen_saturation),
      this.extractMetricUnit(record.oxygen_saturation, 'percent'),
      this.extractMetricConfidence(record.oxygen_saturation),
      this.extractMetricValue(record.body_temperature),
      this.extractMetricUnit(record.body_temperature),
      this.extractMetricConfidence(record.body_temperature),
      record.device_name || null,
      record.measurement_source || null
    );
  }

  /**
   * Insert sleep session data
   * @param {Object} record - Health record
   */
  insertSleepRecord(record) {
    this.preparedStatements.insertSleepSession.run(
      record.id,
      record.bedtime || null,
      record.sleep_start || null,
      record.sleep_end || null,
      record.wake_time || null,
      this.extractMetricValue(record.sleep_duration),
      this.extractMetricConfidence(record.sleep_duration),
      this.extractMetricValue(record.time_in_bed),
      this.extractMetricConfidence(record.time_in_bed),
      this.extractMetricValue(record.sleep_efficiency),
      this.extractMetricConfidence(record.sleep_efficiency),
      this.extractMetricValue(record.sleep_quality),
      this.extractMetricConfidence(record.sleep_quality),
      this.extractMetricValue(record.deep_sleep),
      this.extractMetricValue(record.light_sleep),
      this.extractMetricValue(record.rem_sleep),
      this.extractMetricValue(record.awake_time || record.awake_minutes),
      this.extractMetricValue(record.wake_ups),
      this.extractMetricValue(record.time_to_sleep),
      record.wake_mood || null,
      record.sleep_notes || null,
      record.measurement_source || null
    );
  }

  /**
   * Insert habit tracking data
   * @param {Object} record - Health record
   */
  insertHabitRecord(record) {
    this.preparedStatements.insertHabit.run(
      record.id,
      record.habit_id || null,
      record.habit_name || 'Unknown',
      record.habit_category || 'other',
      record.checkin_date || this.extractDateOnly(record.timestamp),
      this.extractMetricValue(record.checkin_count) || 1,
      this.extractMetricValue(record.streak_days) || 0,
      this.extractMetricValue(record.prop_count) || 0,
      this.extractMetricValue(record.comment_count) || 0,
      record.completed !== undefined ? record.completed : true,
      this.extractMetricConfidence(record.completion_confidence) || 1.0,
      record.notes || null,
      record.coach_me_url || record.external_url || null
    );
  }

  /**
   * Insert symptom/condition data
   * @param {Object} record - Health record
   */
  insertSymptomRecord(record) {
    const symptoms = record.symptoms ? JSON.stringify(record.symptoms) : null;
    
    this.preparedStatements.insertSymptom.run(
      record.id,
      record.condition || null,
      record.primary_symptom || null,
      symptoms,
      record.severity || null,
      this.extractMetricValue(record.severity_score),
      this.extractMetricConfidence(record.severity_score),
      this.extractMetricValue(record.duration),
      this.extractMetricConfidence(record.duration),
      record.pain_location || null,
      this.extractMetricValue(record.pain_intensity),
      this.extractMetricConfidence(record.pain_intensity),
      record.impact_level || record.severity || null,
      record.notes || null,
      record.medication_taken || false
    );
  }

  /**
   * Insert medication data
   * @param {Object} record - Health record
   */
  insertMedicationRecord(record) {
    this.preparedStatements.insertMedication.run(
      record.id,
      record.medication_name,
      this.extractMetricValue(record.dosage),
      this.extractMetricUnit(record.dosage),
      this.extractMetricConfidence(record.dosage),
      record.frequency || null,
      record.timestamp, // when medication was logged
      record.notes || null
    );
  }

  /**
   * Extract date-only part from timestamp
   * @param {string} timestamp - Full timestamp
   * @returns {string} Date in MM/DD/YYYY format
   */
  extractDateOnly(timestamp) {
    if (!timestamp) return null;
    return timestamp.split(' ')[0]; // Assumes MM/DD/YYYY HH:MM:SS format
  }

  /**
   * Extract numeric value from metric object
   * @param {Object} metric - Metric object with value, unit, confidence
   * @returns {number|null} Numeric value or null
   */
  extractMetricValue(metric) {
    if (!metric) return null;
    if (typeof metric === 'number') return metric;
    if (typeof metric === 'object' && metric.value !== undefined) {
      return metric.value;
    }
    return null;
  }

  /**
   * Extract unit from metric object
   * @param {Object} metric - Metric object
   * @param {string} defaultUnit - Default unit if not specified
   * @returns {string|null} Unit string or null
   */
  extractMetricUnit(metric, defaultUnit = null) {
    if (!metric) return defaultUnit;
    if (typeof metric === 'object' && metric.unit) {
      return metric.unit;
    }
    return defaultUnit;
  }

  /**
   * Extract confidence score from metric object
   * @param {Object} metric - Metric object
   * @returns {number|null} Confidence score 0-1 or null
   */
  extractMetricConfidence(metric) {
    if (!metric) return null;
    if (typeof metric === 'object' && metric.confidence !== undefined) {
      return metric.confidence;
    }
    return 1.0; // Default confidence
  }

  /**
   * Check if a record already exists in the database
   * @param {string} recordId - Record ID to check
   * @returns {boolean} True if record exists
   */
  recordExists(recordId) {
    const result = this.db.queryOne(
      'SELECT id FROM health_records WHERE id = ?', 
      [recordId]
    );
    return !!result;
  }

  /**
   * Get records by date range
   * @param {string} startDate - Start date (MM/DD/YYYY)
   * @param {string} endDate - End date (MM/DD/YYYY)
   * @returns {Array} Health records in date range
   */
  getRecordsByDateRange(startDate, endDate) {
    return this.db.query(`
      SELECT hr.*, 
             fm.steps, fm.calories, fm.distance, fm.workout_type,
             hv.heart_rate, hv.blood_pressure, hv.glucose,
             ss.sleep_duration_minutes, ss.sleep_quality,
             h.habit_name, h.streak_days,
             s.condition, s.severity_score
      FROM health_records hr
      LEFT JOIN fitness_metrics fm ON hr.id = fm.record_id
      LEFT JOIN health_vitals hv ON hr.id = hv.record_id  
      LEFT JOIN sleep_sessions ss ON hr.id = ss.record_id
      LEFT JOIN habits h ON hr.id = h.record_id
      LEFT JOIN symptoms s ON hr.id = s.record_id
      WHERE hr.date_only BETWEEN ? AND ?
      ORDER BY hr.timestamp
    `, [startDate, endDate]);
  }

  /**
   * Delete records by source (for reprocessing)
   * @param {string} source - Source name to delete
   * @returns {Object} Deletion results
   */
  deleteBySource(source) {
    const transaction = this.db.db.transaction((source) => {
      // Get record IDs first
      const recordIds = this.db.query(
        'SELECT id FROM health_records WHERE source = ?', 
        [source]
      ).map(row => row.id);

      // Delete from related tables
      const tables = ['fitness_metrics', 'health_vitals', 'sleep_sessions', 'habits', 'symptoms', 'medications'];
      let deletedRelated = 0;
      
      for (const table of tables) {
        for (const recordId of recordIds) {
          const result = this.db.execute(`DELETE FROM ${table} WHERE record_id = ?`, [recordId]);
          deletedRelated += result.changes;
        }
      }

      // Delete from health_records
      const result = this.db.execute('DELETE FROM health_records WHERE source = ?', [source]);
      
      return {
        deletedRecords: result.changes,
        deletedRelated: deletedRelated
      };
    });

    return transaction(source);
  }
}

module.exports = DataMapper;