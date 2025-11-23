# Data Source Analysis Report

## Overview

The `~/Developer/_Data-Source` directory contains comprehensive health, fitness, and personal data from multiple platforms spanning 2011-2025. This collection represents a rich dataset for creating a normalized data processing pipeline.

## Data Sources Identified

### 1. Apple Health Data
- **Files**: `apple_health_export_20250501/export.xml`, `apple_health_export_20251118/export.xml`
- **Format**: Large XML files (too large to read fully)
- **Data Source**: Apple HealthKit
- **Date Range**: 2025 exports
- **Content**: Comprehensive health metrics (steps, heart rate, workouts, etc.)
- **Notes**: Most recent and comprehensive data source

### 2. Nike+ FuelBand Data
- **Files**: `Run Data/NikePlus Run Data/*.json`, `Run Data/NikePlus complete/*.log`
- **Format**: JSON and TCX files
- **Data Source**: Nike+ FuelBand (v1 and v2)
- **Date Range**: 2011-2014
- **Content**: Activity tracking with fuel points, steps, calories, distance
- **Sample Structure**:
  ```json
  {
    "activityId": "unique-id",
    "activityTimeZone": "America/Los_Angeles", 
    "activityType": "ALL_DAY",
    "deviceType": "FUELBAND2",
    "metricSummary": {
      "calories": 990,
      "distance": 11.436985015869141,
      "duration": "9:06:00.000",
      "fuel": 4125,
      "steps": 14525
    }
  }
  ```

### 3. Gyroscope App Data
- **Files**: `gyroscope/gyroscope-Manik-*-export.csv`
- **Format**: CSV files
- **Data Source**: Gyroscope app (aggregated from various sources)
- **Date Range**: 2013-2018
- **Categories**: 
  - Steps: `date,steps,service` (from HealthKit)
  - Sleep: `start_time,end_time,service` (YYYY-MM-DD-HH:MM:SS format)
  - Workouts: `id,start_time,end_time,type,name,service,calories`
  - Blood Pressure, Cycling, Glucose, HRV, Running, Mood, etc.

### 4. Moves App Data
- **Files**: `moves_export/` directory with multiple format exports
- **Format**: ZIP archives containing CSV, JSON, GeoJSON, GPX formats
- **Data Source**: Moves app (location and activity tracking)
- **Notes**: Multiple export formats available for same data

### 5. Coach.me Habit Tracking
- **Files**: `coach.me.export.20161005024736.csv`
- **Format**: CSV
- **Date Range**: 2013-2016
- **Structure**: `Id,Habit,Date,Note,Check In Count,Days in Streak,Prop Count,Comment Count,URL`
- **Content**: Habit tracking (eating fruit, drinking water, reading, etc.)

### 6. Sleep Tracking Data
- **Files**: `sleepdata.csv`
- **Format**: CSV with semicolon delimiters
- **Date Range**: 2013
- **Structure**: `Start;End;Sleep quality;Time in bed;Wake up;Sleep Notes`
- **Date Format**: `YYYY-MM-DD HH:MM:SS`

### 7. Manual Health Data
- **Files**: `manual-migraine-data.csv`
- **Format**: CSV
- **Date Range**: 2020
- **Structure**: `date,severity,duration_hours`
- **Content**: Self-tracked migraine episodes

### 8. Social Media Analytics
- **Files**: `_20150312tweet_activity_metrics.csv`
- **Format**: CSV with extensive Twitter analytics data
- **Date Range**: 2015
- **Content**: Tweet engagement metrics, impressions, etc.

### 9. Genetic Data
- **Files**: `genome_Manik_Rathee_v3_Full_20200815113051.txt`
- **Format**: Tab-separated text file
- **Data Source**: 23andMe
- **Content**: Raw genetic data (SNPs)
- **Notes**: Research/educational use only

### 10. Nike FuelBand API Dump
- **Files**: `fuel_dump/` directory
- **Format**: Python script with log outputs
- **Purpose**: API data extraction tool
- **Content**: JSON formatted activity data

## Date Format Analysis

### Current Date Formats Found:
1. **ISO-like**: `2018-08-02` (Gyroscope)
2. **DateTime**: `2013-05-20-08:43:00` (Gyroscope sleep)
3. **Standard DateTime**: `2013-09-30 01:11:48` (sleep data)
4. **Twitter Format**: `2015-03-12 18:11 +0000`
5. **Simple Date**: `2020-02-07` (migraine data)

### Target Format: `MM/DD/YYYY HH:MM:SS`

## Data Processing Recommendations

### Normalization Strategy:
1. **Unified JSON Structure**: Convert all data to consistent JSON format
2. **Standardized Timestamps**: Convert all dates to `MM/DD/YYYY HH:MM:SS`
3. **Source Attribution**: Add metadata fields for original data source
4. **Category Classification**: Group by data type (fitness, health, sleep, etc.)

### Key Processing Challenges:
- **Large XML Files**: Apple Health exports require streaming/chunked processing
- **Multiple Formats**: Same data exists in different formats (ZIP archives)
- **Date Variations**: Extensive date format normalization needed
- **Missing GPS**: Many Nike+ files marked as "NoGPS"
- **Encoding Issues**: Some files use different delimiters (semicolons vs commas)

## File Structure Summary

```
_Data-Source/
├── apple_health_export_20250501/
│   ├── export.xml (comprehensive health data)
│   └── export_cda.xml
├── apple_health_export_20251118/
│   ├── export.xml (most recent)
│   └── export_cda.xml
├── Run Data/
│   ├── NikePlus Run Data/ (JSON/TCX files 2013-2014)
│   └── NikePlus complete/ (extensive log files 2011-2014)
├── gyroscope/
│   └── gyroscope-Manik-*-export.csv (16 different data types)
├── moves_export/
│   └── [multiple ZIP archives with various formats]
├── fuel_dump/
│   └── [Python extraction tool + logs]
├── coach.me.export.20161005024736.csv
├── sleepdata.csv
├── manual-migraine-data.csv
├── _20150312tweet_activity_metrics.csv
└── genome_Manik_Rathee_v3_Full_20200815113051.txt
```

## Recommended Processing Order

1. **Start with Gyroscope CSV files** - well-structured, multiple data types
2. **Process Nike+ JSON files** - consistent format, good metadata
3. **Handle Apple Health XML** - most comprehensive but requires streaming
4. **Process smaller CSV files** - sleep, habits, migraines
5. **Skip ZIP archives** - use unzipped equivalents when available
6. **Genetic data** - separate processing due to different use case

This analysis provides the foundation for creating a robust data processing pipeline that can normalize diverse health and fitness data sources into a unified JSON format with standardized timestamps.