# MyDeal API Quick Reference - Complete Endpoint List

## Base URL
```
/integration/mydeal
```

## Authentication
All endpoints require JWT authentication via the `Authorization: Bearer <token>` header.

---

## Work Items

### Get Work Items
```http
GET /work-items?status=pending&operation=export&limit=50
```
**Query Parameters:**
- `status` (optional): pending, processing, completed, failed
- `operation` (optional): export, update, delete
- `productId` (optional): Filter by product ID
- `limit` (optional): Max results (default: 100)

**Response:**
```json
{
  "success": true,
  "count": 5,
  "items": [...]
}
```

### Check Work Item Status
```http
GET /work-item/:workItemId
```

---

## Connection Management

### Create/Save Connection
```http
POST /connection
```
**Body:**
```json
{
  "baseApiUrl": "https://api.mydeal.com.au",
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "sellerId": "12345",
  "sellerToken": "your-seller-token"
}
```

### Update Connection
```http
PUT /connection
```
Same body structure as create.

### Get Connection
```http
GET /connection
```

### Delete Connection
```http
DELETE /connection
```

### Test Connection
```http
POST /connection/test
```
**Body (optional - uses saved credentials if empty):**
```json
{
  "baseApiUrl": "https://api.mydeal.com.au",
  "clientId": "test-client-id",
  "clientSecret": "test-client-secret",
  "sellerId": "12345",
  "sellerToken": "test-seller-token"
}
```

---

## Configuration Import/Export

### Export Configuration
```http
GET /connection/export-configuration
```
**Response:**
```json
{
  "success": true,
  "configuration": {
    "version": "1.0",
    "integrationType": "mydeal",
    "connection": { ... }
  },
  "exportedAt": "2026-01-11T10:00:00Z"
}
```

### Import Configuration
```http
POST /connection/import-configuration
```
**Body:**
```json
{
  "configuration": {
    "version": "1.0",
    "integrationType": "mydeal",
    "connection": { ... }
  }
}
```

---

## Export Mappings

### Create Export Mapping
```http
POST /connection/connections/:connectionId/export-mappings
```
**Body:**
```json
{
  "fieldMappings": {
    "name": "Title",
    "description": "Description",
    "sku": "ProductSKU",
    "price": "BuyableProducts[0].Price"
  },
  "selectedFields": ["name", "description", "sku", "price"],
  "isActive": true
}
```

### Get All Export Mappings
```http
GET /connection/connections/:connectionId/export-mappings
```

### Get Active Export Mapping
```http
GET /connection/connections/:connectionId/export-mappings/active
```

### Update Export Mapping
```http
PUT /connection/export-mappings/:mappingId
```
**Body:**
```json
{
  "fieldMappings": { ... },
  "selectedFields": [ ... ],
  "isActive": true
}
```

### Delete Export Mapping
```http
DELETE /connection/export-mappings/:mappingId
```

---

## Import Mappings

### Create Import Mapping
```http
POST /connection/connections/:connectionId/import-mappings
```
**Body:**
```json
{
  "fieldMappings": {
    "Title": "name",
    "Description": "description",
    "ProductSKU": "sku"
  },
  "attributeMappings": {
    "Color": "color",
    "Size": "size"
  },
  "isActive": true
}
```

### Get All Import Mappings
```http
GET /connection/connections/:connectionId/import-mappings
```

### Get Active Import Mapping
```http
GET /connection/connections/:connectionId/import-mappings/active
```

### Update Import Mapping
```http
PUT /connection/import-mappings/:mappingId
```
**Body:**
```json
{
  "fieldMappings": { ... },
  "attributeMappings": { ... },
  "isActive": true
}
```

### Delete Import Mapping
```http
DELETE /connection/import-mappings/:mappingId
```

---

## Product Operations

### Export Products
```http
POST /export
```
**Body:**
```json
{
  "productIds": [123, 456, 789]
}
```

### Update Product
```http
POST /update/:productId
```

### Delete Product
```http
DELETE /:productId
```

### Get Orders
```http
GET /orders?page=1&limit=100&status=pending
```

### Get Products
```http
GET /products
```

### Pull Updates
```http
POST /pull-updates
```

---

## Complete Workflow Examples

### Setup Complete Integration

