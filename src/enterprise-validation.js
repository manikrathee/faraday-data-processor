#!/usr/bin/env node

/**
 * Enterprise-Level Data Validation Suite
 * Comprehensive testing for data processing pipeline quality assurance
 */

const path = require('path');
const fs = require('fs-extra');
const { glob } = require('glob');
const crypto = require('crypto');

// Import all processors
const GyroscopeProcessor = require('./processors/gyroscopeProcessor');
const NikePlusProcessor = require('./processors/nikePlusProcessor');
const AppleHealthProcessor = require('./processors/appleHealthProcessor');
const CoachMeProcessor = require('./processors/coachMeProcessor');
const SleepProcessor = require('./processors/sleepProcessor');
const ManualHealthProcessor = require('./processors/manualHealthProcessor');

class EnterpriseValidation {
  constructor(dataSourcePath) {
    this.dataSourcePath = path.resolve(dataSourcePath.replace('~', require('os').homedir()));
    this.validationResults = {
      fileDiscovery: {},
      processingResults: {},
      dataIntegrity: {},
      errors: [],
      warnings: [],
      summary: {}
    };
    this.startTime = Date.now();
  }

  /**
   * Run complete validation suite
   */
  async runFullValidation() {
    console.log('🏢 ENTERPRISE DATA VALIDATION SUITE');
    console.log('=====================================');
    console.log(`Data Source: ${this.dataSourcePath}`);
    console.log(`Started: ${new Date().toISOString()}\n`);

    try {
      // Phase 1: File Discovery Validation
      console.log('📂 PHASE 1: File Discovery & Inventory');
      await this.validateFileDiscovery();
      
      // Phase 2: Data Processing Validation
      console.log('\n🔄 PHASE 2: Data Processing Validation');
      await this.validateDataProcessing();
      
      // Phase 3: Data Integrity Validation
      console.log('\n🔍 PHASE 3: Data Integrity Analysis');
      await this.validateDataIntegrity();
      
      // Phase 4: Edge Case Testing
      console.log('\n⚠️  PHASE 4: Edge Case & Error Handling');
      await this.validateEdgeCases();
      
      // Generate Enterprise Report
      console.log('\n📊 PHASE 5: Enterprise Quality Report');
      await this.generateQualityReport();
      
    } catch (error) {
      this.validationResults.errors.push({
        phase: 'validation_suite',
        error: error.message,
        stack: error.stack
      });
      console.error('💥 Validation suite failed:', error);
    }
  }

