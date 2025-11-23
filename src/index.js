#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs-extra');
const GyroscopeProcessor = require('./processors/gyroscopeProcessor');

const program = new Command();

program
  .name('faraday-data-processor')
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
  .action(async (options) => {
    try {
      const sourcePath = path.resolve(options.source.replace('~', require('os').homedir()));
      const outputPath = path.resolve(options.output);
      
      console.log('🚀 Faraday Data Processor');
      console.log(`Source: ${sourcePath}`);
      console.log(`Output: ${outputPath}`);
      console.log(`Incremental: ${options.incremental}`);
      console.log(`Type filter: ${options.type || 'all'}`);
      
      // Ensure output directory exists
      await fs.ensureDir(outputPath);
      
      const startTime = Date.now();
      let totalProcessed = 0;
      let totalErrors = 0;
      
      // Process Gyroscope data
      if (!options.type || options.type === 'gyroscope') {
        console.log('\n📊 Processing Gyroscope data...');
        
        const gyroscopeDir = path.join(sourcePath, 'gyroscope');
        if (await fs.pathExists(gyroscopeDir)) {
          const gyroscopeFiles = (await fs.readdir(gyroscopeDir))
            .filter(file => file.endsWith('.csv'))
            .map(file => path.join(gyroscopeDir, file));
          
          if (options.dryRun) {
            console.log('Would process files:', gyroscopeFiles);
            return;
          }
          
          const processor = new GyroscopeProcessor();
          const result = await processor.processFiles(gyroscopeFiles, options.incremental);
          
          // Group records by data type for separate output files
          const recordsByType = {};
          result.records.forEach(record => {
            const type = record.dataType;
            if (!recordsByType[type]) recordsByType[type] = [];
            recordsByType[type].push(record);
          });
          
          // Save each data type to separate files
          for (const [dataType, records] of Object.entries(recordsByType)) {
            const outputFile = path.join(outputPath, `gyroscope_${dataType}.json`);
            await processor.saveToJson(outputFile, records);
          }
          
          totalProcessed += result.processed;
          totalErrors += result.errors;
          
          console.log(`✅ Gyroscope: ${result.processed} records processed, ${result.errors} errors`);
          
          // Show statistics
          const stats = processor.getStats();
          console.log(`📈 Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
          if (stats.dateRange) {
            console.log(`📅 Date range: ${stats.dateRange.earliest} to ${stats.dateRange.latest}`);
          }
        } else {
          console.log('⚠️  Gyroscope directory not found');
        }
      }
      
      // TODO: Add other processors (Nike+, Apple Health, etc.)
      
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
    const sourcePath = path.resolve(options.source.replace('~', require('os').homedir()));
    
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

// If no command specified, show help
if (process.argv.length <= 2) {
  program.help();
}

program.parse(process.argv);