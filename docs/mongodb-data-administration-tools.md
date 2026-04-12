# MongoDB MCP Data Administration Tools Documentation

This document provides comprehensive documentation for all MongoDB MCP data administration tools available in the `apps/mongodb-mcp/src/tools/data-administration` folder.

## Overview

The MongoDB MCP server provides 12 data administration tools for managing MongoDB databases, collections, fields, indexes, and validation rules. Each tool follows consistent error handling patterns and returns structured responses.

## Tool Categories

### 📊 Database Management
- `create_database` - Create new MongoDB databases
- `list_databases` - List all databases with optional size information
- `database_stats` - Get detailed statistics for a specific database
- `drop_databases` - Permanently delete multiple databases (interactive)

### 📁 Collection Management
- `create_collection` - Create empty collections in databases
- `list_collections` - List collections with detailed information and filtering
- `collection_stats` - Get detailed statistics for a specific collection
- `drop_collection` - Permanently delete collections
- `rename_collection` - Rename existing collections

### 🔧 Field & Schema Management
- `add_fields` - Add or update fields with JSON schema validation
- `remove_fields` - Remove validation rules for fields (not data)

### 📈 Index Management
- `manage_indexes` - Interactive index management for collections

---

## Detailed Tool Documentation

### 1. create_database

**Purpose**: Create new MongoDB databases with validation.

**Parameters**:
- `databaseName` (string, required): Database name (letters, numbers, _, - only, max 64 chars)
- `confirmed` (boolean, optional, default false): Skip confirmation if true

**What it does**:
- Validates database name format
- Checks if database already exists
- Shows confirmation form unless confirmed=true
- Creates database by creating a temporary collection

**Success Response**:
```json
{
  "success": true,
  "data": {
    "name": "myapp",
    "created": true
  },
  "message": "Database 'myapp' created successfully"
}
```

**Error Types**:
- `INVALID_DATABASE_NAME`: Invalid database name format
- `DATABASE_ALREADY_EXISTS`: Database already exists
- `DATABASE_CREATION_FAILED`: Failed to create database

---

### 2. list_databases

**Purpose**: List all MongoDB databases with optional details.

**Parameters**:
- `includeSize` (boolean, optional, default false): Include database size
- `includeSystemDatabases` (boolean, optional, default false): Include system databases (admin, config, local)

**What it does**:
- Retrieves list of all databases
- Optionally filters out system databases
- Optionally includes size information

**Success Response**:
```json
{
  "success": true,
  "data": {
    "databases": [
      {"name": "myapp", "empty": false, "sizeOnDisk": 1048576}
    ],
    "totalCount": 1,
    "totalSize": 1048576
  },
  "message": "Found 1 db(s) (excl system)"
}
```

**Error Types**:
- `LIST_DATABASES_FAILED`: Failed to list databases

---

### 3. database_stats

**Purpose**: Get comprehensive statistics for a specific database.

**Parameters**:
- `databaseName` (string, required): Database name to get stats for
- `includeCollectionDetails` (boolean, optional, default true): Include stats for each collection
- `topCollections` (number, optional, default 5, range 1-20): Number of largest collections to show

**What it does**:
- Validates database exists
- Gets database statistics using `dbStats` command
- Optionally retrieves stats for all collections
- Identifies largest collections by size

**Success Response**:
```json
{
  "success": true,
  "data": {
    "databaseName": "myapp",
    "summary": {
      "sizeBytes": 1048576,
      "sizeHuman": "1.00 MB",
      "storageSizeBytes": 262144,
      "storageSizeHuman": "256.00 KB",
      "collectionCount": 3,
      "documentCount": 1000,
      "avgDocumentSizeBytes": 1024
    },
    "collections": [...],
    "topLargestCollections": [...]
  }
}
```

**Error Types**:
- `INVALID_DATABASE_NAME`: Invalid database name
- `DATABASE_NOT_FOUND`: Database doesn't exist
- `DATABASE_STATS_FAILED`: Failed to get statistics

---

### 4. drop_databases

**Purpose**: Permanently delete multiple databases with interactive confirmation.

**Parameters**: None (interactive form-based)

**What it does**:
- Lists all user databases (excludes system databases)
- Shows interactive form with database selection
- Requires typing "DELETE" to confirm
- Protects system databases from deletion
- Reports successful and failed deletions

