/**
 * Maps processed health records to MySQL database tables
 * Handles the transformation from JSON records to relational data
 */
class MySQLDataMapper {
  constructor(dbConnection) {
    this.db = dbConnection;
    this.batchSize = 1000;
  }

  /**
   * Insert multiple records efficiently using batch processing
   * @param {Array} records - Array of processed health records
   * @returns {Object} Insert results
   */
  async insertRecords(records) {
    const results = {
      totalRecords: records.length,
      inserted: 0,
      errors: 0,
      errorDetails: []
    };

    if (records.length === 0) return results;

    try {
      await this.db.transaction(async (connection) => {
        // Process records in batches
        for (let i = 0; i < records.length; i += this.batchSize) {
          const batch = records.slice(i, i + this.batchSize);
          const batchResults = await this.insertRecordBatch(batch, connection);
          
          results.inserted += batchResults.inserted;
          results.errors += batchResults.errors;
          results.errorDetails.push(...batchResults.errorDetails);
        }
      });

    } catch (error) {
      console.error('Transaction failed:', error);
      results.errors = records.length;
      results.errorDetails.push({ error: error.message, recordCount: records.length });
    }

    return results;
  }

  /**
   * Insert a batch of records
   * @param {Array} records - Batch of records to insert
   * @param {Object} connection - MySQL connection
   * @returns {Object} Batch results
   */
  async insertRecordBatch(records, connection) {
    const results = { inserted: 0, errors: 0, errorDetails: [] };
    
    // Separate records by type for batch insertion
    const healthRecords = [];
    const fitnessRecords = [];
    const healthVitalRecords = [];
    const sleepRecords = [];
    const locationRecords = [];

    // Categorize records
    for (const record of records) {
      healthRecords.push(this.mapToHealthRecord(record));
      
      switch (record.dataType) {
        case 'fitness':
          const fitnessData = this.mapToFitnessMetric(record);
          if (fitnessData) fitnessRecords.push(fitnessData);
          break;
        case 'health':
          const healthData = this.mapToHealthVital(record);
          if (healthData) healthVitalRecords.push(healthData);
          break;
        case 'sleep':
          const sleepData = this.mapToSleepSession(record);
          if (sleepData) sleepRecords.push(sleepData);
          break;
        case 'location':
          const locationData = this.mapToLocationData(record);
          if (locationData) locationRecords.push(locationData);
          break;
      }
    }

    try {
      // Insert health records first (parent table)
      if (healthRecords.length > 0) {
        await this.batchInsertHealthRecords(healthRecords, connection);
        results.inserted += healthRecords.length;
      }

      // Insert related records
      if (fitnessRecords.length > 0) {
        await this.batchInsertFitnessMetrics(fitnessRecords, connection);
      }
      if (healthVitalRecords.length > 0) {
        await this.batchInsertHealthVitals(healthVitalRecords, connection);
      }
      if (sleepRecords.length > 0) {
        await this.batchInsertSleepSessions(sleepRecords, connection);
      }
      if (locationRecords.length > 0) {
        await this.batchInsertLocationData(locationRecords, connection);
      }

    } catch (error) {
      console.error('Batch insert failed:', error);
      results.errors = records.length;
      results.errorDetails.push({ error: error.message, batchSize: records.length });
    }

    return results;
  }

  /**
   * Map record to health_records table format
   */
  mapToHealthRecord(record) {
    return {
      id: record.id,
      timestamp: record.timestamp,
      date_only: record.timestamp ? record.timestamp.split(' ')[0] : null,
      source: record.source,
      data_type: record.dataType,
      sub_type: record.subType,
      processed_at: record.processed_at,
      raw_data: JSON.stringify(record.raw_data || {})
    };
  }

  /**
   * Map record to fitness_metrics table format
   */
  mapToFitnessMetric(record) {
    const fitness = {};
    let hasData = false;

    // Map various fitness fields
    if (record.steps) {
      fitness.steps = record.steps.value;
      fitness.steps_unit = record.steps.unit;
      fitness.steps_confidence = record.steps.confidence;
      hasData = true;
    }

    if (record.calories) {
      fitness.calories = record.calories.value;
      fitness.calories_unit = record.calories.unit;
      fitness.calories_confidence = record.calories.confidence;
      hasData = true;
    }

    if (record.distance) {
      fitness.distance = record.distance.value;
      fitness.distance_unit = record.distance.unit;
      fitness.distance_confidence = record.distance.confidence;
      hasData = true;
    }

    if (record.duration) {
      fitness.duration = record.duration.value;
      fitness.duration_unit = record.duration.unit;
      fitness.duration_confidence = record.duration.confidence;
      hasData = true;
    }

    if (record.workout_type) {
      fitness.workout_type = record.workout_type;
      hasData = true;
    }

    if (record.workout_name) {
      fitness.workout_name = record.workout_name;
      hasData = true;
    }

    if (record.measurement_source) {
      fitness.measurement_source = record.measurement_source;
    }

    return hasData ? { record_id: record.id, ...fitness } : null;
  }

