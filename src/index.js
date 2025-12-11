#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs-extra');
const GyroscopeProcessor = require('./processors/gyroscopeProcessor');
const NikePlusProcessor = require('./processors/nikePlusProcessor');
const AppleHealthProcessor = require('./processors/appleHealthProcessor');
const CoachMeProcessor = require('./processors/coachMeProcessor');
const SleepProcessor = require('./processors/sleepProcessor');
const ManualHealthProcessor = require('./processors/manualHealthProcessor');
const MovesProcessor = require('./processors/movesProcessor');
const DatabaseConnection = require('./database/connection');
const DataMapper = require('./database/dataMapper');

const program = new Command();

/**
 * Process a data source with common handling
 * @param {string} name - Display name for the data source
 * @param {BaseProcessor} processor - Processor instance
 * @param {Function} getFiles - Function to get file list
 * @param {string} outputPath - Output directory path
 * @param {Object} options - CLI options
 * @returns {Promise<Object>} Processing result
 */
async function processDataSource(name, processor, getFiles, outputPath, options) {
  try {
    console.log(`\n📊 Processing ${name} data...`);
    
    const files = await getFiles(processor);
    
    if (files.length === 0) {
      console.log(`⚠️  No ${name} files found`);
      return null;
    }
    
    if (options.dryRun) {
      console.log(`Would process ${files.length} files:`, files.slice(0, 5));
      if (files.length > 5) console.log(`... and ${files.length - 5} more`);
      return null;
    }

    // Initialize database if requested
    if (options.database) {
      if (options.dbType === 'mysql') {
        const mysqlConfig = {
          host: options.mysqlHost,
          port: parseInt(options.mysqlPort),
          user: options.mysqlUser,
          password: options.mysqlPassword,
          database: options.mysqlDatabase
        };
        await processor.initializeDatabase(mysqlConfig, 'mysql');
      } else {
        const dbPath = options.database === true ? options.dbPath : options.database;
        await processor.initializeDatabase(dbPath, 'sqlite');
      }
    }
    
    const result = await processor.processFiles(files, options.incremental);
    
    // Save to database if enabled
    if (options.database && result.records.length > 0) {
      const dbResult = await processor.saveToDatabase();
      result.databaseResult = dbResult;
    }
    
    // Group records by data type for separate output files
    const recordsByType = {};
    result.records.forEach(record => {
      const type = record.dataType;
      if (!recordsByType[type]) recordsByType[type] = [];
      recordsByType[type].push(record);
    });
    
    // Save each data type to separate files
    for (const [dataType, records] of Object.entries(recordsByType)) {
      const sourceName = processor.sourceName.replace(/[^a-z0-9]/gi, '_');
      const outputFile = path.join(outputPath, `${sourceName}_${dataType}.json`);
      await processor.saveToJson(outputFile, records);
    }
    
    console.log(`✅ ${name}: ${result.processed} records processed, ${result.errors} errors`);
    
    // Show database results if applicable
    if (result.databaseResult) {
      console.log(`💾 Database: ${result.databaseResult.inserted} records saved, ${result.databaseResult.errors} errors`);
    }
    
    // Show statistics
    const stats = processor.getStats();
    console.log(`📈 Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
    if (stats.dateRange) {
      console.log(`📅 Date range: ${stats.dateRange.earliest} to ${stats.dateRange.latest}`);
    }

    // Close database connection
    if (options.database) {
      await processor.closeDatabase();
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Failed to process ${name}:`, error.message);
    return null;
  }
}

program
  .name('m-data-processor')
  .description('High-performance data processing pipeline for health and fitness data')
  .version('1.0.0');

