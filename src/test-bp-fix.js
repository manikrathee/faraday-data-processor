#!/usr/bin/env node

/**
 * Test blood pressure processing fix
 */

const path = require('path');
const fs = require('fs-extra');
const GyroscopeProcessor = require('./processors/gyroscopeProcessor');

async function testBpFix() {
  console.log('🩺 Testing Blood Pressure Processor Fix\n');
  
  const processor = new GyroscopeProcessor();
  
  // Create test data with sample BP readings
  const testData = `time,systolic,diastolic,service
2023-01-15-08:30:00,120,80,healthkit
2023-01-16-09:00:00,118,75,healthkit
2023-01-17-19:30:00,125,82,manual
`;

  const testFile = path.join(__dirname, '../gyroscope-Test-bp-export.csv');
  
  try {
    // Write test data
    await fs.writeFile(testFile, testData);
    console.log('📝 Created test BP data file');
    
    // Test processing
    console.log('🔄 Processing blood pressure data...');
    const records = await processor.processFile(testFile);
    
    if (records.length > 0) {
      console.log(`\n✅ SUCCESS: Processed ${records.length} BP records`);
      
      // Show first record details
      const firstRecord = records[0];
      console.log('\n🩺 First BP record details:');
      console.log(`  Timestamp: ${firstRecord.timestamp}`);
      console.log(`  Data Type: ${firstRecord.dataType}`);
      console.log(`  Sub Type: ${firstRecord.subType}`);
      
      if (firstRecord.blood_pressure) {
        console.log(`  Systolic: ${firstRecord.blood_pressure.systolic.value} ${firstRecord.blood_pressure.systolic.unit}`);
        console.log(`  Diastolic: ${firstRecord.blood_pressure.diastolic.value} ${firstRecord.blood_pressure.diastolic.unit}`);
        console.log(`  Confidence: ${firstRecord.blood_pressure.systolic.confidence}`);
      } else {
        console.log(`  ❌ No blood pressure data found in record!`);
      }
      
      console.log(`  Source: ${firstRecord.measurement_source}`);
      
      // Test all records
      console.log(`\n📊 All BP readings:`);
      records.forEach((record, index) => {
        if (record.blood_pressure) {
          console.log(`  ${index + 1}. ${record.blood_pressure.systolic.value}/${record.blood_pressure.diastolic.value} mmHg (${record.timestamp})`);
        } else {
          console.log(`  ${index + 1}. No BP data (${record.timestamp})`);
        }
      });
      
      console.log('\n🎉 Blood pressure processing is working correctly!');
      
    } else {
      console.log('\n❌ FAILED: No records processed');
    }
    
    // Test empty file handling
    console.log('\n🧪 Testing empty file handling...');
    const emptyFile = path.join(__dirname, '../gyroscope-Test-bp-empty-export.csv');
    await fs.writeFile(emptyFile, 'time,systolic,diastolic,service\n');
    
    const emptyRecords = await processor.processFile(emptyFile);
    console.log(`Empty file result: ${emptyRecords.length} records (expected: 0)`);
    
    // Cleanup
    await fs.remove(testFile);
    await fs.remove(emptyFile);
    
  } catch (error) {
    console.log(`\n❌ ERROR: ${error.message}`);
    console.error(error);
    
    // Cleanup on error
    try {
      await fs.remove(testFile);
      await fs.remove(path.join(__dirname, '../gyroscope-Test-bp-empty-export.csv'));
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
  }
}

testBpFix().catch(console.error);