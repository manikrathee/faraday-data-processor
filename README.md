# Faraday Data Processor

A high-performance, modular data processing pipeline for normalizing health, fitness, and personal data from multiple sources into consistent JSON output optimized for database ingestion.

## Features

- **Fast Incremental Processing**: Efficiently processes only new/changed data
- **Consistent JSON Output**: Standardized schemas by data type
- **Modular Architecture**: Pluggable processors for different data sources
- **Database Ready**: Optimized output for direct database/server ingestion
- **Date Normalization**: Converts all timestamps to MM/DD/YYYY HH:MM:SS format

## Supported Data Sources

- Apple Health (XML)
- Nike+ FuelBand (JSON/TCX)
- Gyroscope App (CSV)
- Moves App (JSON/CSV/GPX)
- Coach.me (CSV)
- Sleep tracking apps (CSV)
- Manual health data (CSV)
- Social media analytics (CSV)

## Architecture

```
faraday-data-processor/
├── src/
│   ├── processors/          # Data source processors
│   ├── schemas/            # JSON schema definitions
│   ├── utils/              # Common utilities
│   └── core/               # Core processing engine
├── output/                 # Processed JSON output by type
├── config/                 # Configuration files
└── tests/                  # Test suite
```

## Quick Start

```bash
# Install dependencies
npm install

# Process all data sources
npm run process

# Process specific data type
npm run process -- --type=fitness

# Process incrementally (new data only)
npm run process -- --incremental
```

## Data Types & Output

All data is normalized into consistent JSON structures:

- `fitness.json` - Steps, calories, distance, workouts
- `health.json` - Heart rate, blood pressure, glucose
- `sleep.json` - Sleep sessions, quality metrics
- `habits.json` - Habit tracking, streaks
- `location.json` - GPS tracks, places visited

## Configuration

Edit `config/sources.json` to specify data source locations and processing options.