**Success Response**:
```json
{
  "success": true,
  "data": {
    "dropped": ["test_db"],
    "failed": [],
    "totalDropped": 1,
    "totalFailed": 0
  },
  "message": "Dropped 1 db(s). Failed: 0"
}
```

**Error Types**:
- `NO_DATABASES_FOUND`: No user databases available
- `NO_DATABASES_SELECTED`: No databases selected for deletion
- `CONFIRMATION_FAILED`: Invalid confirmation
- `DATABASE_DROP_FAILED`: Failed to drop databases

---

### 5. create_collection

**Purpose**: Create empty collections in existing databases.

**Parameters**:
- `databaseName` (string, required): Existing database name
- `collectionName` (string, required): Collection name to create

**What it does**:
- Validates database and collection names
- Checks database exists
- Checks collection doesn't already exist
- Shows confirmation form
- Creates empty collection

**Success Response**:
```json
{
  "success": true,
  "data": {
    "databaseName": "myapp",
    "collectionName": "users",
    "created": true
  },
  "message": "Collection 'users' created successfully in database 'myapp'"
}
```

**Error Types**:
- `INVALID_DATABASE_NAME`: Invalid database name
- `INVALID_COLLECTION_NAME`: Invalid collection name
- `DATABASE_NOT_FOUND`: Database doesn't exist
- `COLLECTION_ALREADY_EXISTS`: Collection already exists
- `COLLECTION_CREATION_FAILED`: Failed to create collection

---

### 6. list_collections

**Purpose**: List collections in a database with detailed information and filtering options.

**Parameters**:
- `databaseName` (string, required): Database name
- `includeStats` (boolean, optional, default false): Get full collection statistics
- `includeSystemCollections` (boolean, optional, default false): Include system collections
- `namePattern` (string, optional): Regex filter for collection names
- `sortBy` (enum, optional, default "name"): Sort by name, size, or docs
- `sortOrder` (enum, optional, default "asc"): Ascending or descending

**What it does**:
- Validates database exists
- Lists all collections with optional filtering
- Optionally retrieves detailed statistics for each collection
- Supports sorting and regex filtering
- Provides summary statistics when stats included

**Success Response**:
```json
{
  "success": true,
  "data": {
    "databaseName": "myapp",
    "totalCollections": 2,
    "collections": [
      {
        "name": "users",
        "type": "collection",
        "details": {
          "documentCount": 500,
          "sizeBytes": 512000,
          "sizeHuman": "500.00 KB",
          "indexCount": 2
        }
      }
    ],
    "summary": {
      "totalDocuments": 500,
      "totalSizeBytes": 512000,
      "totalSizeHuman": "500.00 KB"
    }
  }
}
```

**Error Types**:
- `INVALID_DATABASE_NAME`: Invalid database name
- `DATABASE_NOT_FOUND`: Database doesn't exist
- `INVALID_REGEX_PATTERN`: Invalid regex pattern
- `LIST_COLLECTIONS_FAILED`: Failed to list collections

---

### 7. collection_stats

**Purpose**: Get detailed statistics for a specific collection.

**Parameters**:
- `databaseName` (string, required): Existing database name
- `collectionName` (string, required): Collection name to get stats for
- `includeIndexDetails` (boolean, optional, default false): Include detailed index information
- `includeValidationSchema` (boolean, optional, default false): Include validation schema if exists

**What it does**:
- Validates database and collection exist
- Retrieves collection statistics using `collStats` command
- Optionally includes index details
- Optionally includes validation schema

**Success Response**:
```json
{
  "success": true,
  "data": {
    "databaseName": "myapp",
    "collectionName": "users",
    "stats": {
      "documentCount": 500,
      "sizeBytes": 512000,
      "sizeHuman": "500.00 KB",
      "avgDocumentSizeBytes": 1024,
      "storageSizeBytes": 262144,
      "totalIndexSizeBytes": 16384,
      "indexCount": 2,
      "isCapped": false
    },
    "indexes": [...],
    "validationSchema": {...}
  }
}
```

**Error Types**:
- `INVALID_DATABASE_NAME`: Invalid database name
- `INVALID_COLLECTION_NAME`: Invalid collection name
- `DATABASE_NOT_FOUND`: Database doesn't exist
- `COLLECTION_NOT_FOUND`: Collection doesn't exist
- `COLLECTION_STATS_FAILED`: Failed to get statistics

---

### 8. drop_collection

**Purpose**: Permanently delete a collection and all its data.

