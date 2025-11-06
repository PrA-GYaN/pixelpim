# Integration Logs API Documentation

## Overview

The Integration Logs API provides comprehensive endpoints for tracking and analyzing integration activities between your PIM system and external platforms (WooCommerce, Amazon, Shopify, etc.).

All endpoints are protected by JWT authentication and automatically filter results by the authenticated user's ID.

**Base Route:** `/api/integration/logs`

## Authentication

All endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

## Endpoints

### 1. GET /api/integration/logs

Retrieve paginated integration logs with optional filters.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number (min: 1) |
| limit | number | 20 | Results per page (min: 1) |
| integrationType | enum | - | Filter by platform: `woocommerce`, `amazon`, `shopify` |
| operation | enum | - | Filter by operation: `export`, `import`, `update`, `delete`, `webhook` |
| status | enum | - | Filter by status: `success`, `error`, `pending` |
| productId | number | - | Filter by internal product ID |
| startDate | ISO 8601 | - | Start date for time range filter |
| endDate | ISO 8601 | - | End date for time range filter |
| sortBy | string | timestamp | Field to sort by |
| sortOrder | enum | desc | Sort order: `asc` or `desc` |

#### Response

```typescript
{
  logs: IntegrationLog[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number,
    hasNext: boolean,
    hasPrev: boolean
  }
}
```

#### Example Request

```http
GET /api/integration/logs?integrationType=woocommerce&status=error&page=1&limit=10
Authorization: Bearer YOUR_TOKEN
```

#### Example Response

