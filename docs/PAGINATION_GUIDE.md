# Pagination API Testing Examples

This file contains examples of how to use the new pagination features in all API endpoints.

## Common Pagination Parameters

All list endpoints now support the following query parameters:
- `page`: Page number (default: 1)
- `limit`: Number of items per page (default: 10, max: 100)

## Response Format

All paginated responses follow this format:
```json
{
  "data": [...], // Array of items
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

## Products API

### Get All Products (Paginated)
```http
GET /products?page=1&limit=10
GET /products?page=2&limit=5&status=active
GET /products?page=1&limit=20&categoryId=1
```

### Get Products by Category (Paginated)
```http
GET /products/category/1?page=1&limit=10
```

### Get Products by Attribute (Paginated)
```http
GET /products/attribute/1?page=1&limit=10
```

### Get Products by Attribute Group (Paginated)
```http
GET /products/attribute-group/1?page=1&limit=10
```

### Get Products by Family (Paginated)
```http
GET /products/family/1?page=1&limit=10
```

## Categories API

### Get All Categories (Paginated)
```http
GET /categories?page=1&limit=10
GET /categories?tree=false&page=1&limit=5
```

### Get Category Tree (Not Paginated)
```http
GET /categories?tree=true
GET /categories/tree
```

### Get Subcategories (Paginated)
```http
GET /categories/1/subcategories?page=1&limit=10
```

## Families API

### Get All Families (Paginated)
```http
GET /families?page=1&limit=10
```

## Attributes API

### Get All Attributes (Paginated)
```http
GET /attributes?page=1&limit=10
```

## Attribute Groups API

### Get All Attribute Groups (Paginated)
```http
GET /attribute-groups?page=1&limit=10
```

## Assets API

### Get All Assets (Paginated)
```http
GET /assets?page=1&limit=10
GET /assets?assetGroupId=1&page=1&limit=5
```

## Asset Groups API

### Get All Asset Groups (Paginated)
```http
GET /asset-groups?page=1&limit=10
```

### Get Assets in Group (Paginated)
```http
GET /asset-groups/1/assets?page=1&limit=10
```

## Benefits of Pagination

1. **Performance**: Reduces server load and response time
2. **User Experience**: Faster page loads and better navigation
3. **Scalability**: Handles large datasets efficiently
4. **Consistency**: Uniform pagination across all APIs
5. **Flexibility**: Configurable page sizes up to 100 items

## Default Values

- Page: 1
- Limit: 10
- Max Limit: 100

## Error Handling

Invalid pagination parameters will be automatically corrected:
- Page < 1 → Page = 1
- Limit < 1 → Limit = 1
- Limit > 100 → Limit = 100
