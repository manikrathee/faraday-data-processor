#!/usr/bin/env node

/**
 * Comprehensive Enterprise Validation Suite
 * Production-ready data processing validation
 */

const path = require('path');
const fs = require('fs-extra');
const { glob } = require('glob');

// Import all processors
const GyroscopeProcessor = require('./processors/gyroscopeProcessor');
const NikePlusProcessor = require('./processors/nikePlusProcessor');
const AppleHealthProcessor = require('./processors/appleHealthProcessor');
const CoachMeProcessor = require('./processors/coachMeProcessor');
const SleepProcessor = require('./processors/sleepProcessor');
const ManualHealthProcessor = require('./processors/manualHealthProcessor');

class ComprehensiveValidation {
  constructor(dataSourcePath) {
    this.dataSourcePath = path.resolve(dataSourcePath.replace('~', require('os').homedir()));
    this.results = {
      overview: {},
      processors: {},
      dataQuality: {},
      issues: [],
      recommendations: []
    };
    this.startTime = Date.now();
  }

  async runValidation() {
    console.log('🏢 ENTERPRISE DATA PROCESSOR VALIDATION');
    console.log('======================================');
    console.log(`Source: ${this.dataSourcePath}`);
    console.log(`Started: ${new Date().toISOString()}\n`);

    // Phase 1: File Discovery
    console.log('📂 Phase 1: File Discovery & Classification');
    await this.discoverFiles();
    
    // Phase 2: Processor Testing
    console.log('\n🔄 Phase 2: Processor Validation');
    await this.validateProcessors();
    
    // Phase 3: Data Quality Analysis
    console.log('\n🔍 Phase 3: Data Quality Analysis');
    await this.analyzeDataQuality();
    
    // Phase 4: Generate Report
    console.log('\n📊 Phase 4: Enterprise Quality Report');
    const report = await this.generateReport();
    
    return report;
  }

  async discoverFiles() {
    const discovery = {
      totalFiles: 0,
      recognizedFiles: 0,
      unrecognizedFiles: 0,
      byProcessor: {},
      largestFiles: [],
      potentialIssues: []
    };

    try {
      // Get all files excluding zip/backup files
      const allFiles = await glob('**/*', {
        cwd: this.dataSourcePath,
        absolute: true,
        dot: false,
        nodir: true
      });
      
      const filteredFiles = allFiles.filter(file => 
        !file.includes('.zip') && 
        !file.includes('.tar') &&
        !file.includes('.DS_Store')
      );
      
      discovery.totalFiles = filteredFiles.length;
      console.log(`  Found ${discovery.totalFiles} data files`);

      // Test each processor's file discovery
      const processors = [
        { name: 'Gyroscope', class: GyroscopeProcessor, method: 'getGyroscopeFiles' },
        { name: 'Nike+', class: NikePlusProcessor, method: 'getNikePlusFiles' },
        { name: 'Apple Health', class: AppleHealthProcessor, method: 'getAppleHealthFiles' },
        { name: 'Coach.me', class: CoachMeProcessor, method: 'getCoachMeFiles' },
        { name: 'Sleep', class: SleepProcessor, method: 'getSleepFiles' },
        { name: 'Manual Health', class: ManualHealthProcessor, method: 'getManualHealthFiles' }
      ];

      let totalRecognized = 0;
      
      for (const { name, class: ProcessorClass, method } of processors) {
        try {
          const processor = new ProcessorClass();
          let files = [];
          
          if (method === 'getGyroscopeFiles') {
            // Special handling for Gyroscope - look in gyroscope directory
            const gyroDir = path.join(this.dataSourcePath, 'gyroscope');
            if (await fs.pathExists(gyroDir)) {
              files = (await fs.readdir(gyroDir))
                .filter(file => file.endsWith('.csv'))
                .map(file => path.join(gyroDir, file));
            }
          } else if (processor[method]) {
            files = await processor[method](this.dataSourcePath);
          }
          
          discovery.byProcessor[name] = {
            files: files.length,
            fileList: files.slice(0, 5), // Sample for report
            avgFileSize: await this.getAvgFileSize(files.slice(0, 5))
          };
          
          totalRecognized += files.length;
          console.log(`  ${name}: ${files.length} files`);
          
        } catch (error) {
          discovery.potentialIssues.push(`${name}: ${error.message}`);
        }
      }
      
      discovery.recognizedFiles = totalRecognized;
      discovery.unrecognizedFiles = discovery.totalFiles - totalRecognized;
      discovery.recognitionRate = ((totalRecognized / discovery.totalFiles) * 100).toFixed(1);
      
    } catch (error) {
      discovery.potentialIssues.push(`File discovery error: ${error.message}`);
    }

    this.results.overview = discovery;
    
    console.log(`  Recognition Rate: ${discovery.recognitionRate}%`);
    if (discovery.unrecognizedFiles > 0) {
      console.log(`  ⚠️  ${discovery.unrecognizedFiles} unrecognized files`);
    }
  }

