# Asset and Asset Group Filtering Guide

## 📋 Overview
The PixelPim backend now includes comprehensive filtering and sorting capabilities for both Assets and Asset Groups, providing powerful search and organization tools for better digital asset management.

## 🔍 Asset Filtering Features

### Available Filters

1. **Search Filter**
   - Search by asset name or file name (case-insensitive)
   - Example: `?search=logo`

2. **MIME Type Filter**
   - Filter by file type/MIME type
   - Example: `?mimeType=image` or `?mimeType=pdf`

3. **Size Filters**
   - `minSize` - Minimum file size in bytes
   - `maxSize` - Maximum file size in bytes
   - Example: `?minSize=1000&maxSize=5000000`

4. **Date Filters**
   - `latest` - Shows newest assets first
   - `oldest` - Shows oldest assets first
   - Example: `?dateFilter=latest`

5. **Group Membership Filter**
   - `hasGroup=true` - Assets that belong to groups
   - `hasGroup=false` - Assets not in any group
   - Example: `?hasGroup=true`

6. **Date Range Filters**
   - `createdAfter` - Assets created after specified date
   - `createdBefore` - Assets created before specified date
   - Example: `?createdAfter=2024-01-01&createdBefore=2024-12-31`

7. **Asset Group Filter**
   - `assetGroupId` - Filter assets by specific group ID
   - Example: `?assetGroupId=5`

### Sorting Options

- **Fields**: `name`, `fileName`, `size`, `createdAt`, `updatedAt`
- **Order**: `asc` (ascending), `desc` (descending)
- Default: Sort by createdAt descending
- Example: `?sortBy=size&sortOrder=desc`

### Usage Examples

```http
# Basic search with pagination
GET /assets?search=product&page=1&limit=10

# Filter by MIME type with sorting
GET /assets?mimeType=image&sortBy=size&sortOrder=desc

# Complex filtering
GET /assets?search=logo&hasGroup=false&minSize=1000&dateFilter=latest&limit=20

# Filter by specific asset group
GET /assets?assetGroupId=3&sortBy=name&sortOrder=asc
```

## 🏠 Asset Group Filtering Features

### Available Filters

1. **Search Filter**
   - Search by group name (case-insensitive)
   - Example: `?search=marketing`

2. **Asset Count Filters**
   - `minAssets` - Minimum number of assets in group
   - `maxAssets` - Maximum number of assets in group
   - Example: `?minAssets=5&maxAssets=50`

3. **Size Filters**
   - `minSize` - Minimum total size of assets in group (bytes)
   - `maxSize` - Maximum total size of assets in group (bytes)
   - Example: `?minSize=10000&maxSize=100000000`

4. **Asset Presence Filter**
   - `hasAssets=true` - Groups with assets
   - `hasAssets=false` - Groups without assets
   - Example: `?hasAssets=true`

5. **Date Filters**
   - Same as assets: `latest`, `oldest`, `createdAfter`, `createdBefore`
   - Example: `?dateFilter=latest`

### Sorting Options

- **Fields**: `groupName`, `createdAt`, `updatedAt`
- **Order**: `asc`, `desc`
- Default: Sort by createdAt descending
- Example: `?sortBy=groupName&sortOrder=asc`

### Usage Examples

```http
# Sort by group name
GET /asset-groups?sortBy=groupName&sortOrder=asc

# Filter groups with many assets
GET /asset-groups?minAssets=10&hasAssets=true

# Complex filtering
GET /asset-groups?search=brand&hasAssets=true&minAssets=5&sortBy=groupName&sortOrder=asc
```

## 🎯 Assets in Group Filtering

When fetching assets within a specific group (`/asset-groups/:id/assets`), the following filters are available:

### Available Filters

1. **Search Filter**
   - Search by asset name or file name
   - Example: `?search=banner`

2. **MIME Type Filter**
   - Filter by file type within the group
   - Example: `?mimeType=image`

3. **Size Filters**
   - `minSize` and `maxSize` filters
   - Example: `?minSize=5000&maxSize=2000000`

### Sorting Options

- **Fields**: `name`, `fileName`, `size`, `createdAt`, `updatedAt`
- Example: `?sortBy=size&sortOrder=desc`

### Usage Examples

```http
# Get large images in a specific group
GET /asset-groups/5/assets?mimeType=image&minSize=100000&sortBy=size&sortOrder=desc

# Search within a group
GET /asset-groups/3/assets?search=logo&sortBy=name&sortOrder=asc
```

## 🚀 Advanced Features

### Pagination
- All endpoints support pagination with `page` and `limit` parameters
- Default: `page=1`, `limit=10`
- Maximum limit: 100

### Response Format
All filtered endpoints return paginated responses:

```json
{
  "data": [/* array of results */],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Performance Optimizations
- Database indexes on commonly filtered fields
- Efficient Prisma queries with proper includes
- Pagination to prevent large data loads
- Post-query filtering for computed fields (asset counts, total sizes)

## 📝 Key Features Implemented

1. **Comprehensive Search**: Case-insensitive search across relevant fields
2. **Range Filters**: Min/max filters for numeric values (file sizes, asset counts)
3. **Membership Filters**: Filter by relationship presence (in groups, has assets, etc.)
4. **Date Range Filtering**: Flexible date filtering with before/after options
5. **Multi-criteria Filtering**: Combine multiple filters for precise results
6. **Intelligent Defaults**: Sensible default sorting and pagination values
7. **Type Safety**: Proper TypeScript interfaces for filtering parameters

## 🎨 Frontend Integration

The filtering system is designed to be frontend-friendly with:
- Clear query parameter naming
- Consistent response formats
- Type-safe filtering interfaces
- Comprehensive error handling
- Flexible combination of filters

## 📋 Updated Status Logic

The product status completion logic has been updated with new rules:

### Status Completion Rules

1. **Family with Required Attributes**: If a product has a family, all required family attributes must have product-attribute values (not just default values) for the status to be "complete"

2. **Custom Attributes**: If a product has custom attributes, all of them must have product-attribute values (not just default values) for the status to be "complete"

3. **No Family or Custom Attributes**: If a product has neither family nor custom attributes, the status is "complete"

### Changes from Previous Logic

- **Before**: Status was "complete" if attributes had either custom values OR default values
- **After**: Status is "complete" only if attributes have actual product-attribute values (custom values), default values are not sufficient

This ensures that products are only marked as complete when all required information has been explicitly provided through product-attribute values.

This implementation provides a powerful and flexible filtering system that can handle simple searches as well as complex multi-criteria filtering scenarios for digital asset management.