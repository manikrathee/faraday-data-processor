# Faraday Data Processor

A high-performance, modular data processing pipeline for normalizing health, fitness, and personal data from multiple sources into consistent JSON output optimized for database ingestion.

## Key Features

### 🚀 **Speed & Efficiency**
- **Incremental Processing**: Only processes changed files using checksums
- **Memory Efficient**: Streaming for large files, chunked processing  
- **Caching System**: Tracks processed files to avoid redundant work
- **Fast File Detection**: Automatically identifies data types and formats

### 📊 **Consistent JSON Output**
- **Standardized Schemas**: Separate schemas for fitness, health, sleep data
- **Unified Timestamps**: All dates normalized to `MM/DD/YYYY HH:MM:SS`
- **Data Type Separation**: Output files grouped by data type for easy database ingestion
- **Source Attribution**: Every record includes original source metadata

### 🔧 **Modular Architecture**
- **BaseProcessor**: Common functionality for all data sources
- **Pluggable Design**: Easy to add new processors for other sources
- **Error Handling**: Comprehensive validation and error logging
- **Configuration Driven**: JSON-based configuration for all settings

### 🎯 **Database Ready**
- **SQLite Integration**: Built-in database with normalized relational schema
- **Automatic Schema Creation**: Tables and indexes created automatically
- **Real-time Stats**: Query database for insights and analytics
- **Incremental Updates**: Efficient updating of existing data

## Supported Data Sources

| Source | Format | Data Types | Status |
|--------|--------|------------|---------|
| **Gyroscope App** | CSV | Steps, Sleep, Workouts, Health Metrics | ✅ Implemented |
| **Apple Health** | XML | Comprehensive health data | ✅ Implemented |
| **Nike+ FuelBand** | JSON/TCX | Activity tracking, Fuel points | ✅ Implemented |
| **Coach.me** | CSV | Habit tracking, streaks | ✅ Implemented |
| **Sleep Apps** | CSV | Sleep sessions, quality | ✅ Implemented |
| **Manual Health** | CSV | Symptoms, medications, vitals | ✅ Implemented |
| **Moves App** | JSON/CSV/GPX | Location, Activity tracking | 🔄 Planned |

## Architecture

```
faraday-data-processor/
├── src/
│   ├── processors/          # Data source processors
│   │   ├── baseProcessor.js     # Common functionality
│   │   ├── gyroscopeProcessor.js # Gyroscope CSV processor
│   │   ├── nikePlusProcessor.js  # Nike+ FuelBand processor
│   │   ├── appleHealthProcessor.js # Apple Health XML processor
│   │   ├── coachMeProcessor.js   # Coach.me habits processor
│   │   ├── sleepProcessor.js     # Sleep data processor
│   │   └── manualHealthProcessor.js # Manual health data
│   ├── database/           # Database integration
│   │   ├── schema.js           # Database table schemas
│   │   ├── connection.js       # SQLite connection manager
│   │   └── dataMapper.js       # JSON to relational mapping
│   ├── schemas/            # JSON schema definitions
│   │   ├── base.js             # Common record structure
│   │   ├── fitness.js          # Fitness data schema
│   │   ├── health.js           # Health metrics schema
│   │   └── sleep.js            # Sleep data schema
│   ├── utils/              # Common utilities
│   │   ├── dateNormalizer.js   # Date format conversion
│   │   └── fileProcessor.js    # File operations & caching
│   └── index.js            # CLI interface
├── output/                 # Processed JSON output by type
├── config/                 # Configuration files
│   └── sources.json        # Data source configuration
└── .cache/                 # Processing cache files
```

## Quick Start