  async validateProcessors() {
    const processorTests = [
      { name: 'Gyroscope', class: GyroscopeProcessor },
      { name: 'Nike+', class: NikePlusProcessor },
      { name: 'Apple Health', class: AppleHealthProcessor },
      { name: 'Coach.me', class: CoachMeProcessor },
      { name: 'Sleep', class: SleepProcessor },
      { name: 'Manual Health', class: ManualHealthProcessor }
    ];

    for (const { name, class: ProcessorClass } of processorTests) {
      console.log(`  🔧 Testing ${name} Processor...`);
      
      const processorResult = {
        name,
        status: 'unknown',
        filesProcessed: 0,
        recordsGenerated: 0,
        errors: 0,
        avgProcessingTime: 0,
        dataTypes: [],
        sampleRecord: null,
        issues: []
      };

      try {
        const processor = new ProcessorClass();
        const files = this.results.overview.byProcessor[name]?.fileList || [];
        
        if (files.length === 0) {
          processorResult.status = 'no_files';
          processorResult.issues.push('No files found for processing');
        } else {
          // Test with first available file
          const testFile = files[0];
          const startTime = Date.now();
          
          const records = await processor.processFile(testFile);
          const processingTime = Date.now() - startTime;
          
          processorResult.status = 'success';
          processorResult.filesProcessed = 1;
          processorResult.recordsGenerated = records.length;
          processorResult.avgProcessingTime = processingTime;
          processorResult.dataTypes = [...new Set(records.map(r => r.dataType))];
          processorResult.sampleRecord = records[0] || null;
          
          // Validate sample record
          if (processorResult.sampleRecord) {
            const validationIssues = this.validateRecord(processorResult.sampleRecord);
            processorResult.issues.push(...validationIssues);
          }
          
          console.log(`    ✅ ${records.length} records in ${processingTime}ms`);
        }
        
      } catch (error) {
        processorResult.status = 'error';
        processorResult.issues.push(error.message);
        console.log(`    ❌ ${error.message}`);
      }

      this.results.processors[name] = processorResult;
    }
  }

