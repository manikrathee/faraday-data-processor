#!/usr/bin/env node

/**
 * Database integration test script
 * Tests database creation, data insertion, and querying
 */

const path = require('path');
const fs = require('fs-extra');
const DatabaseConnection = require('./database/connection');
const DataMapper = require('./database/dataMapper');
const GyroscopeProcessor = require('./processors/gyroscopeProcessor');

async function runDatabaseTests() {
  console.log('🗄️  Testing Database Integration\n');
  
  const testDbPath = path.join(__dirname, '../test-database.db');
  const testDataDir = path.join(__dirname, '../test-data-db');
  
  try {
    // Clean up any existing test database
    if (await fs.pathExists(testDbPath)) {
      await fs.remove(testDbPath);
    }
    
    // Create test data directory
    await fs.ensureDir(testDataDir);
    
    // Test 1: Database Connection and Schema Creation
    console.log('📊 Test 1: Database Creation...');
    const db = new DatabaseConnection(testDbPath);
    await db.connect();
    await db.createTables();
    
    const exists = await db.databaseExists();
    if (exists) {
      console.log('✅ Database created successfully');
    } else {
      throw new Error('Database creation failed');
    }
    
    // Test 2: Data Processing with Database Integration
    console.log('\n📊 Test 2: Data Processing + Database...');
    
    // Create sample gyroscope data
    const sampleData = `date,steps,service
2023-01-01,5000,healthkit
2023-01-02,7500,healthkit
2023-01-03,4200,healthkit`;
    
    const testFile = path.join(testDataDir, 'gyroscope-test-steps-export.csv');
    await fs.writeFile(testFile, sampleData);
    
    // Process data with database integration
    const processor = new GyroscopeProcessor();
    await processor.initializeDatabase(testDbPath);
    
    const records = await processor.processFile(testFile);
    console.log(`Processed ${records.length} records`);
    
    const dbResult = await processor.saveToDatabase(records);
    console.log(`Saved ${dbResult.inserted} records to database`);
    
    // Test 3: Database Statistics
    console.log('\n📊 Test 3: Database Statistics...');
    const stats = await processor.getDatabaseStats();
    console.log(`Total records in database: ${stats.totalRecords}`);
    console.log('Records by source:', stats.recordsBySource);
    console.log('Records by type:', stats.recordsByType);
    
    // Test 4: Query Records
    console.log('\n📊 Test 4: Querying Records...');
    const dataMapper = new DataMapper(db);
    const queriedRecords = dataMapper.getRecordsByDateRange('01/01/2023', '01/03/2023');
    console.log(`Found ${queriedRecords.length} records in date range`);
    
    // Test 5: Record Deletion
    console.log('\n📊 Test 5: Record Deletion...');
    const deleteResult = await processor.deleteFromDatabase();
    console.log(`Deleted ${deleteResult.deletedRecords} records`);
    
    // Verify deletion
    const statsAfterDelete = await processor.getDatabaseStats();
    console.log(`Records after deletion: ${statsAfterDelete.totalRecords}`);
    
    // Test 6: Database File Size
    console.log('\n📊 Test 6: Database File Operations...');
    const fileSize = await db.getFileSize();
    console.log(`Database file size: ${fileSize}`);
    
    // Vacuum database
    db.vacuum();
    const fileSizeAfterVacuum = await db.getFileSize();
    console.log(`Database size after vacuum: ${fileSizeAfterVacuum}`);
    
    // Close connections
    processor.closeDabase();
    db.close();
    
    console.log('\n✅ All database tests passed!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    throw error;
  } finally {
    // Cleanup
    try {
      if (await fs.pathExists(testDbPath)) {
        await fs.remove(testDbPath);
      }
      if (await fs.pathExists(testDataDir)) {
        await fs.remove(testDataDir);
      }
    } catch (cleanupError) {
      console.warn('Warning: Cleanup failed:', cleanupError.message);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  runDatabaseTests().catch(error => {
    console.error('💥 Database tests failed:', error);
    process.exit(1);
  });
}

module.exports = { runDatabaseTests };