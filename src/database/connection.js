const Database = require('better-sqlite3');
const fs = require('fs-extra');
const path = require('path');
const DatabaseSchema = require('./schema');

/**
 * Database connection and query utilities
 * Uses SQLite with better-sqlite3 for performance
 */
class DatabaseConnection {
  constructor(dbPath = './data/health_data.db', options = {}) {
    this.dbPath = path.resolve(dbPath);
    this.options = {
      verbose: options.verbose ? console.log : null,
      fileMustExist: false,
      timeout: 30000,
      ...options
    };
    this.db = null;
    this.schema = new DatabaseSchema();
    this.isConnected = false;
  }

  /**
   * Connect to the database and ensure directory exists
   */
  async connect() {
    try {
      // Ensure database directory exists
      await fs.ensureDir(path.dirname(this.dbPath));
      
      // Create database connection
      this.db = new Database(this.dbPath, this.options);
      this.isConnected = true;
      
      // Enable WAL mode for better concurrency
      this.db.exec('PRAGMA journal_mode = WAL');
      this.db.exec('PRAGMA synchronous = NORMAL');
      this.db.exec('PRAGMA cache_size = 1000');
      this.db.exec('PRAGMA foreign_keys = ON');
      
      console.log(`📊 Connected to database: ${this.dbPath}`);
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.isConnected = false;
      console.log('📊 Database connection closed');
    }
  }

  /**
   * Create all database tables and indexes
   */
  async createTables() {
    if (!this.isConnected) {
      await this.connect();
    }

    console.log('📊 Creating database tables...');
    
    // Create tables in dependency order
    const tableOrder = this.schema.getTableCreationOrder();
    for (const tableName of tableOrder) {
      const sql = this.schema.getCreateTableSQL(tableName);
      this.db.exec(sql);
      console.log(`✅ Created table: ${tableName}`);
    }

    // Create indexes
    console.log('📊 Creating database indexes...');
    const indexSQL = this.schema.getAllCreateIndexSQL();
    for (const sql of indexSQL) {
      this.db.exec(sql);
    }
    console.log('✅ Created all indexes');
  }

  /**
   * Drop all tables (for testing/reset)
   */
  async dropAllTables() {
    if (!this.isConnected) {
      await this.connect();
    }

    console.log('⚠️  Dropping all tables...');
    
    // Drop in reverse order to handle foreign keys
    const tableOrder = this.schema.getTableCreationOrder().reverse();
    for (const tableName of tableOrder) {
      this.db.exec(`DROP TABLE IF EXISTS ${tableName}`);
      console.log(`🗑️  Dropped table: ${tableName}`);
    }
  }

  /**
   * Check if database exists and has tables
   * @returns {Promise<boolean>} True if database exists with tables
   */
  async databaseExists() {
    try {
      if (!await fs.pathExists(this.dbPath)) {
        return false;
      }

      if (!this.isConnected) {
        await this.connect();
      }

      // Check if health_records table exists
      const result = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='health_records'
      `).get();

      return !!result;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get database statistics
   * @returns {Object} Database statistics
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
      const totalResult = this.db.prepare('SELECT COUNT(*) as count FROM health_records').get();
      stats.totalRecords = totalResult.count;

      // Get counts by source
      const sourceResults = this.db.prepare(`
        SELECT source, COUNT(*) as count 
        FROM health_records 
        GROUP BY source
      `).all();
      
      sourceResults.forEach(row => {
        stats.recordsBySource[row.source] = row.count;
      });

      // Get counts by data type
      const typeResults = this.db.prepare(`
        SELECT data_type, COUNT(*) as count 
        FROM health_records 
        GROUP BY data_type
      `).all();
      
      typeResults.forEach(row => {
        stats.recordsByType[row.data_type] = row.count;
      });

      // Get date range
      const dateResult = this.db.prepare(`
        SELECT 
          MIN(date_only) as earliest,
          MAX(date_only) as latest
        FROM health_records
        WHERE date_only IS NOT NULL
      `).get();
      
      if (dateResult.earliest && dateResult.latest) {
        stats.dateRange = {
          earliest: dateResult.earliest,
          latest: dateResult.latest
        };
      }

      // Get table counts
      const tables = ['fitness_metrics', 'health_vitals', 'sleep_sessions', 'habits', 'symptoms', 'medications'];
      for (const table of tables) {
        try {
          const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
          stats.tableCounts[table] = result.count;
        } catch (error) {
          stats.tableCounts[table] = 0;
        }
      }

    } catch (error) {
      console.error('Error getting database stats:', error);
    }

    return stats;
  }

  /**
   * Execute a query with parameters
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Array} Query results
   */
  query(sql, params = []) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    return this.db.prepare(sql).all(params);
  }

  /**
   * Execute a non-SELECT query (INSERT, UPDATE, DELETE)
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Object} Query result info
   */
  run(sql, params = []) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    return this.db.prepare(sql).run(params);
  }

  /**
   * Execute a query and get first result
   * @param {string} sql - SQL query  
   * @param {Array} params - Query parameters
   * @returns {Object|null} First result or null
   */
  queryOne(sql, params = []) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    return this.db.prepare(sql).get(params);
  }

  /**
   * Execute an insert/update/delete query
   * @param {string} sql - SQL statement
   * @param {Array} params - Statement parameters
   * @returns {Object} Statement result with changes/lastInsertRowid
   */
  execute(sql, params = []) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    return this.db.prepare(sql).run(params);
  }

  /**
   * Execute multiple statements in a transaction
   * @param {Function} transaction - Function that performs database operations
   * @returns {*} Result of transaction function
   */
  transaction(transactionFn) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    return this.db.transaction(transactionFn)();
  }

  /**
   * Prepare a statement for reuse
   * @param {string} sql - SQL statement
   * @returns {Object} Prepared statement
   */
  prepare(sql) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    return this.db.prepare(sql);
  }

  /**
   * Vacuum database to reclaim space
   */
  vacuum() {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    console.log('📊 Vacuuming database...');
    this.db.exec('VACUUM');
    console.log('✅ Database vacuum complete');
  }

  /**
   * Get database file size
   * @returns {Promise<string>} Human readable file size
   */
  async getFileSize() {
    if (await fs.pathExists(this.dbPath)) {
      const stats = await fs.stat(this.dbPath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      return `${sizeInMB} MB`;
    }
    return '0 MB';
  }
}

module.exports = DatabaseConnection;