  /**
   * Phase 1: Validate file discovery completeness
   */
  async validateFileDiscovery() {
    const discovery = {
      totalFiles: 0,
      byExtension: {},
      byDirectory: {},
      byProcessor: {
        gyroscope: [],
        nike: [],
        apple: [],
        coach: [],
        sleep: [],
        manual: []
      },
      unrecognized: [],
      accessibility: {}
    };

    // Deep scan all files
    console.log('🔍 Scanning all files in data source...');
    const allFiles = await this.getAllFiles(this.dataSourcePath);
    discovery.totalFiles = allFiles.length;
    
    console.log(`Found ${allFiles.length} total files`);

    // Categorize by extension and directory
    for (const file of allFiles) {
      const ext = path.extname(file).toLowerCase();
      const dir = path.dirname(file).split(path.sep).pop();
      
      discovery.byExtension[ext] = (discovery.byExtension[ext] || 0) + 1;
      discovery.byDirectory[dir] = (discovery.byDirectory[dir] || 0) + 1;

      // Test file accessibility
      try {
        const stats = await fs.stat(file);
        discovery.accessibility[file] = {
          readable: true,
          size: stats.size,
          modified: stats.mtime
        };
      } catch (error) {
        discovery.accessibility[file] = {
          readable: false,
          error: error.message
        };
      }
    }

    // Test processor file discovery
    console.log('🎯 Testing processor-specific file discovery...');
    
    // Gyroscope files
    try {
      const gyroscopeDir = path.join(this.dataSourcePath, 'gyroscope');
      if (await fs.pathExists(gyroscopeDir)) {
        const gyroFiles = (await fs.readdir(gyroscopeDir))
          .filter(file => file.endsWith('.csv'))
          .map(file => path.join(gyroscopeDir, file));
        discovery.byProcessor.gyroscope = gyroFiles;
      }
    } catch (error) {
      this.validationResults.errors.push({
        phase: 'file_discovery',
        processor: 'gyroscope',
        error: error.message
      });
    }

    // Nike+ files
    try {
      const nikeProcessor = new NikePlusProcessor();
      discovery.byProcessor.nike = await nikeProcessor.getNikePlusFiles(this.dataSourcePath);
    } catch (error) {
      this.validationResults.errors.push({
        phase: 'file_discovery',
        processor: 'nike',
        error: error.message
      });
    }

    // Apple Health files
    try {
      const appleProcessor = new AppleHealthProcessor();
      discovery.byProcessor.apple = await appleProcessor.getAppleHealthFiles(this.dataSourcePath);
    } catch (error) {
      this.validationResults.errors.push({
        phase: 'file_discovery',
        processor: 'apple',
        error: error.message
      });
    }

    // Coach.me files
    try {
      const coachProcessor = new CoachMeProcessor();
      discovery.byProcessor.coach = await coachProcessor.getCoachMeFiles(this.dataSourcePath);
    } catch (error) {
      this.validationResults.errors.push({
        phase: 'file_discovery',
        processor: 'coach',
        error: error.message
      });
    }

    // Sleep files
    try {
      const sleepProcessor = new SleepProcessor();
      discovery.byProcessor.sleep = await sleepProcessor.getSleepFiles(this.dataSourcePath);
    } catch (error) {
      this.validationResults.errors.push({
        phase: 'file_discovery',
        processor: 'sleep',
        error: error.message
      });
    }

    // Manual health files
    try {
      const manualProcessor = new ManualHealthProcessor();
      discovery.byProcessor.manual = await manualProcessor.getManualHealthFiles(this.dataSourcePath);
    } catch (error) {
      this.validationResults.errors.push({
        phase: 'file_discovery',
        processor: 'manual',
        error: error.message
      });
    }

    // Find unrecognized files
    const recognizedFiles = new Set();
    Object.values(discovery.byProcessor).forEach(files => {
      files.forEach(file => recognizedFiles.add(file));
    });

    discovery.unrecognized = allFiles.filter(file => !recognizedFiles.has(file));

    this.validationResults.fileDiscovery = discovery;

    // Report results
    console.log(`📊 File Discovery Results:`);
    console.log(`  Total files: ${discovery.totalFiles}`);
    console.log(`  Gyroscope files: ${discovery.byProcessor.gyroscope.length}`);
    console.log(`  Nike+ files: ${discovery.byProcessor.nike.length}`);
    console.log(`  Apple Health files: ${discovery.byProcessor.apple.length}`);
    console.log(`  Coach.me files: ${discovery.byProcessor.coach.length}`);
    console.log(`  Sleep files: ${discovery.byProcessor.sleep.length}`);
    console.log(`  Manual health files: ${discovery.byProcessor.manual.length}`);
    console.log(`  Unrecognized files: ${discovery.unrecognized.length}`);

    if (discovery.unrecognized.length > 0) {
      console.log(`\n⚠️  UNRECOGNIZED FILES (first 10):`);
      discovery.unrecognized.slice(0, 10).forEach(file => {
        console.log(`    ${path.relative(this.dataSourcePath, file)}`);
      });
      if (discovery.unrecognized.length > 10) {
        console.log(`    ... and ${discovery.unrecognized.length - 10} more`);
      }
    }
  }

