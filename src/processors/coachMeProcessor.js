const csv = require('csv-parser');
const fs = require('fs');
const BaseProcessor = require('./baseProcessor');

/**
 * Processor for Coach.me habit tracking CSV exports
 * Handles habit check-ins, streaks, and goal tracking
 */
class CoachMeProcessor extends BaseProcessor {
  constructor() {
    super('coach_me', 'habits');
  }

  /**
   * Process a Coach.me CSV export file
   * @param {string} filePath - Path to CSV file
   * @returns {Promise<Object[]>} Array of processed records
   */
  async processFile(filePath) {
    const records = [];
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          try {
            const record = this.processHabitRecord(row);
            if (record && this.validateRecord(record)) {
              records.push(record);
            }
          } catch (error) {
            this.logError(`Error processing row in ${filePath}`, { row, error: error.message });
          }
        })
        .on('end', () => {
          console.log(`Processed ${records.length} habit records from ${filePath}`);
          resolve(records);
        })
        .on('error', reject);
    });
  }

  /**
   * Process a single habit check-in record
   * @param {Object} row - CSV row data
   * @returns {Object|null} Processed habit record
   */
  processHabitRecord(row) {
    // Coach.me CSV format: Id,Habit,Date,Note,Check In Count,Days in Streak,Prop Count,Comment Count,URL
    if (!row.Date || !row.Habit) {
      return null;
    }
    
    const record = this.createBaseRecord(row, row.Date, 'habit_checkin');
    record.dataType = 'habits';
    
    // Core habit data
    record.habit_id = row.Id;
    record.habit_name = row.Habit.trim();
    record.checkin_date = this.dateNormalizer.normalizeDate(row.Date);
    
    // Check-in metrics
    record.checkin_count = this.createMetricValue(
      parseInt(row['Check In Count']) || 1,
      'checkins',
      1.0
    );
    
    record.streak_days = this.createMetricValue(
      parseInt(row['Days in Streak']) || 0,
      'days',
      1.0
    );
    
    // Additional metrics
    if (row['Prop Count']) {
      record.prop_count = this.createMetricValue(
        parseInt(row['Prop Count']),
        'props',
        1.0
      );
    }
    
    if (row['Comment Count']) {
      record.comment_count = this.createMetricValue(
        parseInt(row['Comment Count']),
        'comments',
        1.0
      );
    }
    
    // Notes and metadata
    record.notes = row.Note || '';
    record.coach_me_url = row.URL;
    
    // Categorize habit type based on name
    record.habit_category = this.categorizeHabit(record.habit_name);
    
    // Calculate completion status (assuming presence in CSV means completed)
    record.completed = true;
    record.completion_confidence = this.createMetricValue(1.0, 'confidence', 1.0);
    
    return record;
  }

  /**
   * Categorize habit based on name patterns
   * @param {string} habitName - Name of the habit
   * @returns {string} Category
   */
  categorizeHabit(habitName) {
    const name = habitName.toLowerCase();
    
    // Health & fitness
    if (name.includes('exercise') || name.includes('workout') || name.includes('run') || 
        name.includes('walk') || name.includes('yoga') || name.includes('stretch')) {
      return 'fitness';
    }
    
    // Nutrition
    if (name.includes('eat') || name.includes('fruit') || name.includes('vegetable') ||
        name.includes('water') || name.includes('drink') || name.includes('nutrition')) {
      return 'nutrition';
    }
    
    // Sleep
    if (name.includes('sleep') || name.includes('bed') || name.includes('rest')) {
      return 'sleep';
    }
    
    // Mental health & productivity
    if (name.includes('meditat') || name.includes('mindful') || name.includes('journal') ||
        name.includes('read') || name.includes('study') || name.includes('learn')) {
      return 'mental_health';
    }
    
    // Health monitoring
    if (name.includes('weigh') || name.includes('measure') || name.includes('track') ||
        name.includes('vitamin') || name.includes('supplement')) {
      return 'health_monitoring';
    }
    
    // Personal care
    if (name.includes('brush') || name.includes('floss') || name.includes('shower') ||
        name.includes('skincare')) {
      return 'personal_care';
    }
    
    return 'other';
  }

  /**
   * Get habit statistics from processed records
   * @param {Object[]} records - Processed habit records
   * @returns {Object} Statistics object
   */
  getHabitStats(records) {
    const stats = {
      totalCheckins: records.length,
      uniqueHabits: new Set(records.map(r => r.habit_name)).size,
      categories: {},
      longestStreak: 0,
      averageStreak: 0,
      habitFrequency: {},
      dateRange: this.getDateRange(records)
    };
    
    // Calculate category distribution
    records.forEach(record => {
      const category = record.habit_category;
      stats.categories[category] = (stats.categories[category] || 0) + 1;
      
      // Track habit frequency
      const habitName = record.habit_name;
      stats.habitFrequency[habitName] = (stats.habitFrequency[habitName] || 0) + 1;
      
      // Track longest streak
      const streakDays = record.streak_days?.value || 0;
      if (streakDays > stats.longestStreak) {
        stats.longestStreak = streakDays;
      }
    });
    
    // Calculate average streak
    const totalStreakDays = records.reduce((sum, r) => sum + (r.streak_days?.value || 0), 0);
    stats.averageStreak = records.length > 0 ? totalStreakDays / records.length : 0;
    
    return stats;
  }

  /**
   * Get date range from records
   * @param {Object[]} records - Array of records
   * @returns {Object|null} Date range object
   */
  getDateRange(records) {
    if (records.length === 0) return null;
    
    const dates = records.map(r => new Date(r.checkin_date)).sort();
    return {
      earliest: this.dateNormalizer.normalizeDate(dates[0].toISOString()),
      latest: this.dateNormalizer.normalizeDate(dates[dates.length - 1].toISOString())
    };
  }

  /**
   * Find Coach.me export files
   * @param {string} basePath - Base path to data
   * @returns {Promise<string[]>} Array of Coach.me CSV file paths
   */
  async getCoachMeFiles(basePath) {
    const fs = require('fs-extra');
    const path = require('path');
    
    const files = [];
    
    // Look for coach.me export files
    const items = await fs.readdir(basePath);
    
    for (const item of items) {
      if (item.includes('coach.me') && item.endsWith('.csv')) {
        files.push(path.join(basePath, item));
      }
    }
    
    return files;
  }
}

module.exports = CoachMeProcessor;