# MySQL Database Setup

This document explains how to set up MySQL database support for the M Data Processor.

## Prerequisites

### Install MySQL

**macOS (using Homebrew):**
```bash
brew install mysql
brew services start mysql
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
```

**Windows:**
Download and install from [MySQL official site](https://dev.mysql.com/downloads/installer/)

### Secure MySQL Installation
```bash
mysql_secure_installation
```

## Database Setup

### 1. Create Database User (Optional)
```sql
-- Connect to MySQL as root
mysql -u root -p

-- Create dedicated user for the application
CREATE USER 'm_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON m_health_data.* TO 'm_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Environment Variables (Recommended)
Create a `.env` file in the project root:
```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=m_user
MYSQL_PASSWORD=your_secure_password
MYSQL_DATABASE=m_health_data
```

## Usage

### Command Line Options

**Process data to MySQL:**
```bash
npm run process-mysql

# Or with custom configuration:
npm run process -- --database --db-type mysql --mysql-host localhost --mysql-user m_user --mysql-password your_password
```

**Process specific data type:**
```bash
npm run process -- --type apple --database --db-type mysql
```

**Environment Variables:**
```bash
export MYSQL_USER=m_user
export MYSQL_PASSWORD=your_password
npm run process-mysql
```

## Database Schema

The processor automatically creates the following tables:

### Core Tables
- **health_records**: Main table for all health data records
- **fitness_metrics**: Fitness data (steps, calories, workouts, etc.)
- **health_vitals**: Health measurements (heart rate, blood pressure, etc.)
- **sleep_sessions**: Sleep tracking data
- **location_data**: Location/visit data

### Features
- **Automatic table creation**: Tables are created automatically on first run
- **Data deduplication**: Uses `ON DUPLICATE KEY UPDATE` to handle duplicates
- **Batch processing**: Efficient bulk inserts for large datasets
- **Transaction safety**: All inserts are wrapped in transactions
- **JSON storage**: Raw data is stored as JSON for full data preservation

## Performance Tips

1. **Index optimization**: The schema includes indexes for common queries
2. **Batch size**: Default batch size is 1000 records - can be adjusted in code
3. **Connection pooling**: MySQL connection pooling is enabled by default
4. **Memory**: For large datasets (>100K records), consider increasing MySQL's `max_allowed_packet`

## Monitoring

### Check database size:
```sql
SELECT 
    table_schema AS 'Database',
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
FROM information_schema.tables
WHERE table_schema = 'm_health_data'
GROUP BY table_schema;
```

### View record counts:
```sql
USE m_health_data;

SELECT 'health_records' AS table_name, COUNT(*) AS record_count FROM health_records
UNION ALL
SELECT 'fitness_metrics', COUNT(*) FROM fitness_metrics  
UNION ALL
SELECT 'health_vitals', COUNT(*) FROM health_vitals
UNION ALL
SELECT 'sleep_sessions', COUNT(*) FROM sleep_sessions
UNION ALL
SELECT 'location_data', COUNT(*) FROM location_data;
```

## Troubleshooting

### Connection Issues
1. Check MySQL is running: `brew services list | grep mysql`
2. Test connection: `mysql -u root -p`
3. Check firewall settings if using remote MySQL

### Permission Issues
```sql
-- Grant additional permissions if needed
GRANT CREATE, ALTER, DROP, INDEX ON m_health_data.* TO 'm_user'@'localhost';
```

### Large Dataset Issues
```sql
-- Increase packet size for large JSON records
SET GLOBAL max_allowed_packet=1073741824; -- 1GB
```

## Migration from SQLite

The processor supports both SQLite and MySQL simultaneously. You can:

1. **Keep using SQLite** (default): `npm run process-db`
2. **Switch to MySQL**: `npm run process-mysql` 
3. **Use both**: Run with different `--db-type` options

Data structures are identical between both database types.