```bash
# 1. Create connection
curl -X POST /integration/mydeal/connection \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "baseApiUrl": "https://api.mydeal.com.au",
    "clientId": "client-id",
    "clientSecret": "client-secret",
    "sellerId": "12345",
    "sellerToken": "seller-token"
  }'

# 2. Test connection
curl -X POST /integration/mydeal/connection/test \
  -H "Authorization: Bearer TOKEN"

# 3. Create export mapping (assuming connectionId = 1)
curl -X POST /integration/mydeal/connection/connections/1/export-mappings \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fieldMappings": {
      "name": "Title",
      "sku": "ProductSKU",
      "price": "BuyableProducts[0].Price"
    },
    "selectedFields": ["name", "sku", "price"],
    "isActive": true
  }'

# 4. Export products
curl -X POST /integration/mydeal/export \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productIds": [123]
  }'

# 5. Check work items
curl -X GET /integration/mydeal/work-items \
  -H "Authorization: Bearer TOKEN"
```

### Backup and Restore Configuration

```bash
# Export configuration
curl -X GET /integration/mydeal/connection/export-configuration \
  -H "Authorization: Bearer TOKEN" \
  > mydeal-config-backup.json

# Import configuration (to different environment or after reset)
curl -X POST /integration/mydeal/connection/import-configuration \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d @mydeal-config-backup.json
```

### Manage Multiple Mappings

```bash
# Create test mapping
curl -X POST /integration/mydeal/connection/connections/1/export-mappings \
  -H "Authorization: Bearer TOKEN" \
  -d '{ "fieldMappings": {...}, "isActive": false }'

# Create production mapping (activates automatically)
curl -X POST /integration/mydeal/connection/connections/1/export-mappings \
  -H "Authorization: Bearer TOKEN" \
  -d '{ "fieldMappings": {...}, "isActive": true }'

# Switch between mappings
curl -X PUT /integration/mydeal/connection/export-mappings/1 \
  -H "Authorization: Bearer TOKEN" \
  -d '{ "isActive": true }'
```

---

## Response Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (successful deletion) |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Permission Requirements

| Endpoint | Resource | Action |
|----------|----------|--------|
| Export products | `integration` | `export` |
| Update product | `integration` | `update` |
| Delete product | `integration` | `delete` |
| Get orders/products | `integration` | `read` |
| Pull updates | `integration` | `import` |
| Create connection | `integration` | `create` |
| Update connection | `integration` | `update` |
| Delete connection | `integration` | `delete` |
| Get connection | `integration` | `read` |
| Export config | `integration` | `read` |
| Import config | `integration` | `create` |
| Manage mappings (create/update) | `integration` | `create`/`update` |
| Delete mappings | `integration` | `delete` |
| Get mappings | `integration` | `read` |

---

## Common Field Mappings Reference

### Export Field Mappings
```json
{
  "name": "Title",
  "description": "Description",
  "specifications": "Specifications",
  "brand": "Brand",
  "sku": "ProductSKU",
  "price": "BuyableProducts[0].Price",
  "compareAtPrice": "BuyableProducts[0].RRP",
  "quantity": "BuyableProducts[0].Quantity",
  "weight": "Weight",
  "length": "Length",
  "width": "Width",
  "height": "Height",
  "gtin": "GTIN",
  "mpn": "MPN"
}
```

### Import Field Mappings
```json
{
  "Title": "name",
  "Description": "description",
  "Specifications": "specifications",
  "Brand": "brand",
  "ProductSKU": "sku",
  "Weight": "weight",
  "Length": "length",
  "Width": "width",
  "Height": "height",
  "GTIN": "gtin",
  "MPN": "mpn"
}
```

### Common Attribute Mappings
```json
{
  "Color": "color",
  "Size": "size",
  "Material": "material",
  "Warranty": "warranty",
  "Model": "model"
}
```

---

## Error Handling

All error responses follow this format:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

---

## Rate Limiting

MyDeal API has rate limits. Monitor your usage and implement exponential backoff for failed requests.

---

## Support

For issues or questions:
1. Check work items for async operation status
2. Review error logs in integration logs
3. Verify credentials and permissions
4. Consult [MYDEAL_WORKITEMS_AND_CONFIG.md](./MYDEAL_WORKITEMS_AND_CONFIG.md)
5. Consult [MYDEAL_MAPPING_GUIDE.md](./MYDEAL_MAPPING_GUIDE.md)
