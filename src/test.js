#!/usr/bin/env node

/**
 * Quick test script to validate processors without needing actual data files
 * Creates sample data and tests each processor
 */

const path = require('path');
const fs = require('fs-extra');
const GyroscopeProcessor = require('./processors/gyroscopeProcessor');
const NikePlusProcessor = require('./processors/nikePlusProcessor');
const CoachMeProcessor = require('./processors/coachMeProcessor');
const SleepProcessor = require('./processors/sleepProcessor');
const ManualHealthProcessor = require('./processors/manualHealthProcessor');
const DateNormalizer = require('./utils/dateNormalizer');

async function runTests() {
  console.log('🧪 Running M Data Processor Tests\n');

  const testDir = path.join(__dirname, '../test-data');
  await fs.ensureDir(testDir);

  // Test DateNormalizer
  await testDateNormalizer();

  // Test each processor with sample data
  await testGyroscopeProcessor(testDir);
  await testNikePlusProcessor(testDir);
  await testCoachMeProcessor(testDir);
  await testSleepProcessor(testDir);
  await testManualHealthProcessor(testDir);

  // Cleanup
  await fs.remove(testDir);

  console.log('\n✅ All tests completed successfully!');
}

async function testDateNormalizer() {
  console.log('📅 Testing DateNormalizer...');

  const normalizer = new DateNormalizer();

  const testCases = [
    '2018-08-02',
    '2013-05-20-08:43:00',
    '2013-09-30 01:11:48',
    '2015-03-12 18:11 +0000',
    '2020-02-07'
  ];

  testCases.forEach(testCase => {
    try {
      const normalized = normalizer.normalize(testCase);
      console.log(`  ${testCase} → ${normalized}`);
    } catch (error) {
      console.error(`  ❌ Failed to normalize: ${testCase}`);
    }
  });

  console.log('✅ DateNormalizer tests passed\n');
}

async function testGyroscopeProcessor(testDir) {
  console.log('🔄 Testing GyroscopeProcessor...');

  // Create sample steps data
  const stepsData = `date,steps,service
2018-08-02,3828,healthkit
2018-08-01,5608,healthkit
2018-07-31,4282,healthkit`;

  const stepsFile = path.join(testDir, 'gyroscope-test-steps-export.csv');
  await fs.writeFile(stepsFile, stepsData);

  // Create sample sleep data
  const sleepData = `start_time,end_time,service
2013-05-20-08:43:00,2013-05-20-15:15:00,healthkit
2013-05-21-09:00:00,2013-05-21-15:30:00,healthkit`;

  const sleepFile = path.join(testDir, 'gyroscope-test-sleep-export.csv');
  await fs.writeFile(sleepFile, sleepData);

  const processor = new GyroscopeProcessor();

  // Test steps processing
  const stepsRecords = await processor.processFile(stepsFile);
  console.log(`  Steps: ${stepsRecords.length} records processed`);

  // Test sleep processing
  const sleepRecords = await processor.processFile(sleepFile);
  console.log(`  Sleep: ${sleepRecords.length} records processed`);

  console.log('✅ GyroscopeProcessor tests passed\n');
}

async function testNikePlusProcessor(testDir) {
  console.log('⚡ Testing NikePlusProcessor...');

  const nikeData = {
    activityId: "test-activity",
    activityTimeZone: "America/Los_Angeles",
    activityType: "ALL_DAY",
    deviceType: "FUELBAND2",
    metricSummary: {
      calories: 990,
      distance: 11.436985015869141,
      duration: "9:06:00.000",
      fuel: 4125,
      steps: 14525
    }
  };

  const nikeFile = path.join(testDir, 'NikePlus-2013-11-23-test-activity-NoGPS.json');
  await fs.writeFile(nikeFile, JSON.stringify(nikeData, null, 2));

  const processor = new NikePlusProcessor();
  const records = await processor.processFile(nikeFile);

  console.log(`  Nike+: ${records.length} records processed`);
  console.log('✅ NikePlusProcessor tests passed\n');
}

async function testCoachMeProcessor(testDir) {
  console.log('🎯 Testing CoachMeProcessor...');

  const coachData = `Id,Habit,Date,Note,Check In Count,Days in Streak,Prop Count,Comment Count,URL
5895546,Eat Fruit,2013-05-01,,52,1,0,0,https://www.coach.me/c/5895546
5878018,Drink more water,2013-05-01,,90,1,1,0,https://www.coach.me/c/5878018
5878050,Weigh In,2013-05-01,,138,1,0,0,https://www.coach.me/c/5878050`;

  const coachFile = path.join(testDir, 'coach.me.export.test.csv');
  await fs.writeFile(coachFile, coachData);

  const processor = new CoachMeProcessor();
  const records = await processor.processFile(coachFile);

  console.log(`  Coach.me: ${records.length} records processed`);
  console.log('✅ CoachMeProcessor tests passed\n');
}

async function testSleepProcessor(testDir) {
  console.log('😴 Testing SleepProcessor...');

  const sleepData = `Start;End;Sleep quality;Time in bed;Wake up;Sleep Notes
2013-09-30 01:11:48;2013-09-30 08:02:47;75%;6:50;:|;
2013-09-30 23:59:13;2013-10-01 08:03:11;82%;8:03;;
2013-10-02 01:41:01;2013-10-02 09:01:33;72%;7:20;:|;`;

  const sleepFile = path.join(testDir, 'sleepdata-test.csv');
  await fs.writeFile(sleepFile, sleepData);

  const processor = new SleepProcessor();
  const records = await processor.processFile(sleepFile);

  console.log(`  Sleep: ${records.length} records processed`);
  console.log('✅ SleepProcessor tests passed\n');
}

async function testManualHealthProcessor(testDir) {
  console.log('🩺 Testing ManualHealthProcessor...');

  const migrainerData = `date,severity,duration_hours
2020-02-07,H,4
2020-02-12,H,6
2020-02-20,M,7`;

  const migraineFile = path.join(testDir, 'manual-migraine-test.csv');
  await fs.writeFile(migraineFile, migrainerData);

  const processor = new ManualHealthProcessor();
  const records = await processor.processFile(migraineFile);

  console.log(`  Manual Health: ${records.length} records processed`);
  console.log('✅ ManualHealthProcessor tests passed\n');
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests };