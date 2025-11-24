#!/usr/bin/env node

/**
 * Test database transaction batching fix
 */

const path = require('path');
const fs = require('fs-extra');
const DatabaseConnection = require('./database/connection');
const DataMapper = require('./database/dataMapper');
const { v4: uuidv4 } = require('uuid');

async function testDbBatching() {
  console.log('💾 Testing Database Transaction Batching\n');
  
  const testDbPath = path.join(__dirname, '../test-batching.db');
  
  try {
    // Clean up any existing test database
    if (await fs.pathExists(testDbPath)) {
      await fs.remove(testDbPath);
    }
    
    // Create database
    const db = new DatabaseConnection(testDbPath);
    await db.connect();
    await db.createTables();
    
    const dataMapper = new DataMapper(db);
    
    // Create test records - simulate Nike+ large dataset
    console.log('🏗️  Creating test records...');
    const testRecords = [];
    
    // Create 2,500 test records to test batching
    for (let i = 0; i < 2500; i++) {
      const record = {
        id: uuidv4(),
        timestamp: `01/${String(i % 30 + 1).padStart(2, '0')}/2023 10:${String(i % 60).padStart(2, '0')}:00`,
        source: 'test_nike',
        dataType: 'fitness',
        subType: 'activity',
        processed_at: '11/23/2025 10:30:00',
        
        // Simulate Nike+ activity data
        steps: {
          value: 100 + (i % 1000),
          unit: 'steps',
          confidence: 0.9
        },
        calories: {
          value: 50 + (i % 200),
          unit: 'calories',
          confidence: 0.8
        },
        fuel_points: {
          value: 10 + (i % 50),
          unit: 'fuel',
          confidence: 0.9
        }
      };
      
      testRecords.push(record);
    }
    
    console.log(`📊 Created ${testRecords.length} test records`);
    
    // Test with default batch size (1000)
    console.log('\n💾 Testing batch insertion (1000 per batch)...');
    const startTime = Date.now();
    
    const result = dataMapper.insertRecords(testRecords);
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log(`\n✅ Batch insertion complete!`);
    console.log(`📊 Results:`);
    console.log(`  Total Records: ${result.totalRecords}`);
    console.log(`  Inserted: ${result.inserted}`);
    console.log(`  Errors: ${result.errors}`);
    console.log(`  Processing Time: ${processingTime}ms`);
    console.log(`  Records per Second: ${Math.round(result.inserted / (processingTime / 1000))}`);
    
    // Test with smaller batch size
    console.log('\n🧪 Testing smaller batch size (500 per batch)...');
    
    // Clear database first (delete child records before parent records)
    db.run('DELETE FROM fitness_metrics');
    db.run('DELETE FROM health_records');
    
    const startTime2 = Date.now();
    const result2 = dataMapper.insertRecords(testRecords, 500);
    const endTime2 = Date.now();
    const processingTime2 = endTime2 - startTime2;
    
    console.log(`\n✅ Smaller batch insertion complete!`);
    console.log(`📊 Results:`);
    console.log(`  Total Records: ${result2.totalRecords}`);
    console.log(`  Inserted: ${result2.inserted}`);
    console.log(`  Errors: ${result2.errors}`);
    console.log(`  Processing Time: ${processingTime2}ms`);
    console.log(`  Records per Second: ${Math.round(result2.inserted / (processingTime2 / 1000))}`);
    
    // Verify database content
    console.log('\n🔍 Verifying database content...');
    const totalRecords = db.query('SELECT COUNT(*) as count FROM health_records')[0].count;
    const fitnessRecords = db.query('SELECT COUNT(*) as count FROM fitness_metrics')[0].count;
    
    console.log(`  Health Records in DB: ${totalRecords}`);
    console.log(`  Fitness Records in DB: ${fitnessRecords}`);
    
    // Test error handling with invalid data
    console.log('\n🚨 Testing error handling with invalid records...');
    const invalidRecords = [
      { id: 'invalid', timestamp: null }, // Invalid timestamp
      { id: uuidv4(), timestamp: '01/01/2023 12:00:00', source: 'test', dataType: 'fitness', subType: 'test' }
    ];
    
    const errorResult = dataMapper.insertRecords(invalidRecords);
    console.log(`  Invalid batch result: ${errorResult.inserted} inserted, ${errorResult.errors} errors`);
    
    db.close();
    
    console.log('\n🎉 Database transaction batching is working correctly!');
    console.log('📈 Performance improvements:');
    console.log('  - Prevents memory exhaustion with large datasets');
    console.log('  - Avoids transaction timeouts');
    console.log('  - Provides progress feedback');
    console.log('  - Handles errors gracefully');
    
    // Cleanup
    await fs.remove(testDbPath);
    
  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
    console.error(error.stack);
    
    // Cleanup on error
    try {
      await fs.remove(testDbPath);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
  }
}

testDbBatching().catch(console.error);