```bash
# Install dependencies
npm install

# Analyze data sources
npm run analyze

# Process all data sources
npm run process

# Process specific data type
npm run process -- --type=gyroscope
npm run process -- --type=nike
npm run process -- --type=apple
npm run process -- --type=coach
npm run process -- --type=sleep
npm run process -- --type=manual

# Process incrementally (new data only)
npm run process -- --incremental

# Dry run (see what would be processed)
npm run process -- --dry-run

# Run built-in tests
npm test

## Database Operations

# Process data and save to database
npm run process-db

# Create database and tables
npm run db:create

# Show database statistics  
npm run db:stats

# Reset database (delete all data)
npm run db:reset

# Vacuum database to reclaim space
npm run db:vacuum

# Query specific data
node src/index.js query --start-date "01/01/2023" --end-date "12/31/2023" --source gyroscope
```

## Data Output Structure

All data is normalized into consistent JSON structures with guaranteed fields:

### Base Record Structure
```json
{
  "id": "uuid-v4",
  "timestamp": "MM/DD/YYYY HH:MM:SS",
  "source": "gyroscope|apple_health|nike_plus",
  "dataType": "fitness|health|sleep",
  "subType": "steps|workout|heart_rate",
  "processed_at": "MM/DD/YYYY HH:MM:SS",
  "raw_data": { "original": "data" }
}
```

### Output Files by Data Type
- **`gyroscope_fitness.json`** - Steps, calories, distance, workouts
- **`gyroscope_health.json`** - Heart rate, blood pressure, glucose, mood  
- **`gyroscope_sleep.json`** - Sleep sessions, quality metrics
- **`apple_health_mixed.json`** - Complete Apple Health export (all data types)
- **`nike_plus_fitness.json`** - Nike+ activity and fuel data
- **`coach_me_habits.json`** - Habit tracking and streaks
- **`sleep_tracker_sleep.json`** - Sleep analysis and quality
- **`manual_health_health.json`** - Self-tracked symptoms and vitals

### Database Tables
When using database mode, data is stored in normalized relational tables:
- **`health_records`** - Base table with all record metadata
- **`fitness_metrics`** - Steps, calories, workouts, distance data
- **`health_vitals`** - Heart rate, blood pressure, glucose, weight
- **`sleep_sessions`** - Sleep duration, quality, efficiency metrics  
- **`habits`** - Habit tracking with streaks and categories
- **`symptoms`** - Symptom tracking, pain levels, conditions
- **`medications`** - Medication tracking with dosages
- **`locations`** - GPS and location data (for future use)

## Gyroscope Data Types Supported

The GyroscopeProcessor currently handles 16+ data types from CSV exports:

| Type | Description | Output Schema |
|------|-------------|---------------|
| `steps` | Daily step counts | Fitness |
| `sleep` | Sleep sessions | Sleep |  
| `workouts` | Exercise sessions | Fitness |
| `running`/`cycling` | Specific activities | Fitness |
| `bp` | Blood pressure | Health |
| `glucose` | Blood glucose | Health |
| `hrv` | Heart rate variability | Health |
| `rhr` | Resting heart rate | Health |
| `mood` | Mood tracking | Health |

## Processor Capabilities

### Nike+ FuelBand Processor
- **JSON Activity Files**: Daily activity summaries with fuel points, steps, calories
- **Minute-by-Minute Data**: Detailed breakdown of activity throughout the day
- **Device Types**: FuelBand v1 and v2 support
- **Date Range**: 2011-2014 historical data

### Apple Health Processor  
- **Large XML Support**: Streaming processor for multi-GB export files
- **25+ Health Metrics**: Steps, heart rate, blood pressure, glucose, weight, etc.
- **Workout Data**: Exercise sessions with duration, calories, distance
- **Confidence Scoring**: Higher confidence for Apple device data

### Coach.me Processor
- **Habit Categories**: Automatic categorization (fitness, nutrition, mental health, etc.)
- **Streak Tracking**: Days in streak, completion rates
- **Multiple Habits**: Support for concurrent habit tracking
- **Goal Analytics**: Progression and success metrics

### Sleep Processor
- **Format Detection**: Automatic detection of CSV delimiter and structure
- **Multiple Formats**: Supports various sleep app exports
- **Quality Metrics**: Sleep efficiency, quality percentages, duration
- **Sleep Stages**: Deep, light, REM sleep breakdown (when available)