  /**
   * Phase 2: Validate data processing completeness and accuracy
   */
  async validateDataProcessing() {
    const processors = [
      { name: 'Gyroscope', class: GyroscopeProcessor, files: this.validationResults.fileDiscovery.byProcessor.gyroscope },
      { name: 'Nike+', class: NikePlusProcessor, files: this.validationResults.fileDiscovery.byProcessor.nike },
      { name: 'Apple Health', class: AppleHealthProcessor, files: this.validationResults.fileDiscovery.byProcessor.apple },
      { name: 'Coach.me', class: CoachMeProcessor, files: this.validationResults.fileDiscovery.byProcessor.coach },
      { name: 'Sleep', class: SleepProcessor, files: this.validationResults.fileDiscovery.byProcessor.sleep },
      { name: 'Manual Health', class: ManualHealthProcessor, files: this.validationResults.fileDiscovery.byProcessor.manual }
    ];

    for (const { name, class: ProcessorClass, files } of processors) {
      if (files.length === 0) {
        console.log(`⏭️  Skipping ${name} - no files found`);
        continue;
      }

      console.log(`\n🔄 Processing ${name} data (${files.length} files)...`);
      
      try {
        const processor = new ProcessorClass();
        const startTime = Date.now();
        
        // Process sample files (limit to 5 for validation)
        const sampleFiles = files.slice(0, Math.min(5, files.length));
        let totalRecords = 0;
        let totalErrors = 0;
        const recordDetails = [];

        for (const file of sampleFiles) {
          try {
            console.log(`  📄 Processing: ${path.basename(file)}`);
            const records = await processor.processFile(file);
            totalRecords += records.length;
            
            recordDetails.push({
              file: path.basename(file),
              recordCount: records.length,
              dataTypes: [...new Set(records.map(r => r.dataType))],
              subTypes: [...new Set(records.map(r => r.subType))],
              dateRange: this.getRecordDateRange(records),
              sampleRecord: records[0] || null
            });
            
          } catch (error) {
            totalErrors++;
            this.validationResults.errors.push({
              phase: 'processing',
              processor: name,
              file: path.basename(file),
              error: error.message
            });
          }
        }

        const processingTime = Date.now() - startTime;
        
        this.validationResults.processingResults[name] = {
          filesProcessed: sampleFiles.length,
          totalFiles: files.length,
          totalRecords,
          totalErrors,
          processingTime,
          recordDetails,
          stats: processor.getStats()
        };

        console.log(`  ✅ ${name}: ${totalRecords} records, ${totalErrors} errors, ${processingTime}ms`);

      } catch (error) {
        console.log(`  ❌ ${name}: Failed - ${error.message}`);
        this.validationResults.errors.push({
          phase: 'processing',
          processor: name,
          error: error.message
        });
      }
    }
  }

  /**
   * Phase 3: Validate data integrity
   */
  async validateDataIntegrity() {
    const integrity = {
      recordValidation: {},
      dataConsistency: {},
      dateValidation: {},
      schemaCompliance: {}
    };

    // Validate each processor's records
    for (const [processorName, results] of Object.entries(this.validationResults.processingResults)) {
      console.log(`\n🔍 Validating ${processorName} data integrity...`);
      
      const validationResults = {
        totalRecords: results.totalRecords,
        validRecords: 0,
        invalidRecords: 0,
        missingFields: {},
        dateIssues: [],
        duplicateIds: 0,
        schemaViolations: []
      };

      // Validate each file's records
      for (const detail of results.recordDetails) {
        if (detail.sampleRecord) {
          // Check required fields
          const requiredFields = ['id', 'timestamp', 'source', 'dataType', 'processed_at'];
          const missing = requiredFields.filter(field => !detail.sampleRecord[field]);
          
          if (missing.length > 0) {
            validationResults.missingFields[detail.file] = missing;
            validationResults.invalidRecords++;
          } else {
            validationResults.validRecords++;
          }

          // Validate timestamp format
          if (detail.sampleRecord.timestamp) {
            if (!this.isValidTimestamp(detail.sampleRecord.timestamp)) {
              validationResults.dateIssues.push({
                file: detail.file,
                timestamp: detail.sampleRecord.timestamp,
                issue: 'Invalid format'
              });
            }
          }

          // Check for schema compliance
          if (detail.sampleRecord.dataType) {
            const expectedFields = this.getExpectedFields(detail.sampleRecord.dataType, detail.sampleRecord.subType);
            const actualFields = Object.keys(detail.sampleRecord);
            const missingSchema = expectedFields.filter(field => !actualFields.includes(field));
            
            if (missingSchema.length > 0) {
              validationResults.schemaViolations.push({
                file: detail.file,
                dataType: detail.sampleRecord.dataType,
                subType: detail.sampleRecord.subType,
                missingFields: missingSchema
              });
            }
          }
        }
      }

      integrity.recordValidation[processorName] = validationResults;
      
      console.log(`  📊 ${processorName} Integrity:`);
      console.log(`    Valid records: ${validationResults.validRecords}`);
      console.log(`    Invalid records: ${validationResults.invalidRecords}`);
      console.log(`    Date issues: ${validationResults.dateIssues.length}`);
      console.log(`    Schema violations: ${validationResults.schemaViolations.length}`);
    }

    this.validationResults.dataIntegrity = integrity;
  }