  async analyzeDataQuality() {
    const quality = {
      overallScore: 0,
      timestampValidation: { passed: 0, failed: 0 },
      schemaCompliance: { passed: 0, failed: 0 },
      dataConsistency: { passed: 0, failed: 0 },
      issues: []
    };

    let totalRecords = 0;
    let validRecords = 0;

    // Analyze records from each processor
    for (const [name, result] of Object.entries(this.results.processors)) {
      if (result.sampleRecord && result.status === 'success') {
        totalRecords++;
        
        // Test timestamp validation
        if (result.sampleRecord.timestamp && result.sampleRecord.timestamp !== null) {
          if (this.isValidTimestamp(result.sampleRecord.timestamp)) {
            quality.timestampValidation.passed++;
          } else {
            quality.timestampValidation.failed++;
            quality.issues.push(`${name}: Invalid timestamp format`);
          }
        }
        
        // Test schema compliance
        const requiredFields = ['id', 'timestamp', 'source', 'dataType', 'processed_at'];
        const hasAllFields = requiredFields.every(field => 
          result.sampleRecord[field] !== undefined && 
          result.sampleRecord[field] !== null
        );
        
        if (hasAllFields) {
          quality.schemaCompliance.passed++;
          validRecords++;
        } else {
          quality.schemaCompliance.failed++;
          const missingFields = requiredFields.filter(field => 
            !result.sampleRecord[field]
          );
          quality.issues.push(`${name}: Missing fields: ${missingFields.join(', ')}`);
        }
      }
    }

    // Calculate overall quality score
    const timestampScore = quality.timestampValidation.passed / Math.max(totalRecords, 1);
    const schemaScore = quality.schemaCompliance.passed / Math.max(totalRecords, 1);
    const processingScore = validRecords / Math.max(totalRecords, 1);
    
    quality.overallScore = Math.round(
      (timestampScore * 30 + schemaScore * 40 + processingScore * 30) * 100
    );

    this.results.dataQuality = quality;
    
    console.log(`  Quality Score: ${quality.overallScore}/100`);
    console.log(`  Schema Compliance: ${quality.schemaCompliance.passed}/${totalRecords}`);
    console.log(`  Timestamp Validation: ${quality.timestampValidation.passed}/${totalRecords}`);
  }

  async generateReport() {
    const duration = Date.now() - this.startTime;
    const { overview, processors, dataQuality } = this.results;
    
    // Generate recommendations
    const recommendations = [];
    
    if (overview.recognitionRate < 50) {
      recommendations.push({
        priority: 'HIGH',
        issue: 'Low file recognition rate',
        solution: 'Add more file processors or improve file pattern matching'
      });
    }
    
    if (dataQuality.overallScore < 80) {
      recommendations.push({
        priority: 'HIGH', 
        issue: 'Data quality below enterprise standard',
        solution: 'Fix schema compliance and timestamp parsing issues'
      });
    }
    
    // Count successful processors
    const successfulProcessors = Object.values(processors).filter(p => p.status === 'success').length;
    const totalProcessors = Object.keys(processors).length;
    
    if (successfulProcessors < totalProcessors) {
      recommendations.push({
        priority: 'MEDIUM',
        issue: 'Some processors failed',
        solution: 'Investigate and fix failed processor issues'
      });
    }

    this.results.recommendations = recommendations;

    // Create markdown report
    const reportPath = path.join(__dirname, '../enterprise-validation-report.md');
    const markdownReport = this.generateMarkdownReport();
    await fs.writeFile(reportPath, markdownReport);

    // Console summary
    console.log('\n📊 ENTERPRISE VALIDATION SUMMARY');
    console.log('================================');
    console.log(`Overall Quality Score: ${dataQuality.overallScore}/100`);
    console.log(`File Recognition: ${overview.recognitionRate}%`);
    console.log(`Processor Success: ${successfulProcessors}/${totalProcessors}`);
    console.log(`Validation Time: ${(duration/1000).toFixed(2)}s`);
    console.log(`\nFull Report: ${reportPath}`);
    
    // Quality assessment
    if (dataQuality.overallScore >= 90) {
      console.log('\n🏆 ENTERPRISE GRADE - Excellent quality, production ready');
    } else if (dataQuality.overallScore >= 80) {
      console.log('\n✅ PRODUCTION READY - Good quality with minor issues');
    } else if (dataQuality.overallScore >= 70) {
      console.log('\n⚠️  NEEDS IMPROVEMENT - Address issues before production');
    } else {
      console.log('\n❌ NOT PRODUCTION READY - Critical issues require resolution');
    }
    
    if (recommendations.length > 0) {
      console.log('\n🔧 RECOMMENDATIONS:');
      recommendations.forEach((rec, i) => {
        console.log(`${i+1}. [${rec.priority}] ${rec.issue}`);
        console.log(`   Solution: ${rec.solution}`);
      });
    }

    return this.results;
  }

