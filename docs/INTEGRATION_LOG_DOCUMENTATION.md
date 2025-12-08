# Integration Logs API Documentation

## Overview

The Integration Logs API provides endpoints to retrieve and manage logs for product integrations with external platforms like WooCommerce and Amazon. These logs track all integration operations including exports, imports, updates, deletions, and webhook events.

## Base URL
```
/api/integration/logs
```

## Authentication
All endpoints require JWT authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Data Model

### IntegrationLog
```typescript
{
  id: number;                    // Unique log entry ID
  productId: number;             // Internal product ID
  integrationType: string;       // 'woocommerce', 'amazon', 'shopify', etc.
  operation: string;             // 'export', 'import', 'update', 'delete', 'webhook'
  status: string;                // 'success', 'error', 'pending'
  message?: string;              // Human-readable message
  errorDetails?: object;         // Detailed error information (JSON)
  externalProductId?: string;    // External platform product ID (WooCommerce ID, Amazon ASIN)
  externalSku?: string;          // External SKU if different from internal
  metadata?: object;             // Additional platform-specific data (JSON)
  timestamp: string;             // ISO 8601 timestamp
  userId: number;                // User who initiated the operation
}
```

## Endpoints

### 1. Get All Integration Logs

Retrieve paginated integration logs for the authenticated user.

**Endpoint:** `GET /api/integration/logs`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `integrationType` (optional): Filter by integration type ('woocommerce', 'amazon', etc.)
- `operation` (optional): Filter by operation type ('export', 'import', 'update', 'delete', 'webhook')
- `status` (optional): Filter by status ('success', 'error', 'pending')
- `productId` (optional): Filter by specific product ID
- `startDate` (optional): Filter logs from this date (ISO 8601 format)
- `endDate` (optional): Filter logs until this date (ISO 8601 format)
- `sortBy` (optional): Sort field ('timestamp', 'productId', 'status') (default: 'timestamp')
- `sortOrder` (optional): Sort order ('asc', 'desc') (default: 'desc')

**Example Request:**
```bash
GET /api/integration/logs?page=1&limit=10&integrationType=woocommerce&status=success&sortBy=timestamp&sortOrder=desc
```