### Manual Health Processor
- **Smart Detection**: Automatic health data type detection from filename
- **Symptom Tracking**: Migraines, pain, medications
- **Severity Mapping**: Converts text severity to numeric scales
- **Flexible Schema**: Handles various manual tracking formats

## Configuration

Edit `config/sources.json` to customize:

```json
{
  "dataSources": {
    "gyroscope": {
      "enabled": true,
      "path": "gyroscope/",
      "processor": "GyroscopeProcessor"
    }
  },
  "processing": {
    "batchSize": 1000,
    "enableCache": true,
    "enableValidation": true
  }
}
```

## Performance Features

### Incremental Processing
```bash
# First run processes all files
npm run process

# Subsequent runs only process changed files  
npm run process -- --incremental
```

### File Change Detection
- MD5 checksums track file changes
- Cache stored in `.cache/file-checksums.json`
- Automatic detection of new/modified files

### Memory Management
- Streaming for large XML files
- Chunked processing for massive datasets
- Configurable batch sizes

## Example Output

### Fitness Record (Steps)
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "08/02/2018 00:00:00",
  "source": "gyroscope", 
  "dataType": "fitness",
  "subType": "steps",
  "steps": {
    "value": 3828,
    "unit": "steps", 
    "confidence": 0.9
  },
  "measurement_source": "healthkit",
  "processed_at": "11/23/2025 10:30:15"
}
```

### Sleep Record  
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "timestamp": "05/20/2013 08:43:00",
  "source": "gyroscope",
  "dataType": "sleep", 
  "subType": "sleep",
  "sleep_start": "05/20/2013 08:43:00",
  "sleep_end": "05/20/2013 15:15:00",
  "sleep_duration": {
    "value": 392,
    "unit": "minutes",
    "confidence": 0.8
  }
}
```

## Database Integration

### Quick Start with Database

```bash
# 1. Install dependencies
npm install

# 2. Create database
npm run db:create

# 3. Process data directly to database
npm run process-db

# 4. Check statistics
npm run db:stats
```

### Database Features

**Automatic Schema Management:**
- Creates 8 normalized tables automatically
- Foreign key relationships maintained
- Proper indexing for fast queries
- SQLite for portability and performance

**Data Integrity:**
- UPSERT operations prevent duplicates
- Transaction-based batch inserts
- Confidence scoring for data quality
- Source attribution for all records

**Query Capabilities:**
```bash
# Query by date range
node src/index.js query --start-date "01/01/2023" --end-date "12/31/2023"

# Filter by data source
node src/index.js query --source "gyroscope" --limit 50

# Filter by data type
node src/index.js query --type "fitness" --limit 100

# Get database statistics
npm run db:stats
```

**Database Schema Overview:**
```sql
-- Base records table
health_records (id, timestamp, source, data_type, sub_type, processed_at)

-- Specialized data tables
fitness_metrics (steps, calories, distance, workout_type, fuel_points)
health_vitals (heart_rate, blood_pressure, glucose, weight, bmi)
sleep_sessions (sleep_duration, quality, efficiency, deep_sleep)
habits (habit_name, streak_days, category, completion_rate)
symptoms (condition, severity, duration, pain_location)
medications (medication_name, dosage, frequency)
```

### Example Database Usage

```javascript
const processor = new GyroscopeProcessor();

// Initialize database
await processor.initializeDatabase('./my-health-data.db');

// Process files and save to database
await processor.processFiles(files, false); // Process all files
await processor.saveToDatabase(); // Save to database

// Query data
const records = await processor.getRecordsByDateRange('01/01/2023', '12/31/2023');
const stats = await processor.getDatabaseStats();

// Clean up
processor.closeDatabase();
```

## Development

This pipeline is designed for rapid iteration and easy extension:

1. **Add New Processors**: Extend `BaseProcessor` class
2. **Custom Schemas**: Define in `src/schemas/`  
3. **Date Formats**: Extend `DateNormalizer` utility
4. **File Types**: Add patterns to configuration

Perfect for quickly processing new health data exports and maintaining consistent JSON output for database ingestion or development servers.