**Parameters**:
- `databaseName` (string, required): Database name
- `collectionName` (string, required): Collection name to delete
- `confirm` (enum, required): Must be "YES" to confirm deletion

**What it does**:
- Validates database and collection names
- Requires explicit "YES" confirmation
- Protects system collections from deletion
- Permanently deletes collection and all data

**Success Response**:
```json
{
  "success": true,
  "data": {
    "databaseName": "myapp",
    "collectionName": "temp_users",
    "dropped": true
  },
  "message": "Dropped 'temp_users' from 'myapp'"
}
```

**Error Types**:
- `CONFIRMATION_FAILED`: Must select "YES" to confirm
- `INVALID_DATABASE_NAME`: Invalid database name
- `INVALID_COLLECTION_NAME`: Invalid collection name
- `DATABASE_NOT_FOUND`: Database doesn't exist
- `COLLECTION_NOT_FOUND`: Collection doesn't exist
- `SYSTEM_COLLECTION_PROTECTED`: Cannot drop system collections
- `DROP_COLLECTION_FAILED`: Failed to drop collection

---

### 9. rename_collection

**Purpose**: Rename an existing collection.

**Parameters**:
- `databaseName` (string, required): Existing database name
- `oldCollectionName` (string, required): Current collection name to rename
- `newCollectionName` (string, required): New collection name

**What it does**:
- Validates database and both collection names
- Checks old collection exists and new name doesn't exist
- Shows collection statistics in confirmation
- Performs atomic rename operation
- Warns about breaking existing applications

**Success Response**:
```json
{
  "success": true,
  "data": {
    "databaseName": "myapp",
    "oldCollectionName": "users_temp",
    "newCollectionName": "users",
    "renamed": true,
    "documentCount": 500
  },
  "message": "Successfully renamed collection 'users_temp' to 'users' in database 'myapp'"
}
```

**Error Types**:
- `INVALID_DATABASE_NAME`: Invalid database name
- `INVALID_COLLECTION_NAME`: Invalid collection name
- `SAME_COLLECTION_NAME`: Old and new names are the same
- `DATABASE_NOT_FOUND`: Database doesn't exist
- `COLLECTION_NOT_FOUND`: Old collection doesn't exist
- `COLLECTION_ALREADY_EXISTS`: New collection name already exists
- `RENAME_COLLECTION_FAILED`: Failed to rename collection

---

### 10. add_fields

**Purpose**: Add or update fields in collections with JSON schema validation.

**Parameters**:
- `databaseName` (string, required): Existing database name
- `collectionName` (string, required): Existing collection name
- `fields` (array, required): Array of field definitions with validation rules

**Field Definition Schema**:
```json
{
  "name": "fieldName",
  "type": "string|number|int|long|double|decimal|boolean|date|objectId|array|object",
  "required": false,
  "description": "Field description",
  "minimum": 0,
  "maximum": 100,
  "minLength": 1,
  "maxLength": 255,
  "pattern": "regex",
  "enum": ["value1", "value2"],
  "items": {"type": "string"},
  "properties": [...]
}
```

**What it does**:
- Validates database and collection exist
- Validates field definitions
- Identifies new vs existing fields
- Shows detailed confirmation form
- Merges new validation with existing rules
- Updates collection validator

**Success Response**:
```json
{
  "success": true,
  "data": {
    "databaseName": "myapp",
    "collectionName": "users",
    "operation": "merge_with_replace",
    "fieldsAdded": ["email"],
    "fieldsUpdated": ["age"],
    "fieldsDetails": [...],
    "validatorUpdated": true
  },
  "message": "Successfully processed 2 field(s) in 'users'\n   Added: 1 new field(s) - email\n   Updated: 1 existing field(s) - age"
}
```

**Error Types**:
- `INVALID_DATABASE_NAME`: Invalid database name
- `INVALID_COLLECTION_NAME`: Invalid collection name
- `EMPTY_FIELDS_ARRAY`: No fields provided
- `INVALID_FIELD_DEFINITIONS`: Invalid field definitions
- `DATABASE_NOT_FOUND`: Database doesn't exist
- `COLLECTION_NOT_FOUND`: Collection doesn't exist
- `ADD_FIELDS_FAILED`: Failed to add/update fields

---

### 11. remove_fields

**Purpose**: Remove validation rules for fields from collections (does not delete data).

**Parameters**:
- `databaseName` (string, required): Existing database name
- `collectionName` (string, required): Existing collection name
- `fields` (array, required): Array of field names to remove from validation