```json
{
  "logs": [
    {
      "id": 1,
      "productId": 10,
      "integrationType": "woocommerce",
      "operation": "export",
      "status": "error",
      "message": "Failed to export product",
      "errorDetails": {
        "code": "NETWORK_ERROR",
        "details": "Connection timeout"
      },
      "externalProductId": "12345",
      "externalSku": "WC-12345",
      "metadata": {},
      "timestamp": "2025-11-06T10:30:00.000Z",
      "userId": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

### 2. GET /api/integration/logs/product/:productId

Retrieve all logs for a specific internal product.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| productId | number | Yes | Internal product ID |

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| integrationType | enum | - | Filter by platform |
| operation | enum | - | Filter by operation |
| status | enum | - | Filter by status |
| limit | number | 50 | Maximum number of results |

#### Response

```typescript
{
  productId: number,
  logs: IntegrationLog[],
  total: number
}
```

#### Example Request

```http
GET /api/integration/logs/product/10?integrationType=woocommerce&status=success
Authorization: Bearer YOUR_TOKEN
```

#### Example Response

```json
{
  "productId": 10,
  "logs": [
    {
      "id": 1,
      "productId": 10,
      "integrationType": "woocommerce",
      "operation": "export",
      "status": "success",
      "message": "Product exported successfully",
      "externalProductId": "12345",
      "timestamp": "2025-11-06T10:30:00.000Z",
      "userId": 1
    }
  ],
  "total": 15
}
```

---

### 3. GET /api/integration/logs/external/:integrationType/:externalId

Retrieve logs for a product using its external platform ID (e.g., WooCommerce product ID, Amazon ASIN).

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| integrationType | string | Yes | Platform type (e.g., `woocommerce`, `amazon`) |
| externalId | string | Yes | External platform product ID |

#### Response

```typescript
{
  externalId: string,
  integrationType: string,
  internalProductId: number | null,
  logs: IntegrationLog[]
}
```

#### Example Request

```http
GET /api/integration/logs/external/woocommerce/12345
Authorization: Bearer YOUR_TOKEN
```

#### Example Response

```json
{
  "externalId": "12345",
  "integrationType": "woocommerce",
  "internalProductId": 10,
  "logs": [
    {
      "id": 1,
      "productId": 10,
      "integrationType": "woocommerce",
      "operation": "export",
      "status": "success",
      "externalProductId": "12345",
      "timestamp": "2025-11-06T10:30:00.000Z",
      "userId": 1
    }
  ]
}
```

---

### 4. GET /api/integration/logs/stats

Get aggregated statistics for integration logs.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| startDate | ISO 8601 | - | Start date for statistics calculation |
| endDate | ISO 8601 | - | End date for statistics calculation |
| integrationType | enum | - | Filter statistics by platform |

#### Response

```typescript
{
  totalLogs: number,
  successCount: number,
  errorCount: number,
  pendingCount: number,
  successRate: number,
  byOperation: {
    export: number,
    import: number,
    update: number,
    delete: number,
    webhook: number
  },
  byIntegrationType: {
    woocommerce: number,
    amazon: number,
    shopify: number
  },
  startDate?: string,
  endDate?: string
}
```

#### Example Request

```http
GET /api/integration/logs/stats?startDate=2025-01-01T00:00:00.000Z&endDate=2025-12-31T23:59:59.999Z
Authorization: Bearer YOUR_TOKEN
```

#### Example Response

```json
{
  "totalLogs": 1000,
  "successCount": 850,
  "errorCount": 100,
  "pendingCount": 50,
  "successRate": 85.00,
  "byOperation": {
    "export": 500,
    "import": 200,
    "update": 250,
    "delete": 30,
    "webhook": 20
  },
  "byIntegrationType": {
    "woocommerce": 700,
    "amazon": 200,
    "shopify": 100
  },
  "startDate": "2025-01-01T00:00:00.000Z",
  "endDate": "2025-12-31T23:59:59.999Z"
}
```

---

### 5. GET /api/integration/logs/errors

Retrieve recent error logs.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 20 | Maximum number of errors to return |
| integrationType | enum | - | Filter by platform |
| hours | number | 24 | Look back this many hours |

#### Response

```typescript
{
  errors: IntegrationLog[],
  total: number
}
```

#### Example Request

```http
GET /api/integration/logs/errors?hours=48&limit=50&integrationType=woocommerce
Authorization: Bearer YOUR_TOKEN
```

#### Example Response

```json
{
  "errors": [
    {
      "id": 100,
      "productId": 5,
      "integrationType": "woocommerce",
      "operation": "export",
      "status": "error",
      "message": "Failed to export product",
      "errorDetails": {
        "code": "NETWORK_ERROR",
        "details": "Connection timeout"
      },
      "timestamp": "2025-11-06T09:45:00.000Z",
      "userId": 1
    }
  ],
  "total": 25
}
```

---

## Data Models

### IntegrationLog

```typescript
{
  id: number,
  productId: number,
  integrationType: string,        // 'woocommerce' | 'amazon' | 'shopify'
  operation: string,               // 'export' | 'import' | 'update' | 'delete' | 'webhook'
  status: string,                  // 'success' | 'error' | 'pending'
  message: string | null,
  errorDetails: object | null,     // JSON object with error information
  externalProductId: string | null,
  externalSku: string | null,
  metadata: object | null,         // JSON object with additional data
  timestamp: string,               // ISO 8601 date string
  userId: number
}
```

---

## Error Handling

All endpoints return appropriate HTTP status codes:

- **200 OK**: Successful request
- **400 Bad Request**: Invalid parameters or query
- **401 Unauthorized**: Missing or invalid JWT token
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server error

### Error Response Format

```json
{
  "statusCode": 400,
  "message": "Failed to fetch integration logs",
  "error": "Bad Request"
}
```

---

## Validation Rules

### Query Parameters

- `page`: Must be >= 1
- `limit`: Must be >= 1
- `integrationType`: Must be one of: `woocommerce`, `amazon`, `shopify`
- `operation`: Must be one of: `export`, `import`, `update`, `delete`, `webhook`
- `status`: Must be one of: `success`, `error`, `pending`
- `sortOrder`: Must be one of: `asc`, `desc`
- `startDate`, `endDate`: Must be valid ISO 8601 date strings
- `hours`: Must be >= 1

---

## Best Practices

### 1. Pagination

Always use pagination for large datasets:

```http
GET /api/integration/logs?page=1&limit=50
```

### 2. Date Filtering

Use ISO 8601 format for date filters:

```http
GET /api/integration/logs?startDate=2025-01-01T00:00:00.000Z&endDate=2025-12-31T23:59:59.999Z
```

### 3. Combining Filters

Combine multiple filters for precise queries:

```http
GET /api/integration/logs?integrationType=woocommerce&status=error&operation=export
```

### 4. Error Monitoring

Use the `/errors` endpoint for real-time error monitoring:

```http
GET /api/integration/logs/errors?hours=1&limit=100
```

### 5. Statistics Dashboard

Use the `/stats` endpoint for analytics dashboards:

```http
GET /api/integration/logs/stats?startDate=2025-11-01T00:00:00.000Z
```

---

## Performance Considerations

- All queries are indexed by `userId`, `productId`, `integrationType`, and `timestamp`
- Use pagination to avoid loading large datasets
- The `/stats` endpoint uses Prisma aggregation for efficient counting
- Date range queries are optimized with database indexes

---

## Rate Limiting

Rate limiting is enforced at the application level. If implemented, requests exceeding the limit will return:

```json
{
  "statusCode": 429,
  "message": "Too Many Requests"
}
```

---

## Examples

### Monitor Recent Export Failures

```http
GET /api/integration/logs?operation=export&status=error&sortOrder=desc&limit=20
Authorization: Bearer YOUR_TOKEN
```

### Track Product Integration History

```http
GET /api/integration/logs/product/123?limit=100
Authorization: Bearer YOUR_TOKEN
```

### Daily Statistics Report

```http
GET /api/integration/logs/stats?startDate=2025-11-06T00:00:00.000Z&endDate=2025-11-06T23:59:59.999Z
Authorization: Bearer YOUR_TOKEN
```

### Find External Product Mapping

```http
GET /api/integration/logs/external/amazon/B08N5WRWNW
Authorization: Bearer YOUR_TOKEN
```

---

## Support

For issues or questions about the Integration Logs API, please refer to:

- **API Reference**: `/docs/API_REFERENCE.md`
- **Integration Guide**: `/docs/INTEGRATION_GUIDE.md`
- **GitHub Issues**: Submit bug reports and feature requests

---

## Changelog

### Version 1.0.0 (2025-11-06)

- Initial release
- Five main endpoints for log management
- Pagination support
- Advanced filtering capabilities
- Statistics aggregation
- Error tracking
