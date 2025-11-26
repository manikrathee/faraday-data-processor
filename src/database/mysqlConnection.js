const mysql = require('mysql2/promise');
const fs = require('fs-extra');
const path = require('path');

/**
 * MySQL database connection and query utilities
 * Provides similar interface to SQLite connection for consistency
 */
class MySQLConnection {
  constructor(options = {}) {
    this.config = {
      host: options.host || process.env.MYSQL_HOST || 'localhost',
      port: options.port || process.env.MYSQL_PORT || 3306,
      user: options.user || process.env.MYSQL_USER || 'root',
      password: options.password || process.env.MYSQL_PASSWORD || '',
      database: options.database || process.env.MYSQL_DATABASE || 'faraday_health_data',
      charset: 'utf8mb4',
      acquireTimeout: 60000,
      timeout: 60000,
      reconnect: true,
      ...options
    };
    
    this.pool = null;
    this.isConnected = false;
    this.dbName = this.config.database;
  }

  /**
   * Connect to MySQL database and ensure database exists
   */
  async connect() {
    try {
      // First connect without database to create it if needed
      const tempConfig = { ...this.config };
      delete tempConfig.database;
      
      const tempConnection = await mysql.createConnection(tempConfig);
      
      // Create database if it doesn't exist
      await tempConnection.execute(`CREATE DATABASE IF NOT EXISTS \`${this.dbName}\``);
      await tempConnection.end();
      
      // Now connect to the specific database
      this.pool = mysql.createPool(this.config);
      this.isConnected = true;
      
      console.log(`🗄️  Connected to MySQL database: ${this.config.host}:${this.config.port}/${this.dbName}`);
    } catch (error) {
      console.error('Failed to connect to MySQL:', error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      console.log('🗄️  MySQL connection closed');
    }
  }

  /**
   * Create all database tables and indexes
   */
  async createTables() {
    if (!this.isConnected) {
      await this.connect();
    }

    console.log('🗄️  Creating MySQL database tables...');

    // Main health records table
    await this.execute(`
      CREATE TABLE IF NOT EXISTS health_records (
        id VARCHAR(36) PRIMARY KEY,
        timestamp DATETIME NOT NULL,
        date_only DATE NOT NULL,
        source VARCHAR(100) NOT NULL,
        data_type VARCHAR(50) NOT NULL,
        sub_type VARCHAR(100),
        processed_at DATETIME NOT NULL,
        raw_data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_timestamp (timestamp),
        INDEX idx_source (source),
        INDEX idx_data_type (data_type),
        INDEX idx_date_only (date_only),
        INDEX idx_source_type (source, data_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created table: health_records');

    // Fitness metrics table
    await this.execute(`
      CREATE TABLE IF NOT EXISTS fitness_metrics (
        record_id VARCHAR(36) PRIMARY KEY,
        steps INT,
        steps_unit VARCHAR(20) DEFAULT 'steps',
        steps_confidence DECIMAL(3,2) DEFAULT 1.0,
        calories DECIMAL(10,2),
        calories_unit VARCHAR(20) DEFAULT 'calories', 
        calories_confidence DECIMAL(3,2) DEFAULT 1.0,
        distance DECIMAL(10,3),
        distance_unit VARCHAR(20) DEFAULT 'miles',
        distance_confidence DECIMAL(3,2) DEFAULT 1.0,
        duration INT,
        duration_unit VARCHAR(20) DEFAULT 'minutes',
        duration_confidence DECIMAL(3,2) DEFAULT 1.0,
        workout_type VARCHAR(100),
        workout_name VARCHAR(200),
        measurement_source VARCHAR(100),
        
        FOREIGN KEY (record_id) REFERENCES health_records(id) ON DELETE CASCADE,
        INDEX idx_workout_type (workout_type),
        INDEX idx_measurement_source (measurement_source)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created table: fitness_metrics');

    // Health vitals table
    await this.execute(`
      CREATE TABLE IF NOT EXISTS health_vitals (
        record_id VARCHAR(36) PRIMARY KEY,
        heart_rate INT,
        heart_rate_unit VARCHAR(20) DEFAULT 'bpm',
        heart_rate_confidence DECIMAL(3,2) DEFAULT 1.0,
        resting_heart_rate INT,
        resting_heart_rate_unit VARCHAR(20) DEFAULT 'bpm', 
        resting_heart_rate_confidence DECIMAL(3,2) DEFAULT 1.0,
        blood_pressure_systolic INT,
        blood_pressure_diastolic INT,
        blood_pressure_unit VARCHAR(20) DEFAULT 'mmHg',
        blood_pressure_confidence DECIMAL(3,2) DEFAULT 1.0,
        glucose DECIMAL(6,2),
        glucose_unit VARCHAR(20) DEFAULT 'mg/dL',
        glucose_confidence DECIMAL(3,2) DEFAULT 1.0,
        weight DECIMAL(6,2),
        weight_unit VARCHAR(20) DEFAULT 'pounds',
        weight_confidence DECIMAL(3,2) DEFAULT 1.0,
        body_temperature DECIMAL(5,2),
        body_temperature_unit VARCHAR(20) DEFAULT 'fahrenheit',
        body_temperature_confidence DECIMAL(3,2) DEFAULT 1.0,
        oxygen_saturation DECIMAL(5,2),
        oxygen_saturation_unit VARCHAR(20) DEFAULT 'percent',
        oxygen_saturation_confidence DECIMAL(3,2) DEFAULT 1.0,
        measurement_source VARCHAR(100),
        
        FOREIGN KEY (record_id) REFERENCES health_records(id) ON DELETE CASCADE,
        INDEX idx_measurement_source (measurement_source)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created table: health_vitals');

    // Sleep sessions table
    await this.execute(`
      CREATE TABLE IF NOT EXISTS sleep_sessions (
        record_id VARCHAR(36) PRIMARY KEY,
        sleep_start DATETIME,
        sleep_end DATETIME,
        sleep_duration INT,
        sleep_duration_unit VARCHAR(20) DEFAULT 'minutes',
        sleep_duration_confidence DECIMAL(3,2) DEFAULT 1.0,
        sleep_quality VARCHAR(50),
        measurement_source VARCHAR(100),
        
        FOREIGN KEY (record_id) REFERENCES health_records(id) ON DELETE CASCADE,
        INDEX idx_sleep_start (sleep_start),
        INDEX idx_measurement_source (measurement_source)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created table: sleep_sessions');

    // Location data table
    await this.execute(`
      CREATE TABLE IF NOT EXISTS location_data (
        record_id VARCHAR(36) PRIMARY KEY,
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        location_name VARCHAR(200),
        visit_start DATETIME,
        visit_end DATETIME,
        visit_duration INT,
        visit_duration_unit VARCHAR(20) DEFAULT 'minutes',
        visit_duration_confidence DECIMAL(3,2) DEFAULT 1.0,
        measurement_source VARCHAR(100),
        
        FOREIGN KEY (record_id) REFERENCES health_records(id) ON DELETE CASCADE,
        INDEX idx_coordinates (latitude, longitude),
        INDEX idx_visit_start (visit_start),
        INDEX idx_measurement_source (measurement_source)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created table: location_data');

    console.log('✅ All MySQL tables created successfully');
  }

  /**
   * Drop all tables (for testing/reset)
   */
  async dropAllTables() {
    if (!this.isConnected) {
      await this.connect();
    }

    console.log('⚠️  Dropping all MySQL tables...');
    
    const tables = ['location_data', 'sleep_sessions', 'health_vitals', 'fitness_metrics', 'health_records'];
    
    for (const table of tables) {
      await this.execute(`DROP TABLE IF EXISTS ${table}`);
      console.log(`🗑️  Dropped table: ${table}`);
    }
  }

  /**
   * Check if database exists and has tables
   */
  async databaseExists() {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const [rows] = await this.query(`
        SELECT TABLE_NAME FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'health_records'
      `, [this.dbName]);

      return rows.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    if (!this.isConnected) {
      await this.connect();
    }

    const stats = {
      totalRecords: 0,
      recordsBySource: {},
      recordsByType: {},
      dateRange: null,
      tableCounts: {}
    };

    try {
      // Get total records count
      const [totalResult] = await this.query('SELECT COUNT(*) as count FROM health_records');
      stats.totalRecords = totalResult[0]?.count || 0;

      // Get counts by source
      const [sourceResults] = await this.query(`
        SELECT source, COUNT(*) as count 
        FROM health_records 
        GROUP BY source
      `);
      
      sourceResults.forEach(row => {
        stats.recordsBySource[row.source] = row.count;
      });

      // Get counts by data type
      const [typeResults] = await this.query(`
        SELECT data_type, COUNT(*) as count 
        FROM health_records 
        GROUP BY data_type
      `);
      
      typeResults.forEach(row => {
        stats.recordsByType[row.data_type] = row.count;
      });

      // Get date range
      const [dateResult] = await this.query(`
        SELECT 
          MIN(date_only) as earliest,
          MAX(date_only) as latest
        FROM health_records
        WHERE date_only IS NOT NULL
      `);
      
      if (dateResult[0]?.earliest && dateResult[0]?.latest) {
        stats.dateRange = {
          earliest: dateResult[0].earliest,
          latest: dateResult[0].latest
        };
      }

      // Get table counts
      const tables = ['fitness_metrics', 'health_vitals', 'sleep_sessions', 'location_data'];
      for (const table of tables) {
        try {
          const [result] = await this.query(`SELECT COUNT(*) as count FROM ${table}`);
          stats.tableCounts[table] = result[0]?.count || 0;
        } catch (error) {
          stats.tableCounds[table] = 0;
        }
      }

    } catch (error) {
      console.error('Error getting MySQL database stats:', error);
    }

    return stats;
  }

  /**
   * Execute a query with parameters
   */
  async query(sql, params = []) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    return await this.pool.execute(sql, params);
  }

  /**
   * Execute a non-SELECT query (INSERT, UPDATE, DELETE)
   */
  async execute(sql, params = []) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    const [result] = await this.pool.execute(sql, params);
    return result;
  }

  /**
   * Execute a query and get first result
   */
  async queryOne(sql, params = []) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    const [rows] = await this.pool.execute(sql, params);
    return rows[0] || null;
  }

  /**
   * Execute multiple statements in a transaction
   */
  async transaction(transactionFn) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    
    const connection = await this.pool.getConnection();
    await connection.beginTransaction();
    
    try {
      const result = await transactionFn(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get database size information
   */
  async getFileSize() {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const [result] = await this.query(`
        SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
        FROM information_schema.tables 
        WHERE table_schema = ?
      `, [this.dbName]);
      
      const sizeInMB = result[0]?.size_mb || 0;
      return `${sizeInMB} MB`;
    } catch (error) {
      return '0 MB';
    }
  }
}

module.exports = MySQLConnection;