program
  .command('process')
  .description('Process data files')
  .option('-s, --source <path>', 'Source data directory', '~/Developer/_Data-Source')
  .option('-o, --output <path>', 'Output directory', './output')
  .option('-t, --type <type>', 'Specific data type to process (gyroscope, nike, apple, etc.)')
  .option('-i, --incremental', 'Process only changed files', false)
  .option('--dry-run', 'Show what would be processed without actually processing', false)
  .option('-d, --database [path]', 'Save to database (optional path)', false)
  .option('--db-path <path>', 'Database file path', './data/health_data.db')
  .option('--db-type <type>', 'Database type: sqlite or mysql', 'sqlite')
  .option('--mysql-host <host>', 'MySQL host', 'localhost')
  .option('--mysql-port <port>', 'MySQL port', '3306')
  .option('--mysql-user <user>', 'MySQL user', 'root')
  .option('--mysql-password <password>', 'MySQL password', '')
  .option('--mysql-database <database>', 'MySQL database name', 'm_health_data')
  .action(async (options) => {
    try {
      // Cross-platform path handling
      let sourcePath = options.source;
      if (sourcePath.startsWith('~')) {
        sourcePath = path.join(require('os').homedir(), sourcePath.slice(1));
      }
      sourcePath = path.resolve(sourcePath);
      const outputPath = path.resolve(options.output);
      
      console.log('🚀 M Data Processor');
      console.log(`Source: ${sourcePath}`);
      console.log(`Output: ${outputPath}`);
      console.log(`Incremental: ${options.incremental}`);
      console.log(`Type filter: ${options.type || 'all'}`);
      console.log(`Database: ${options.database ? `${options.dbType} (${options.dbType === 'mysql' ? `${options.mysqlHost}:${options.mysqlPort}/${options.mysqlDatabase}` : (options.database === true ? options.dbPath : options.database)})` : 'disabled'}`);
      
      // Ensure output directory exists
      await fs.ensureDir(outputPath);
      
      const startTime = Date.now();
      let totalProcessed = 0;
      let totalErrors = 0;
      
      const processorResults = [];

      // Process Gyroscope data
      if (!options.type || options.type === 'gyroscope') {
        const result = await processDataSource(
          'Gyroscope',
          new GyroscopeProcessor(),
          async (processor) => {
            const gyroscopeDir = path.join(sourcePath, 'gyroscope');
            if (await fs.pathExists(gyroscopeDir)) {
              return (await fs.readdir(gyroscopeDir))
                .filter(file => file.endsWith('.csv'))
                .map(file => path.join(gyroscopeDir, file));
            }
            return [];
          },
          outputPath,
          options
        );
        if (result) processorResults.push(result);
      }

      // Process Nike+ data
      if (!options.type || options.type === 'nike' || options.type === 'nikeplus') {
        const result = await processDataSource(
          'Nike+ FuelBand',
          new NikePlusProcessor(),
          async (processor) => await processor.getNikePlusFiles(sourcePath),
          outputPath,
          options
        );
        if (result) processorResults.push(result);
      }

      // Process Apple Health data
      if (!options.type || options.type === 'apple' || options.type === 'apple_health') {
        const result = await processDataSource(
          'Apple Health',
          new AppleHealthProcessor(),
          async (processor) => await processor.getAppleHealthFiles(sourcePath),
          outputPath,
          options
        );
        if (result) processorResults.push(result);
      }

      // Process Coach.me data
      if (!options.type || options.type === 'coach' || options.type === 'coachme') {
        const result = await processDataSource(
          'Coach.me',
          new CoachMeProcessor(),
          async (processor) => await processor.getCoachMeFiles(sourcePath),
          outputPath,
          options
        );
        if (result) processorResults.push(result);
      }

      // Process Sleep data
      if (!options.type || options.type === 'sleep') {
        const result = await processDataSource(
          'Sleep Tracking',
          new SleepProcessor(),
          async (processor) => await processor.getSleepFiles(sourcePath),
          outputPath,
          options
        );
        if (result) processorResults.push(result);
      }

      // Process Manual Health data
      if (!options.type || options.type === 'manual' || options.type === 'health') {
        const result = await processDataSource(
          'Manual Health',
          new ManualHealthProcessor(),
          async (processor) => await processor.getManualHealthFiles(sourcePath),
          outputPath,
          options
        );
        if (result) processorResults.push(result);
      }

      // Process Moves data
      if (!options.type || options.type === 'moves') {
        const result = await processDataSource(
          'Moves',
          new MovesProcessor(),
          async (processor) => await processor.getMovesFiles(sourcePath),
          outputPath,
          options
        );
        if (result) processorResults.push(result);
      }

      // Calculate totals
      totalProcessed = processorResults.reduce((sum, r) => sum + r.processed, 0);
      totalErrors = processorResults.reduce((sum, r) => sum + r.errors, 0);
      
      const totalTime = Date.now() - startTime;
      
      console.log(`\n🎉 Processing complete!`);
      console.log(`Total records: ${totalProcessed}`);
      console.log(`Total errors: ${totalErrors}`);
      console.log(`Processing time: ${(totalTime / 1000).toFixed(2)}s`);
      console.log(`Output saved to: ${outputPath}`);
      
    } catch (error) {
      console.error('❌ Processing failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('Analyze data sources without processing')
  .option('-s, --source <path>', 'Source data directory', '~/Developer/_Data-Source')
  .action(async (options) => {
    // Cross-platform path handling
    let sourcePath = options.source;
    if (sourcePath.startsWith('~')) {
      sourcePath = path.join(require('os').homedir(), sourcePath.slice(1));
    }
    sourcePath = path.resolve(sourcePath);
    
    console.log('🔍 Analyzing data sources...');
    console.log(`Source: ${sourcePath}`);
    
    // Scan for data files
    const analysis = {
      gyroscope: [],
      nike: [],
      apple: [],
      other: []
    };
    
    if (await fs.pathExists(sourcePath)) {
      const items = await fs.readdir(sourcePath, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isDirectory()) {
          const dirPath = path.join(sourcePath, item.name);
          const files = await fs.readdir(dirPath).catch(() => []);
          
          if (item.name === 'gyroscope') {
            analysis.gyroscope = files.filter(f => f.endsWith('.csv'));
          } else if (item.name.includes('apple_health')) {
            analysis.apple.push(item.name);
          } else if (item.name.toLowerCase().includes('nike')) {
            analysis.nike = files.slice(0, 5); // Show first 5
          }
        } else if (item.isFile()) {
          analysis.other.push(item.name);
        }
      }
    }
    
    console.log('\n📋 Data source analysis:');
    console.log(`Gyroscope files: ${analysis.gyroscope.length}`);
    console.log(`Apple Health exports: ${analysis.apple.length}`);
    console.log(`Nike+ files: ${analysis.nike.length}+`);
    console.log(`Other files: ${analysis.other.length}`);
    
    if (analysis.gyroscope.length > 0) {
      console.log('\n🔸 Gyroscope data types:');
      analysis.gyroscope.forEach(file => {
        const match = file.match(/gyroscope-\w+-(\w+)-export\.csv/);
        if (match) console.log(`  - ${match[1]}`);
      });
    }
  });

program
  .command('database')
  .description('Database operations')
  .option('--db-path <path>', 'Database file path', './data/health_data.db')
  .option('--create', 'Create database and tables', false)
  .option('--stats', 'Show database statistics', false)
  .option('--reset', 'Reset database (delete all data)', false)
  .option('--vacuum', 'Vacuum database to reclaim space', false)
  .action(async (options) => {
    try {
      const dbPath = path.resolve(options.dbPath);
      
      console.log('🗄️  Database Operations');
      console.log(`Database: ${dbPath}`);
      
      const db = new DatabaseConnection(dbPath);
      
      if (options.create) {
        console.log('\n📊 Creating database...');
        await db.connect();
        await db.createTables();
        console.log('✅ Database created successfully');
        db.close();
      }
      
      if (options.reset) {
        console.log('\n⚠️  Resetting database...');
        await db.connect();
        await db.dropAllTables();
        await db.createTables();
        console.log('✅ Database reset complete');
        db.close();
      }
      
      if (options.vacuum) {
        console.log('\n🧹 Vacuuming database...');
        await db.connect();
        db.vacuum();
        db.close();
      }
      
      if (options.stats) {
        console.log('\n📊 Database Statistics:');
        await db.connect();
        
        const exists = await db.databaseExists();
        if (!exists) {
          console.log('❌ Database does not exist or has no tables');
          db.close();
          return;
        }
        
        const stats = await db.getStats();
        const fileSize = await db.getFileSize();
        
        console.log(`Total Records: ${stats.totalRecords.toLocaleString()}`);
        console.log(`Database Size: ${fileSize}`);
        
        if (stats.dateRange) {
          console.log(`Date Range: ${stats.dateRange.earliest} to ${stats.dateRange.latest}`);
        }
        
        console.log('\n📈 Records by Source:');
        Object.entries(stats.recordsBySource).forEach(([source, count]) => {
          console.log(`  ${source}: ${count.toLocaleString()}`);
        });
        
        console.log('\n📊 Records by Data Type:');
        Object.entries(stats.recordsByType).forEach(([type, count]) => {
          console.log(`  ${type}: ${count.toLocaleString()}`);
        });
        
        console.log('\n🗂️  Table Counts:');
        Object.entries(stats.tableCounts).forEach(([table, count]) => {
          if (count > 0) {
            console.log(`  ${table}: ${count.toLocaleString()}`);
          }
        });
        
        db.close();
      }
      
    } catch (error) {
      console.error('❌ Database operation failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('query')
  .description('Query database for records')
  .option('--db-path <path>', 'Database file path', './data/health_data.db')
  .option('--start-date <date>', 'Start date (MM/DD/YYYY)')
  .option('--end-date <date>', 'End date (MM/DD/YYYY)')
  .option('--source <source>', 'Filter by data source')
  .option('--type <type>', 'Filter by data type')
  .option('--limit <number>', 'Limit number of results', '100')
  .action(async (options) => {
    try {
      const dbPath = path.resolve(options.dbPath);
      console.log('🔍 Querying Database');
      console.log(`Database: ${dbPath}`);
      
      const db = new DatabaseConnection(dbPath);
      await db.connect();
      
      const exists = await db.databaseExists();
      if (!exists) {
        console.log('❌ Database does not exist');
        db.close();
        return;
      }
      
      let query = 'SELECT * FROM health_records WHERE 1=1';
      const params = [];
      
      if (options.startDate && options.endDate) {
        query += ' AND date_only BETWEEN ? AND ?';
        params.push(options.startDate, options.endDate);
      }
      
      if (options.source) {
        query += ' AND source = ?';
        params.push(options.source);
      }
      
      if (options.type) {
        query += ' AND data_type = ?';
        params.push(options.type);
      }
      
      query += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(parseInt(options.limit));
      
      const records = db.query(query, params);
      
      console.log(`\n📋 Found ${records.length} records:`);
      records.forEach(record => {
        console.log(`${record.timestamp} | ${record.source} | ${record.data_type} | ${record.sub_type || 'N/A'}`);
      });
      
      db.close();
      
    } catch (error) {
      console.error('❌ Query failed:', error.message);
      process.exit(1);
    }
  });

// If no command specified, show help
if (process.argv.length <= 2) {
  program.help();
}

program.parse(process.argv);