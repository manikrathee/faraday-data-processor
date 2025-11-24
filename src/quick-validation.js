#!/usr/bin/env node

/**
 * Quick validation to test timestamp parsing fix
 */

const path = require('path');
const GyroscopeProcessor = require('./processors/gyroscopeProcessor');

async function quickValidation() {
  console.log('🔍 Quick Validation - Testing Timestamp Fix\n');
  
  const processor = new GyroscopeProcessor();
  const dataSourcePath = path.resolve('~/Developer/_Data-Source'.replace('~', require('os').homedir()));
  const gyroscopeDir = path.join(dataSourcePath, 'gyroscope');
  
  // Test files with known issues
  const testFiles = [
    'gyroscope-Manik-gvisits-export.csv',
    'gyroscope-Manik-hrv-export.csv',
    'gyroscope-Manik-cycling-export.csv'
  ];
  
  for (const testFile of testFiles) {
    const filePath = path.join(gyroscopeDir, testFile);
    
    try {
      console.log(`📄 Testing: ${testFile}`);
      const records = await processor.processFile(filePath);
      
      if (records.length > 0) {
        const firstRecord = records[0];
        console.log(`  ✅ Processed ${records.length} records`);
        console.log(`  📅 First record timestamp: ${firstRecord.timestamp}`);
        console.log(`  📊 Data type: ${firstRecord.dataType}, Sub type: ${firstRecord.subType}`);
        
        // Check for specific fields based on subtype
        if (firstRecord.subType === 'gvisits' && firstRecord.location) {
          console.log(`  📍 Location: ${firstRecord.location.name}`);
        }
        if (firstRecord.subType === 'hrv' && firstRecord.heart_rate_variability) {
          console.log(`  💓 HRV: ${firstRecord.heart_rate_variability.value}${firstRecord.heart_rate_variability.unit}`);
        }
        
        // Validate timestamp is not null
        if (firstRecord.timestamp === null) {
          console.log(`  ❌ STILL HAS NULL TIMESTAMP!`);
        } else {
          console.log(`  ✅ Timestamp parsing successful`);
        }
      } else {
        console.log(`  ⚠️  No records processed from ${testFile}`);
      }
      
    } catch (error) {
      console.log(`  ❌ Error processing ${testFile}: ${error.message}`);
    }
    
    console.log(''); // Empty line
  }
  
  console.log('🎉 Quick validation complete!');
}

// Run validation
quickValidation().catch(console.error);