  /**
   * Map record to health_vitals table format
   */
  mapToHealthVital(record) {
    const vital = {};
    let hasData = false;

    // Map various health vitals
    if (record.heart_rate) {
      vital.heart_rate = record.heart_rate.value;
      vital.heart_rate_unit = record.heart_rate.unit;
      vital.heart_rate_confidence = record.heart_rate.confidence;
      hasData = true;
    }

    if (record.resting_heart_rate) {
      vital.resting_heart_rate = record.resting_heart_rate.value;
      vital.resting_heart_rate_unit = record.resting_heart_rate.unit;
      vital.resting_heart_rate_confidence = record.resting_heart_rate.confidence;
      hasData = true;
    }

    if (record.blood_pressure) {
      if (record.blood_pressure.systolic) {
        vital.blood_pressure_systolic = record.blood_pressure.systolic.value;
        vital.blood_pressure_unit = record.blood_pressure.systolic.unit;
        vital.blood_pressure_confidence = record.blood_pressure.systolic.confidence;
        hasData = true;
      }
      if (record.blood_pressure.diastolic) {
        vital.blood_pressure_diastolic = record.blood_pressure.diastolic.value;
        vital.blood_pressure_unit = record.blood_pressure.diastolic.unit;
        vital.blood_pressure_confidence = record.blood_pressure.diastolic.confidence;
        hasData = true;
      }
    }

    if (record.glucose) {
      vital.glucose = record.glucose.value;
      vital.glucose_unit = record.glucose.unit;
      vital.glucose_confidence = record.glucose.confidence;
      hasData = true;
    }

    if (record.weight) {
      vital.weight = record.weight.value;
      vital.weight_unit = record.weight.unit;
      vital.weight_confidence = record.weight.confidence;
      hasData = true;
    }

    if (record.body_temperature) {
      vital.body_temperature = record.body_temperature.value;
      vital.body_temperature_unit = record.body_temperature.unit;
      vital.body_temperature_confidence = record.body_temperature.confidence;
      hasData = true;
    }

    if (record.oxygen_saturation) {
      vital.oxygen_saturation = record.oxygen_saturation.value;
      vital.oxygen_saturation_unit = record.oxygen_saturation.unit;
      vital.oxygen_saturation_confidence = record.oxygen_saturation.confidence;
      hasData = true;
    }

    if (record.measurement_source) {
      vital.measurement_source = record.measurement_source;
    }

    return hasData ? { record_id: record.id, ...vital } : null;
  }

  /**
   * Map record to sleep_sessions table format
   */
  mapToSleepSession(record) {
    const sleep = {};
    let hasData = false;

    if (record.sleep_start) {
      sleep.sleep_start = record.sleep_start;
      hasData = true;
    }

    if (record.sleep_end) {
      sleep.sleep_end = record.sleep_end;
      hasData = true;
    }

    if (record.sleep_duration) {
      sleep.sleep_duration = record.sleep_duration.value;
      sleep.sleep_duration_unit = record.sleep_duration.unit;
      sleep.sleep_duration_confidence = record.sleep_duration.confidence;
      hasData = true;
    }

    if (record.sleep_quality) {
      sleep.sleep_quality = record.sleep_quality;
      hasData = true;
    }

    if (record.measurement_source) {
      sleep.measurement_source = record.measurement_source;
    }

    return hasData ? { record_id: record.id, ...sleep } : null;
  }

  /**
   * Map record to location_data table format
   */
  mapToLocationData(record) {
    const location = {};
    let hasData = false;

    if (record.location) {
      if (record.location.latitude !== null) {
        location.latitude = record.location.latitude;
        hasData = true;
      }
      if (record.location.longitude !== null) {
        location.longitude = record.location.longitude;
        hasData = true;
      }
      if (record.location.name) {
        location.location_name = record.location.name;
        hasData = true;
      }
    }

    if (record.visit_start) {
      location.visit_start = record.visit_start;
      hasData = true;
    }

    if (record.visit_end) {
      location.visit_end = record.visit_end;
      hasData = true;
    }

    if (record.visit_duration) {
      location.visit_duration = record.visit_duration.value;
      location.visit_duration_unit = record.visit_duration.unit;
      location.visit_duration_confidence = record.visit_duration.confidence;
      hasData = true;
    }

    if (record.measurement_source) {
      location.measurement_source = record.measurement_source;
    }

    return hasData ? { record_id: record.id, ...location } : null;
  }

  /**
   * Batch insert health records
   */
  async batchInsertHealthRecords(records, connection) {
    if (records.length === 0) return;

    const placeholders = records.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const sql = `
      INSERT INTO health_records 
      (id, timestamp, date_only, source, data_type, sub_type, processed_at, raw_data)
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE
        timestamp = VALUES(timestamp),
        date_only = VALUES(date_only),
        processed_at = VALUES(processed_at),
        raw_data = VALUES(raw_data)
    `;

    const values = records.flatMap(record => [
      record.id, record.timestamp, record.date_only, record.source,
      record.data_type, record.sub_type, record.processed_at, record.raw_data
    ]);

    await connection.execute(sql, values);
  }

