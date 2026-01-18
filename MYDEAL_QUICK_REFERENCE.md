# MyDeal Integration - Quick Reference

## Quick Start

### 1. Configure Credentials

```typescript
POST /integration/mydeal/connection
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "baseApiUrl": "https://api-integrations-sandbox.mydeal.com.au",
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "sellerId": "your-seller-id",
  "sellerToken": "your-seller-token"
}
```

### 2. Export Products

```typescript
POST /integration/mydeal/export
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "productIds": [1, 2, 3, 4, 5]
}
```

## API Endpoints

### Connection Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/integration/mydeal/connection` | Save credentials |
| PUT | `/integration/mydeal/connection` | Update credentials |
| GET | `/integration/mydeal/connection` | Get connection info |
| DELETE | `/integration/mydeal/connection` | Delete credentials |
| POST | `/integration/mydeal/connection/test` | Test connection |

### Product Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/integration/mydeal/export` | Export multiple products |
| POST | `/integration/mydeal/update/:productId` | Update single product |
| DELETE | `/integration/mydeal/:productId` | Deactivate product |
| GET | `/integration/mydeal/products` | Fetch products from MyDeal |
| POST | `/integration/mydeal/pull-updates` | Pull product updates |

### Order Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/integration/mydeal/orders` | Fetch orders |

Query params: `?page=1&limit=100&status=ReadytoFulfill`

### Async Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/integration/mydeal/work-item/:workItemId` | Check work item status |

## Required Credentials

You need these credentials from MyDeal:

1. **Base API URL**: 
   - Sandbox: `https://api-integrations-sandbox.mydeal.com.au`
   - Production: `https://api-integrations.mydeal.com.au`

2. **Client ID**: Provided by MyDeal team
3. **Client Secret**: Provided by MyDeal team  
4. **Seller ID**: Provided by MyDeal team
5. **Seller Token**: Provided by MyDeal team

## Product Data Mapping

### Main Product
```typescript
{
  ExternalProductId: product.sku,
  ProductSKU: product.sku,
  Title: product.name,
  Description: product.description,
  Brand: product.brand,
  Tags: product.tags.join(', '),
  Condition: 'new',
  Categories: [{ CategoryId: 135 }],
  Images: [...],
  Weight: 1,
  WeightUnit: 'kg',
  Length: 0.1,
  Height: 0.1,
  Width: 0.1,
  DimensionUnit: 'm',
  BuyableProducts: [...]
}
```

### Variant/Buyable Product
```typescript
{
  ExternalBuyableProductID: variant.sku,
  SKU: variant.sku,
  Price: variant.price,
  RRP: variant.compareAtPrice,
  Quantity: variant.quantity,
  ListingStatus: 1, // 1 = Active, 0 = Inactive
  ProductUnlimited: false,
  Options: [
    {
      OptionName: 'Color',
      OptionValue: 'Red',
      Position: 1
    }
  ]
}
```

## Response Format

### Success Response
```json
{
  "success": true,
  "syncedCount": 5,
  "failedCount": 0,
  "mydealTotal": 100,
  "results": [
    {
      "productId": 1,
      "status": "success",
      "mydealProductId": "SKU-123",
      "message": "Product export pending. Work Item ID: ..."
    }
  ]
}
```

### Error Response
```json
{
  "productId": 1,
  "status": "error",
  "message": "Product 1 is missing SKU"
}
```

## Auto-Sync Feature

Auto-sync is automatically enabled when you export a product. To manage it:

```typescript
// Service methods available
mydealAutoSyncService.enableAutoSync(productId, userId)
mydealAutoSyncService.disableAutoSync(productId, userId)
mydealAutoSyncService.isAutoSyncEnabled(productId, userId)
```

## Async Operations

MyDeal API returns `AsyncResponsePending` for product operations:

```json
{
  "ResponseStatus": "AsyncResponsePending",
  "PendingUri": "https://api.../pending-responses?workItemID=12345"
}
```

Check status later:
```typescript
GET /integration/mydeal/work-item/12345
```

## Order Statuses

- `ReadytoFulfill` - Ready to ship
- `Fulfilled` - Shipped
- `Cancelled` - Cancelled
- `Returned` - Returned

## MyDeal Categories

Common categories (you need to get the full list from MyDeal):
- 135: General category (default)

You can fetch categories from MyDeal API if needed.

## Error Codes

| Code | Message | Solution |
|------|---------|----------|
| 302 | Product not found | Check SKU exists on MyDeal |
| 401 | Authentication failure | Verify credentials |
| 900 | Invalid request | Check payload format |

## Integration Logs

All operations are logged to `IntegrationLog` table:

```typescript
{
  productId: 1,
  integrationType: 'mydeal',
  operation: 'export',
  status: 'success',
  message: 'Product exported successfully',
  externalProductId: 'SKU-123',
  externalSku: 'SKU-123',
  metadata: { pendingUri: '...' },
  timestamp: '2025-12-30T...',
  userId: 1
}
```

## Testing

### Test Connection
```bash
curl -X POST http://localhost:3000/integration/mydeal/connection/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "baseApiUrl": "https://api-integrations-sandbox.mydeal.com.au",
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret",
    "sellerId": "your-seller-id",
    "sellerToken": "your-seller-token"
  }'
```

### Export Products
```bash
curl -X POST http://localhost:3000/integration/mydeal/export \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "productIds": [1, 2, 3]
  }'
```

## Permissions Required

All endpoints require these permissions:
- `integration:export` - Export products
- `integration:import` - Import products
- `integration:update` - Update products
- `integration:delete` - Delete products
- `integration:read` - Read orders/products
- `integration:create` - Create connections

## Common Issues

### 1. Authentication Failed
- Verify all credentials are correct
- Check if credentials are for correct environment (sandbox vs production)
- Ensure credentials are active in MyDeal

### 2. Product Not Found
- Ensure product has SKU
- Check if product was previously exported

### 3. Async Operation Pending
- Wait for MyDeal to process
- Check work item status after a few seconds

### 4. Category Not Valid
- Use default category 135 or get valid categories from MyDeal

## Best Practices

1. **Always test credentials** before saving
2. **Export in batches** of 50-100 products
3. **Check work item status** for async operations
4. **Handle errors gracefully** in production
5. **Log all operations** for debugging
6. **Keep credentials secure** - never expose in logs
7. **Use proper RBAC** permissions

## Support

For MyDeal API issues:
- Contact MyDeal support team
- Check MyDeal API documentation
- Verify your seller account status

For integration issues:
- Check integration logs in database
- Review error messages in responses
- Verify product data completeness