  // Helper methods
  async getAvgFileSize(files) {
    if (files.length === 0) return 0;
    
    let totalSize = 0;
    let validFiles = 0;
    
    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        totalSize += stats.size;
        validFiles++;
      } catch (error) {
        // Skip files that can't be accessed
      }
    }
    
    return validFiles > 0 ? Math.round(totalSize / validFiles / 1024) : 0; // KB
  }

  validateRecord(record) {
    const issues = [];
    
    if (!record.id) issues.push('Missing ID');
    if (!record.timestamp) issues.push('Missing timestamp');
    if (!record.source) issues.push('Missing source');
    if (!record.dataType) issues.push('Missing dataType');
    if (!record.processed_at) issues.push('Missing processed_at');
    
    return issues;
  }

  isValidTimestamp(timestamp) {
    const regex = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/;
    return regex.test(timestamp);
  }

  generateMarkdownReport() {
    const { overview, processors, dataQuality, recommendations } = this.results;
    
    return `# Enterprise Data Processor Validation Report

**Generated:** ${new Date().toISOString()}  
**Data Source:** ${this.dataSourcePath}  
**Quality Score:** ${dataQuality.overallScore}/100

## Executive Summary

- **Total Files:** ${overview.totalFiles}
- **Recognition Rate:** ${overview.recognitionRate}%
- **Processor Success:** ${Object.values(processors).filter(p => p.status === 'success').length}/6
- **Data Quality:** ${dataQuality.overallScore}/100

## File Discovery Results

${Object.entries(overview.byProcessor).map(([name, data]) => 
  `- **${name}:** ${data.files} files (avg ${data.avgFileSize}KB)`
).join('\n')}

## Processor Validation

${Object.entries(processors).map(([name, result]) => `
### ${name}
- **Status:** ${result.status}
- **Records Generated:** ${result.recordsGenerated}
- **Processing Time:** ${result.avgProcessingTime}ms
- **Data Types:** ${result.dataTypes.join(', ')}
- **Issues:** ${result.issues.length > 0 ? result.issues.join(', ') : 'None'}
`).join('\n')}

## Data Quality Analysis

- **Schema Compliance:** ${dataQuality.schemaCompliance.passed}/${dataQuality.schemaCompliance.passed + dataQuality.schemaCompliance.failed}
- **Timestamp Validation:** ${dataQuality.timestampValidation.passed}/${dataQuality.timestampValidation.passed + dataQuality.timestampValidation.failed}
- **Quality Issues:** ${dataQuality.issues.length}

${dataQuality.issues.length > 0 ? `
### Quality Issues:
${dataQuality.issues.map(issue => `- ${issue}`).join('\n')}
` : ''}

## Recommendations

${recommendations.length === 0 ? '✅ No major issues found' : 
recommendations.map(rec => `
### [${rec.priority}] ${rec.issue}
**Solution:** ${rec.solution}
`).join('\n')}

## Overall Assessment

${dataQuality.overallScore >= 90 ? '🏆 **ENTERPRISE GRADE** - Production ready with excellent quality' :
  dataQuality.overallScore >= 80 ? '✅ **PRODUCTION READY** - Good quality with minor issues' :
  dataQuality.overallScore >= 70 ? '⚠️ **NEEDS IMPROVEMENT** - Address issues before production' :
  '❌ **NOT PRODUCTION READY** - Critical issues require resolution'}

---
*Generated by Faraday Data Processor Enterprise Validation Suite*
`;
  }
}

// CLI execution
if (require.main === module) {
  const dataSourcePath = process.argv[2] || '~/Developer/_Data-Source';
  
  const validator = new ComprehensiveValidation(dataSourcePath);
  validator.runValidation()
    .then(results => {
      const exitCode = results.dataQuality.overallScore >= 70 ? 0 : 1;
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('💥 Validation failed:', error);
      process.exit(1);
    });
}

module.exports = ComprehensiveValidation;