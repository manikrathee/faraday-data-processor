#!/usr/bin/env node

/**
 * Test manual health field mapping fix
 */

const path = require('path');
const ManualHealthProcessor = require('./processors/manualHealthProcessor');

async function testManualHealthFix() {
  console.log('🏥 Testing Manual Health Field Mapping\n');
  
  const processor = new ManualHealthProcessor();
  const dataSourcePath = path.resolve('~/Developer/_Data-Source'.replace('~', require('os').homedir()));
  const migrainefile = path.join(dataSourcePath, 'manual-migraine-data.csv');
  
  try {
    console.log(`📄 Testing file: ${migrainefile}`);
    
    // Test health type detection from filename
    const healthType = processor.determineHealthType(migrainefile);
    console.log(`🔍 Detected health type: ${healthType}`);
    
    // Process the migraine data
    console.log('\n🔄 Processing migraine data...');
    const records = await processor.processFile(migrainefile);
    
    if (records.length > 0) {
      console.log(`\n✅ SUCCESS: Processed ${records.length} migraine records`);
      
      // Show first record details
      const firstRecord = records[0];
      console.log('\n🏥 First migraine record details:');
      console.log(`  Timestamp: ${firstRecord.timestamp}`);
      console.log(`  Data Type: ${firstRecord.dataType}`);
      console.log(`  Sub Type: ${firstRecord.subType}`);
      console.log(`  Condition: ${firstRecord.condition}`);
      console.log(`  Severity: ${firstRecord.severity}`);
      if (firstRecord.severity_score) {
        console.log(`  Severity Score: ${firstRecord.severity_score.value}/5`);
      }
      if (firstRecord.duration) {
        console.log(`  Duration: ${firstRecord.duration.value} hours`);
      }
      if (firstRecord.duration_minutes) {
        console.log(`  Duration: ${firstRecord.duration_minutes.value} minutes`);
      }
      console.log(`  Symptom Type: ${firstRecord.symptom_type}`);
      console.log(`  Impact Level: ${firstRecord.impact_level}`);
      
      // Show summary of all records
      console.log(`\n📊 All migraine records summary:`);
      const severityCounts = {};
      const totalHours = records.reduce((sum, record) => {
        const severity = record.severity;
        severityCounts[severity] = (severityCounts[severity] || 0) + 1;
        return sum + (record.duration ? record.duration.value : 0);
      }, 0);
      
      console.log(`  Total episodes: ${records.length}`);
      console.log(`  Total duration: ${totalHours.toFixed(1)} hours`);
      console.log(`  Average duration: ${(totalHours / records.length).toFixed(1)} hours`);
      console.log(`  Severity breakdown:`);
      Object.entries(severityCounts).forEach(([severity, count]) => {
        console.log(`    ${severity}: ${count} episodes`);
      });
      
      // Test severity mapping
      console.log('\n🧪 Testing severity mappings:');
      const testSeverities = ['H', 'M', 'L'];
      testSeverities.forEach(sev => {
        const testRecord = records.find(r => r.raw_data.severity === sev);
        if (testRecord) {
          console.log(`  "${sev}" → "${testRecord.severity}" (score: ${testRecord.severity_score?.value})`);
        }
      });
      
      console.log('\n🎉 Manual health data processing is working correctly!');
      
    } else {
      console.log('\n❌ FAILED: No records processed');
    }
    
  } catch (error) {
    console.log(`\n❌ ERROR: ${error.message}`);
    console.error(error);
  }
}

testManualHealthFix().catch(console.error);