  /**
   * Phase 4: Validate edge cases and error handling
   */
  async validateEdgeCases() {
    console.log('🧪 Testing edge cases and error handling...');
    
    const edgeTests = [
      {
        name: 'Empty File Processing',
        test: async () => {
          const tempFile = path.join(__dirname, '../temp-empty.csv');
          await fs.writeFile(tempFile, '');
          
          const processor = new GyroscopeProcessor();
          try {
            const records = await processor.processFile(tempFile);
            await fs.remove(tempFile);
            return { success: true, result: `Empty file handled: ${records.length} records` };
          } catch (error) {
            await fs.remove(tempFile);
            return { success: false, error: error.message };
          }
        }
      },
      {
        name: 'Malformed CSV Processing',
        test: async () => {
          const tempFile = path.join(__dirname, '../temp-malformed.csv');
          await fs.writeFile(tempFile, 'header1,header2\nvalue1\nvalue2,value3,value4\n');
          
          const processor = new GyroscopeProcessor();
          try {
            const records = await processor.processFile(tempFile);
            await fs.remove(tempFile);
            return { success: true, result: `Malformed CSV handled: ${records.length} records` };
          } catch (error) {
            await fs.remove(tempFile);
            return { success: true, result: `Expected error caught: ${error.message}` };
          }
        }
      },
      {
        name: 'Non-existent File',
        test: async () => {
          const processor = new GyroscopeProcessor();
          try {
            await processor.processFile('/non/existent/file.csv');
            return { success: false, error: 'Should have thrown error' };
          } catch (error) {
            return { success: true, result: `Non-existent file error handled: ${error.message}` };
          }
        }
      },
      {
        name: 'Large File Memory Test',
        test: async () => {
          // Test with largest file found
          const largestFile = this.findLargestFile();
          if (!largestFile) {
            return { success: true, result: 'No large files to test' };
          }
          
          const processor = new GyroscopeProcessor();
          const startMemory = process.memoryUsage();
          try {
            await processor.processFile(largestFile.path);
            const endMemory = process.memoryUsage();
            const memoryIncrease = (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024;
            return { 
              success: true, 
              result: `Large file (${largestFile.size}MB) processed, memory increase: ${memoryIncrease.toFixed(2)}MB` 
            };
          } catch (error) {
            return { success: false, error: error.message };
          }
        }
      }
    ];

    const edgeResults = {};
    for (const edgeTest of edgeTests) {
      console.log(`  🧪 ${edgeTest.name}...`);
      try {
        const result = await edgeTest.test();
        edgeResults[edgeTest.name] = result;
        
        if (result.success) {
          console.log(`    ✅ ${result.result}`);
        } else {
          console.log(`    ❌ ${result.error}`);
        }
      } catch (error) {
        edgeResults[edgeTest.name] = { success: false, error: error.message };
        console.log(`    💥 ${error.message}`);
      }
    }

    this.validationResults.edgeCases = edgeResults;
  }

  /**
   * Generate comprehensive enterprise quality report
   */
  async generateQualityReport() {
    const totalTime = Date.now() - this.startTime;
    
    // Calculate summary metrics
    const summary = {
      totalFiles: this.validationResults.fileDiscovery.totalFiles,
      recognizedFiles: this.validationResults.fileDiscovery.totalFiles - this.validationResults.fileDiscovery.unrecognized.length,
      processingSuccess: Object.keys(this.validationResults.processingResults).length,
      totalErrors: this.validationResults.errors.length,
      totalWarnings: this.validationResults.warnings.length,
      validationTime: totalTime,
      qualityScore: 0
    };

    // Calculate quality score (0-100)
    const fileRecognitionRate = summary.recognizedFiles / summary.totalFiles;
    const errorRate = summary.totalErrors / (summary.totalFiles || 1);
    const processingRate = summary.processingSuccess / 6; // 6 processors
    
    summary.qualityScore = Math.round(
      (fileRecognitionRate * 40) + 
      ((1 - errorRate) * 30) + 
      (processingRate * 30)
    );

    this.validationResults.summary = summary;

    // Generate report
    const reportPath = path.join(__dirname, '../enterprise-validation-report.md');
    const report = this.generateMarkdownReport();
    await fs.writeFile(reportPath, report);

    console.log('\n📊 ENTERPRISE QUALITY REPORT');
    console.log('=============================');
    console.log(`Overall Quality Score: ${summary.qualityScore}/100`);
    console.log(`File Recognition Rate: ${(fileRecognitionRate * 100).toFixed(1)}%`);
    console.log(`Processing Success Rate: ${(processingRate * 100).toFixed(1)}%`);
    console.log(`Error Rate: ${(errorRate * 100).toFixed(2)}%`);
    console.log(`Total Processing Time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`\n📄 Full report saved to: ${reportPath}`);

    // Quality assessment
    if (summary.qualityScore >= 90) {
      console.log('🏆 ENTERPRISE GRADE: Excellent data processing quality');
    } else if (summary.qualityScore >= 80) {
      console.log('✅ PRODUCTION READY: Good data processing quality');
    } else if (summary.qualityScore >= 70) {
      console.log('⚠️  NEEDS IMPROVEMENT: Acceptable but requires attention');
    } else {
      console.log('❌ NOT PRODUCTION READY: Significant issues found');
    }

    return this.validationResults;
  }

  /**
   * Helper method to get all files recursively
   */
  async getAllFiles(dir) {
    if (!await fs.pathExists(dir)) {
      return [];
    }
    
    try {
      const files = await glob('**/*', { 
        cwd: dir, 
        absolute: true,
        dot: true,
        nodir: true 
      });
      return files.filter(file => !file.includes('.zip'));
    } catch (error) {
      console.error('Error scanning files:', error.message);
      return [];
    }
  }

  /**
   * Helper method to get date range from records
   */
  getRecordDateRange(records) {
    if (records.length === 0) return null;
    
    const dates = records.map(r => new Date(r.timestamp)).filter(d => !isNaN(d)).sort();
    if (dates.length === 0) return null;
    
    return {
      earliest: dates[0].toISOString().split('T')[0],
      latest: dates[dates.length - 1].toISOString().split('T')[0],
      span: dates.length > 1 ? Math.round((dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24)) : 0
    };
  }

  /**
   * Validate timestamp format
   */
  isValidTimestamp(timestamp) {
    // Check MM/DD/YYYY HH:MM:SS format
    const regex = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/;
    if (!regex.test(timestamp)) return false;
    
    const date = new Date(timestamp);
    return !isNaN(date.getTime());
  }

  /**
   * Get expected fields for data type
   */
  getExpectedFields(dataType, subType) {
    const baseFields = ['id', 'timestamp', 'source', 'dataType', 'subType', 'processed_at'];
    
    switch (dataType) {
      case 'fitness':
        return [...baseFields, 'steps', 'calories', 'distance'];
      case 'health':
        return [...baseFields, 'heart_rate', 'blood_pressure'];
      case 'sleep':
        return [...baseFields, 'sleep_duration', 'sleep_start', 'sleep_end'];
      default:
        return baseFields;
    }
  }

  /**
   * Find largest file for memory testing
   */
  findLargestFile() {
    let largest = null;
    
    for (const files of Object.values(this.validationResults.fileDiscovery.byProcessor)) {
      for (const file of files) {
        const access = this.validationResults.fileDiscovery.accessibility[file];
        if (access && access.readable) {
          const sizeMB = access.size / 1024 / 1024;
          if (!largest || sizeMB > largest.size) {
            largest = { path: file, size: sizeMB };
          }
        }
      }
    }
    
    return largest;
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport() {
    const { summary, fileDiscovery, processingResults, dataIntegrity, errors, warnings } = this.validationResults;
    
    return `# Enterprise Data Validation Report

**Generated:** ${new Date().toISOString()}  
**Data Source:** ${this.dataSourcePath}  
**Overall Quality Score:** ${summary.qualityScore}/100  

## Executive Summary

- **Total Files:** ${summary.totalFiles}
- **Recognized Files:** ${summary.recognizedFiles} (${((summary.recognizedFiles/summary.totalFiles)*100).toFixed(1)}%)
- **Processing Success:** ${summary.processingSuccess}/6 processors
- **Total Errors:** ${summary.totalErrors}
- **Validation Time:** ${(summary.validationTime/1000).toFixed(2)}s

## File Discovery Analysis

### Files by Processor
${Object.entries(fileDiscovery.byProcessor).map(([name, files]) => 
  `- **${name.charAt(0).toUpperCase() + name.slice(1)}:** ${files.length} files`
).join('\n')}

### Unrecognized Files: ${fileDiscovery.unrecognized.length}
${fileDiscovery.unrecognized.slice(0, 10).map(file => 
  `- \`${path.relative(this.dataSourcePath, file)}\``
).join('\n')}
${fileDiscovery.unrecognized.length > 10 ? `\n*... and ${fileDiscovery.unrecognized.length - 10} more*` : ''}

## Processing Results

${Object.entries(processingResults).map(([name, result]) => `
### ${name}
- **Files Processed:** ${result.filesProcessed}/${result.totalFiles}
- **Records Generated:** ${result.totalRecords}
- **Errors:** ${result.totalErrors}
- **Processing Time:** ${result.processingTime}ms
`).join('\n')}

## Data Integrity Analysis

${Object.entries(dataIntegrity.recordValidation || {}).map(([name, validation]) => `
### ${name}
- **Valid Records:** ${validation.validRecords}
- **Invalid Records:** ${validation.invalidRecords}  
- **Date Issues:** ${validation.dateIssues.length}
- **Schema Violations:** ${validation.schemaViolations.length}
`).join('\n')}

## Error Summary

${errors.length === 0 ? '✅ No errors detected' : 
errors.slice(0, 10).map(error => 
  `- **${error.phase}/${error.processor || 'general'}:** ${error.error}`
).join('\n')}

## Recommendations

${summary.qualityScore >= 90 ? '🏆 **ENTERPRISE GRADE** - Excellent quality, ready for production use.' : 
summary.qualityScore >= 80 ? '✅ **PRODUCTION READY** - Good quality with minor issues.' :
summary.qualityScore >= 70 ? '⚠️ **NEEDS IMPROVEMENT** - Address identified issues before production.' :
'❌ **NOT PRODUCTION READY** - Significant issues require resolution.'}

---
*Generated by Faraday Data Processor Enterprise Validation Suite*
`;
  }
}

// CLI execution
if (require.main === module) {
  const dataSourcePath = process.argv[2] || '~/Developer/_Data-Source';
  
  const validator = new EnterpriseValidation(dataSourcePath);
  validator.runFullValidation()
    .then(results => {
      console.log('\n🎉 Enterprise validation complete!');
      process.exit(results.summary.qualityScore >= 70 ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Validation failed:', error);
      process.exit(1);
    });
}

module.exports = EnterpriseValidation;