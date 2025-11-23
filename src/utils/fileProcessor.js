const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

/**
 * Utilities for efficient file processing and change detection
 */
class FileProcessor {
  constructor() {
    this.checksumCache = new Map();
    this.cacheFile = path.join(__dirname, '../../.cache/file-checksums.json');
    this.loadChecksumCache();
  }

  /**
   * Load existing checksum cache from file
   */
  async loadChecksumCache() {
    try {
      if (await fs.pathExists(this.cacheFile)) {
        const data = await fs.readJson(this.cacheFile);
        this.checksumCache = new Map(Object.entries(data));
      }
    } catch (error) {
      console.warn('Could not load checksum cache:', error.message);
    }
  }

  /**
   * Save checksum cache to file
   */
  async saveChecksumCache() {
    try {
      await fs.ensureDir(path.dirname(this.cacheFile));
      const data = Object.fromEntries(this.checksumCache);
      await fs.writeJson(this.cacheFile, data, { spaces: 2 });
    } catch (error) {
      console.error('Could not save checksum cache:', error.message);
    }
  }

  /**
   * Calculate file checksum
   * @param {string} filePath - Path to file
   * @returns {string} MD5 checksum
   */
  async calculateChecksum(filePath) {
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
  }

  /**
   * Check if file has changed since last processing
   * @param {string} filePath - Path to file
   * @returns {boolean} True if file has changed
   */
  async hasFileChanged(filePath) {
    const currentChecksum = await this.calculateChecksum(filePath);
    const cachedChecksum = this.checksumCache.get(filePath);
    
    return currentChecksum !== cachedChecksum;
  }

  /**
   * Mark file as processed by updating its checksum
   * @param {string} filePath - Path to file
   */
  async markFileProcessed(filePath) {
    const checksum = await this.calculateChecksum(filePath);
    this.checksumCache.set(filePath, checksum);
  }

  /**
   * Get list of files that need processing (changed or new)
   * @param {string[]} filePaths - Array of file paths to check
   * @returns {string[]} Array of files that need processing
   */
  async getChangedFiles(filePaths) {
    const changedFiles = [];
    
    for (const filePath of filePaths) {
      if (await fs.pathExists(filePath)) {
        if (await this.hasFileChanged(filePath)) {
          changedFiles.push(filePath);
        }
      }
    }
    
    return changedFiles;
  }

  /**
   * Read file with automatic encoding detection
   * @param {string} filePath - Path to file
   * @returns {string} File contents
   */
  async readFileAuto(filePath) {
    // Try UTF-8 first, fallback to latin1 for older files
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (error) {
      console.warn(`UTF-8 failed for ${filePath}, trying latin1`);
      return await fs.readFile(filePath, 'latin1');
    }
  }

  /**
   * Stream large files in chunks for memory efficiency
   * @param {string} filePath - Path to large file
   * @param {Function} processor - Function to process each chunk
   * @param {Object} options - Streaming options
   */
  async streamFile(filePath, processor, options = {}) {
    const { chunkSize = 1024 * 1024 } = options; // 1MB default
    
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, {
        encoding: 'utf8',
        highWaterMark: chunkSize
      });
      
      let buffer = '';
      
      stream.on('data', (chunk) => {
        buffer += chunk;
        
        // Process complete records (lines)
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer
        
        lines.forEach(line => {
          if (line.trim()) {
            processor(line);
          }
        });
      });
      
      stream.on('end', () => {
        if (buffer.trim()) {
          processor(buffer);
        }
        resolve();
      });
      
      stream.on('error', reject);
    });
  }

  /**
   * Ensure output directory exists
   * @param {string} outputPath - Output directory path
   */
  async ensureOutputDir(outputPath) {
    await fs.ensureDir(path.dirname(outputPath));
  }

  /**
   * Write JSON data to file with atomic operation
   * @param {string} filePath - Output file path
   * @param {Object} data - Data to write
   */
  async writeJsonAtomic(filePath, data) {
    const tempFile = `${filePath}.tmp`;
    await fs.writeJson(tempFile, data, { spaces: 2 });
    await fs.move(tempFile, filePath);
  }
}

module.exports = FileProcessor;