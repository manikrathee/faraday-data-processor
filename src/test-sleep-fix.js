#!/usr/bin/env node

/**
 * Test sleep processor delimiter detection fix
 */

const path = require('path');
const SleepProcessor = require('./processors/sleepProcessor');

async function testSleepFix() {
  console.log('🛌 Testing Sleep Processor Delimiter Detection\n');
  
  const processor = new SleepProcessor();
  const dataSourcePath = path.resolve('~/Developer/_Data-Source'.replace('~', require('os').homedir()));
  const sleepFile = path.join(dataSourcePath, 'sleepdata.csv');
  
  try {
    console.log(`📄 Testing file: ${sleepFile}`);
    
    // Test delimiter detection first
    const sampleContent = await processor.getSampleContent(sleepFile);
    console.log('Sample content:');
    console.log(sampleContent);
    
    const delimiter = processor.detectDelimiter(sampleContent);
    console.log(`\n📊 Detected delimiter: "${delimiter}"`);
    
    const format = processor.detectSleepFormat(sampleContent);
    console.log(`📋 Detected format: ${format}`);
    
    // Test actual processing
    console.log('\n🔄 Processing sleep data...');
    const records = await processor.processFile(sleepFile);
    
    if (records.length > 0) {
      console.log(`\n✅ SUCCESS: Processed ${records.length} sleep records`);
      
      // Show first record details
      const firstRecord = records[0];
      console.log('\n📋 First record details:');
      console.log(`  Timestamp: ${firstRecord.timestamp}`);
      console.log(`  Sleep Start: ${firstRecord.sleep_start}`);
      console.log(`  Sleep End: ${firstRecord.sleep_end}`);
      console.log(`  Duration: ${firstRecord.sleep_duration?.value} ${firstRecord.sleep_duration?.unit}`);
      if (firstRecord.sleep_quality) {
        console.log(`  Quality: ${firstRecord.sleep_quality.value}%`);
      }
      if (firstRecord.time_in_bed) {
        console.log(`  Time in bed: ${firstRecord.time_in_bed.value} ${firstRecord.time_in_bed.unit}`);
      }
      
      console.log('\n🎉 Sleep data processing is working correctly!');
    } else {
      console.log('\n❌ FAILED: No records processed');
    }
    
  } catch (error) {
    console.log(`\n❌ ERROR: ${error.message}`);
    console.error(error);
  }
}

testSleepFix().catch(console.error);