**What it does**:
- Validates database and collection exist
- Checks collection has validation rules
- Identifies which fields exist in validator
- Shows confirmation form
- Removes fields from validation schema
- Preserves existing data in documents

**Success Response**:
```json
{
  "success": true,
  "data": {
    "databaseName": "myapp",
    "collectionName": "users",
    "fieldsRemoved": ["age", "middleName"],
    "validatorUpdated": true
  },
  "message": "Removed 2 field(s) from validator: age, middleName"
}
```

**Error Types**:
- `INVALID_DATABASE_NAME`: Invalid database name
- `INVALID_COLLECTION_NAME`: Invalid collection name
- `DATABASE_NOT_FOUND`: Database doesn't exist
- `COLLECTION_NOT_FOUND`: Collection doesn't exist
- `NO_VALIDATOR_FOUND`: Collection has no validation rules
- `NO_FIELDS_TO_REMOVE`: Specified fields don't exist in validator
- `REMOVE_FIELDS_FAILED`: Failed to remove fields

---

### 12. manage_indexes

**Purpose**: Interactive index management for collection fields.

**Parameters**:
- `databaseName` (string, required): Existing database name
- `collectionName` (string, required): Existing collection name

**What it does**:
- Validates database and collection exist
- Discovers all fields in collection
- Retrieves current indexes
- Shows interactive form with checkboxes for each field
- Allows adding/removing indexes
- Reports changes and failures

**Success Response**:
```json
{
  "success": true,
  "data": {
    "databaseName": "myapp",
    "collectionName": "users",
    "indexesAdded": ["email"],
    "indexesRemoved": ["tempField"],
    "currentIndexedFields": ["_id", "email"],
    "totalIndexCount": 2,
    "changesApplied": true
  },
  "message": "Successfully added indexes on 1 field(s) and removed indexes from 1 field(s) in 'users'\n   Added: email\n   Removed: tempField"
}
```

**Error Types**:
- `INVALID_DATABASE_NAME`: Invalid database name
- `INVALID_COLLECTION_NAME`: Invalid collection name
- `DATABASE_NOT_FOUND`: Database doesn't exist
- `COLLECTION_NOT_FOUND`: Collection doesn't exist
- `MANAGE_INDEXES_FAILED`: Failed to manage indexes

---

## Common Response Patterns

### Success Response Structure
```json
{
  "success": true,
  "data": {...},
  "message": "Success message"
}
```

### Error Response Structure
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```

### Common Error Codes
- `INVALID_DATABASE_NAME`: Database name format validation failed
- `INVALID_COLLECTION_NAME`: Collection name format validation failed
- `DATABASE_NOT_FOUND`: Database doesn't exist
- `COLLECTION_NOT_FOUND`: Collection doesn't exist
- `CONNECTION_FAILED`: MongoDB connection issues

## Validation Rules

### Database Names
- Letters, numbers, underscores, and hyphens only
- Maximum 64 characters
- Cannot be: admin, config, local

### Collection Names
- Letters, numbers, underscores, and hyphens only
- Maximum 255 characters
- Cannot start with 'system.'
- Cannot be empty

### Field Types Supported
- `string`: Text values with optional pattern, minLength, maxLength
- `number`: Numeric values (double) with optional minimum, maximum
- `int`: Integer values with optional minimum, maximum
- `long`: Long integer values with optional minimum, maximum
- `double`: Double precision float with optional minimum, maximum
- `decimal`: Decimal values with optional minimum, maximum
- `boolean`: True/false values
- `date`: ISO date values
- `objectId`: MongoDB ObjectId values
- `array`: Array values with optional items type, minItems, maxItems
- `object`: Nested objects with properties

## Best Practices

1. **Always confirm destructive operations** - Tools that delete data require explicit confirmation
2. **Use field validation** - Add validation rules to ensure data quality
3. **Monitor collection sizes** - Use stats tools to track database growth
4. **Index strategically** - Add indexes to improve query performance
5. **Test with non-production data** - Validate operations before applying to production

## Interactive Forms

Several tools use interactive forms for user confirmation:
- `create_database`, `create_collection`, `rename_collection` - Simple confirm/cancel
- `add_fields`, `remove_fields` - Detailed field information with warnings
- `manage_indexes` - Dynamic field selection with checkboxes
- `drop_databases` - Multi-select with "DELETE" confirmation

These forms provide clear information about the operation being performed and require explicit user approval before making changes.