**Response:**
```json
{
  "logs": [
    {
      "id": 123,
      "productId": 456,
      "integrationType": "woocommerce",
      "operation": "export",
      "status": "success",
      "message": "Product exported successfully",
      "externalProductId": "789",
      "externalSku": "WC-456",
      "timestamp": "2025-11-06T10:30:00.000Z",
      "userId": 1,
      "metadata": {
        "wooCommerceUrl": "https://example.com/product/test-product"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "totalPages": 15,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Status Codes:**
- `200`: Success
- `401`: Unauthorized
- `400`: Bad Request (invalid parameters)

### 2. Get Integration Logs by Product

Retrieve all integration logs for a specific product.

**Endpoint:** `GET /api/integration/logs/product/{productId}`

**Path Parameters:**
- `productId`: Internal product ID

**Query Parameters:**
- `integrationType` (optional): Filter by integration type
- `operation` (optional): Filter by operation type
- `status` (optional): Filter by status
- `limit` (optional): Maximum number of logs to return (default: 50)

**Example Request:**
```bash
GET /api/integration/logs/product/456?integrationType=woocommerce&limit=20
```

**Response:**
```json
{
  "productId": 456,
  "logs": [
    {
      "id": 123,
      "integrationType": "woocommerce",
      "operation": "export",
      "status": "success",
      "message": "Product exported successfully",
      "externalProductId": "789",
      "timestamp": "2025-11-06T10:30:00.000Z",
      "metadata": {
        "wooCommerceUrl": "https://example.com/product/test-product"
      }
    },
    {
      "id": 124,
      "integrationType": "woocommerce",
      "operation": "update",
      "status": "success",
      "message": "Product updated in WooCommerce",
      "externalProductId": "789",
      "timestamp": "2025-11-06T11:15:00.000Z"
    }
  ],
  "total": 2
}
```

### 3. Get Integration Logs by External ID

Retrieve integration logs for a product using its external platform ID.

**Endpoint:** `GET /api/integration/logs/external/{integrationType}/{externalId}`

**Path Parameters:**
- `integrationType`: Integration type ('woocommerce', 'amazon', etc.)
- `externalId`: External platform product ID

**Example Request:**
```bash
GET /api/integration/logs/external/woocommerce/789
```

**Response:**
```json
{
  "externalId": "789",
  "integrationType": "woocommerce",
  "internalProductId": 456,
  "logs": [
    {
      "id": 123,
      "productId": 456,
      "operation": "export",
      "status": "success",
      "message": "Product exported successfully",
      "timestamp": "2025-11-06T10:30:00.000Z"
    }
  ]
}
```

### 4. Get Integration Statistics

Get summary statistics for integration operations.

**Endpoint:** `GET /api/integration/logs/stats`

**Query Parameters:**
- `integrationType` (optional): Filter by integration type
- `startDate` (optional): Start date for statistics (ISO 8601)
- `endDate` (optional): End date for statistics (ISO 8601)

**Example Request:**
```bash
GET /api/integration/logs/stats?integrationType=woocommerce&startDate=2025-11-01T00:00:00.000Z
```

**Response:**
```json
{
  "period": {
    "startDate": "2025-11-01T00:00:00.000Z",
    "endDate": "2025-11-06T23:59:59.999Z"
  },
  "summary": {
    "totalLogs": 150,
    "successCount": 140,
    "errorCount": 8,
    "pendingCount": 2,
    "successRate": 93.33
  },
  "byOperation": {
    "export": { "total": 100, "success": 95, "error": 5 },
    "update": { "total": 30, "success": 30, "error": 0 },
    "delete": { "total": 15, "success": 12, "error": 3 },
    "webhook": { "total": 5, "success": 3, "error": 2 }
  },
  "byIntegrationType": {
    "woocommerce": { "total": 120, "success": 115, "error": 5 },
    "amazon": { "total": 30, "success": 25, "error": 3 }
  }
}
```

### 5. Get Recent Errors

Retrieve recent integration errors for troubleshooting.

**Endpoint:** `GET /api/integration/logs/errors`

**Query Parameters:**
- `limit` (optional): Number of errors to return (default: 20)
- `integrationType` (optional): Filter by integration type
- `hours` (optional): Get errors from last N hours (default: 24)

**Example Request:**
```bash
GET /api/integration/logs/errors?limit=10&integrationType=woocommerce&hours=48
```

**Response:**
```json
{
  "errors": [
    {
      "id": 125,
      "productId": 457,
      "integrationType": "woocommerce",
      "operation": "export",
      "status": "error",
      "message": "Failed to connect to WooCommerce API",
      "errorDetails": {
        "error": "Connection timeout",
        "code": "ECONNRESET",
        "timestamp": "2025-11-06T09:45:00.000Z"
      },
      "timestamp": "2025-11-06T09:45:00.000Z"
    }
  ],
  "total": 1
}
```

## Error Responses

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Invalid integration type. Must be one of: woocommerce, amazon, shopify",
  "error": "Bad Request"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Product not found",
  "error": "Not Found"
}
```
## Rate Limiting

- General logs endpoint: 100 requests per minute
- Statistics endpoint: 30 requests per minute
- Error logs endpoint: 50 requests per minute

## Data Retention

Integration logs are retained for 90 days. Older logs are automatically archived or deleted based on system configuration.

## Webhook Logs

Webhook events from external platforms are automatically logged with:
- `operation`: 'webhook'
- `status`: 'success' or 'error'
- `metadata`: Webhook payload and headers
- `externalProductId`: ID from the external platform

## Best Practices

1. **Use appropriate filters** to limit response size
2. **Monitor error rates** using the statistics endpoint
3. **Check recent errors** when troubleshooting integration issues
4. **Use pagination** for large result sets
5. **Filter by date ranges** for performance optimization</content>
<parameter name="filePath">e:\Savileaf\PixelPim_backend\docs\INTEGRATION_LOG_DOCUMENTATION.md