  /**
   * Batch insert fitness metrics
   */
  async batchInsertFitnessMetrics(records, connection) {
    if (records.length === 0) return;

    const placeholders = records.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const sql = `
      INSERT INTO fitness_metrics 
      (record_id, steps, steps_unit, steps_confidence, calories, calories_unit, calories_confidence,
       distance, distance_unit, distance_confidence, duration, duration_unit, duration_confidence,
       workout_type, workout_name, measurement_source)
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE
        steps = VALUES(steps),
        calories = VALUES(calories),
        distance = VALUES(distance),
        duration = VALUES(duration),
        workout_type = VALUES(workout_type),
        workout_name = VALUES(workout_name)
    `;

    const values = records.flatMap(record => [
      record.record_id, record.steps, record.steps_unit, record.steps_confidence,
      record.calories, record.calories_unit, record.calories_confidence,
      record.distance, record.distance_unit, record.distance_confidence,
      record.duration, record.duration_unit, record.duration_confidence,
      record.workout_type, record.workout_name, record.measurement_source
    ]);

    await connection.execute(sql, values);
  }

  /**
   * Batch insert health vitals
   */
  async batchInsertHealthVitals(records, connection) {
    if (records.length === 0) return;

    const placeholders = records.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const sql = `
      INSERT INTO health_vitals 
      (record_id, heart_rate, heart_rate_unit, heart_rate_confidence, resting_heart_rate, 
       resting_heart_rate_unit, resting_heart_rate_confidence, blood_pressure_systolic, 
       blood_pressure_diastolic, blood_pressure_unit, blood_pressure_confidence, glucose, 
       glucose_unit, glucose_confidence, weight, weight_unit, weight_confidence, 
       body_temperature, body_temperature_unit, body_temperature_confidence, measurement_source)
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE
        heart_rate = VALUES(heart_rate),
        resting_heart_rate = VALUES(resting_heart_rate),
        blood_pressure_systolic = VALUES(blood_pressure_systolic),
        blood_pressure_diastolic = VALUES(blood_pressure_diastolic),
        glucose = VALUES(glucose),
        weight = VALUES(weight),
        body_temperature = VALUES(body_temperature)
    `;

    const values = records.flatMap(record => [
      record.record_id, record.heart_rate, record.heart_rate_unit, record.heart_rate_confidence,
      record.resting_heart_rate, record.resting_heart_rate_unit, record.resting_heart_rate_confidence,
      record.blood_pressure_systolic, record.blood_pressure_diastolic, record.blood_pressure_unit, 
      record.blood_pressure_confidence, record.glucose, record.glucose_unit, record.glucose_confidence,
      record.weight, record.weight_unit, record.weight_confidence, record.body_temperature, 
      record.body_temperature_unit, record.body_temperature_confidence, record.measurement_source
    ]);

    await connection.execute(sql, values);
  }

  /**
   * Batch insert sleep sessions
   */
  async batchInsertSleepSessions(records, connection) {
    if (records.length === 0) return;

    const placeholders = records.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
    const sql = `
      INSERT INTO sleep_sessions 
      (record_id, sleep_start, sleep_end, sleep_duration, sleep_duration_unit, 
       sleep_duration_confidence, sleep_quality, measurement_source)
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE
        sleep_start = VALUES(sleep_start),
        sleep_end = VALUES(sleep_end),
        sleep_duration = VALUES(sleep_duration),
        sleep_quality = VALUES(sleep_quality)
    `;

    const values = records.flatMap(record => [
      record.record_id, record.sleep_start, record.sleep_end, record.sleep_duration,
      record.sleep_duration_unit, record.sleep_duration_confidence, 
      record.sleep_quality, record.measurement_source
    ]);

    await connection.execute(sql, values);
  }

  /**
   * Batch insert location data
   */
  async batchInsertLocationData(records, connection) {
    if (records.length === 0) return;

    const placeholders = records.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const sql = `
      INSERT INTO location_data 
      (record_id, latitude, longitude, location_name, visit_start, visit_end, 
       visit_duration, visit_duration_unit, visit_duration_confidence, measurement_source)
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE
        latitude = VALUES(latitude),
        longitude = VALUES(longitude),
        location_name = VALUES(location_name),
        visit_start = VALUES(visit_start),
        visit_end = VALUES(visit_end),
        visit_duration = VALUES(visit_duration)
    `;

    const values = records.flatMap(record => [
      record.record_id, record.latitude, record.longitude, record.location_name,
      record.visit_start, record.visit_end, record.visit_duration, 
      record.visit_duration_unit, record.visit_duration_confidence, record.measurement_source
    ]);

    await connection.execute(sql, values);
  }
}

module.exports = MySQLDataMapper;