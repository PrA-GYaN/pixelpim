# Advanced Filtering and Sorting Features

## 📋 Overview
The PixelPim backend now includes comprehensive filtering and sorting capabilities for both Attributes and Families, providing powerful search and organization tools for better data management.

## 🔍 Attribute Filtering Features

### Available Filters

1. **Search Filter**
   - Search by attribute name (case-insensitive)
   - Example: `?search=color`

2. **User-Friendly Type Filter**
   - Filter by human-readable attribute types
   - Available types: Short Text, Paragraph, HTML, Integer, Decimal, Dropdown, Multiselect, Date, URL, Boolean
   - Example: `?userFriendlyType=Integer`

3. **Date Filters**
   - `latest` - Shows newest attributes first
   - `oldest` - Shows oldest attributes first
   - Example: `?dateFilter=latest`

4. **Default Value Filter**
   - `hasDefaultValue=true` - Attributes with default values
   - `hasDefaultValue=false` - Attributes without default values
   - Example: `?hasDefaultValue=true`

5. **Group Membership Filter**
   - `inGroups=true` - Attributes that belong to groups
   - `inGroups=false` - Attributes not in any group
   - Example: `?inGroups=true`

6. **Date Range Filters**
   - `createdAfter` - Attributes created after specified date
   - `createdBefore` - Attributes created before specified date
   - Example: `?createdAfter=2024-01-01&createdBefore=2024-12-31`

### Sorting Options

- **Fields**: `name`, `type`, `createdAt`, `updatedAt`, `totalAttributes` (for groups)
- **Order**: `asc` (ascending), `desc` (descending)
- Default: Sort by name ascending
- Example: `?sortBy=createdAt&sortOrder=desc`

### Usage Examples

```http
# Basic search with pagination
GET /attributes?search=product&page=1&limit=10

# Filter by type with sorting
GET /attributes?userFriendlyType=text&sortBy=name&sortOrder=asc

# Complex filtering
GET /attributes?search=size&hasDefaultValue=true&inGroups=false&dateFilter=latest&limit=20
```

## 🏠 Family Filtering Features

### Available Filters

1. **Search Filter**
   - Search by family name (case-insensitive)
   - Example: `?search=electronics`

2. **Attribute-based Filters**
   - `attributeIds` - Filter families containing specific attributes
   - `attributeFilter=any` - Family contains ANY of the specified attributes (default)
   - `attributeFilter=all` - Family contains ALL specified attributes
   - Example: `?attributeIds=1,2,3&attributeFilter=any`

3. **Product Filters**
   - `hasProducts=true` - Families with products
   - `hasProducts=false` - Families without products
   - `minProducts` - Minimum number of products
   - `maxProducts` - Maximum number of products
   - Example: `?hasProducts=true&minProducts=5`

4. **Attribute Count Filters**
   - `hasRequiredAttributes=true/false` - Families with/without required attributes
   - `minAttributes` - Minimum number of attributes
   - `maxAttributes` - Maximum number of attributes
   - Example: `?minAttributes=3&maxAttributes=10`

5. **Date Filters**
   - Same as attributes: `latest`, `oldest`, `createdAfter`, `createdBefore`
   - Example: `?dateFilter=latest`

### Sorting Options

- **Fields**: `name`, `createdAt`, `updatedAt`, `totalProducts`, `totalAttributes`
- **Order**: `asc`, `desc`
- Default: Sort by name ascending
- Example: `?sortBy=totalProducts&sortOrder=desc`

### Usage Examples

```http
# Sort by product count
GET /families?sortBy=totalProducts&sortOrder=desc

# Filter by attributes (families containing ANY of these attributes)
GET /families?attributeIds=1,2,3&attributeFilter=any

# Filter by attributes (families containing ALL of these attributes)  
GET /families?attributeIds=1,2&attributeFilter=all

# Complex filtering
GET /families?search=phone&hasProducts=true&minProducts=10&attributeIds=1,2&sortBy=totalProducts&sortOrder=desc
```

## 🎯 Attribute Groups Filtering

### Available Filters

1. **Search Filter**
   - Search by group name or description
   - Example: `?search=product`

2. **Description Filter**
   - `hasDescription=true/false` - Groups with/without descriptions
   - Example: `?hasDescription=true`

3. **Attribute Count Filters**
   - `minAttributes` - Minimum attributes in group
   - `maxAttributes` - Maximum attributes in group
   - Example: `?minAttributes=5&maxAttributes=20`

4. **Date Filters**
   - Same date filtering as other entities
   - Example: `?dateFilter=latest`

### Sorting Options

- **Fields**: `name`, `createdAt`, `updatedAt`, `totalAttributes`
- Example: `?sortBy=totalAttributes&sortOrder=desc`

### Usage Examples

```http
# Groups with many attributes
GET /attributes/groups?sortBy=totalAttributes&sortOrder=desc

# Groups with descriptions, created recently
GET /attributes/groups?hasDescription=true&dateFilter=latest&minAttributes=3
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

## 📝 Additional Suggestions Implemented

1. **Comprehensive Search**: Case-insensitive search across relevant fields
2. **Range Filters**: Min/max filters for numeric values (product counts, attribute counts)
3. **Membership Filters**: Filter by relationship presence (in groups, has products, etc.)
4. **Date Range Filtering**: Flexible date filtering with before/after options
5. **Multi-criteria Filtering**: Combine multiple filters for precise results
6. **Intelligent Defaults**: Sensible default sorting and pagination values

## 🎨 Frontend Integration Ready

The filtering system is designed to be frontend-friendly with:
- Clear query parameter naming
- Consistent response formats
- User-friendly type mappings
- Comprehensive error handling
- Flexible combination of filters

This implementation provides a powerful and flexible filtering system that can handle simple searches as well as complex multi-criteria filtering scenarios.
