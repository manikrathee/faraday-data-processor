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
- **Consistent Structure**: Each record includes ID, timestamp, source metadata
- **Atomic Writes**: Safe concurrent processing
- **Validation**: Built-in validation and confidence scoring

## Supported Data Sources

| Source | Format | Data Types | Status |
|--------|--------|------------|---------|
| **Gyroscope App** | CSV | Steps, Sleep, Workouts, Health Metrics | ✅ Implemented |
| **Apple Health** | XML | Comprehensive health data | 🔄 Planned |
| **Nike+ FuelBand** | JSON/TCX | Activity tracking, Fuel points | 🔄 Planned |
| **Moves App** | JSON/CSV/GPX | Location, Activity tracking | 🔄 Planned |
| **Coach.me** | CSV | Habit tracking | 🔄 Planned |
| **Sleep Apps** | CSV | Sleep sessions, quality | 🔄 Planned |
| **Manual Data** | CSV | Custom health tracking | 🔄 Planned |

## Architecture

```
faraday-data-processor/
├── src/
│   ├── processors/          # Data source processors
│   │   ├── baseProcessor.js     # Common functionality
│   │   ├── gyroscopeProcessor.js # Gyroscope CSV processor  
│   │   └── ...                  # Other processors
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

# Process incrementally (new data only)
npm run process -- --incremental

# Dry run (see what would be processed)
npm run process -- --dry-run
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
- **`apple_health_comprehensive.json`** - Complete Apple Health export
- **`nike_plus_activity.json`** - Nike+ activity and fuel data

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

## Development

This pipeline is designed for rapid iteration and easy extension:

1. **Add New Processors**: Extend `BaseProcessor` class
2. **Custom Schemas**: Define in `src/schemas/`  
3. **Date Formats**: Extend `DateNormalizer` utility
4. **File Types**: Add patterns to configuration

Perfect for quickly processing new health data exports and maintaining consistent JSON output for database ingestion or development servers.