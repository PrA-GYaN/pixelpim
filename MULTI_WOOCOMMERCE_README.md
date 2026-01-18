# Multi-WooCommerce Integration - Quick Start

## Overview

This feature enables users to connect multiple WooCommerce stores, configure custom field mappings, and perform selective field exports/imports with full control over data synchronization.

## Key Features

✅ **Multi-Store Support** - Connect unlimited WooCommerce stores per user  
✅ **Field Mapping** - Configure custom export/import mappings  
✅ **Selective Exports** - Choose which fields to sync  
✅ **Partial Updates** - Update only modified fields  
✅ **Attribute Mapping** - Map WooCommerce attributes to internal model  
✅ **Sync Tracking** - Monitor sync status per connection  
✅ **Backward Compatible** - Works with existing single-connection setup

## Quick Start

### 1. Database Migration

Run the Prisma migration to create new tables:

```bash
npx prisma db push
# or
npx prisma migrate dev --name add_multi_woocommerce_support
```

### 2. Generate Prisma Client

```bash
npx prisma generate
```

### 3. Test the Setup

```bash
# Start the server
npm run start:dev

# Test connection endpoint
curl -X POST http://localhost:3000/integration/woocommerce/connections/test \
  -H "Content-Type: application/json" \
  -d '{
    "storeUrl": "https://your-store.com",
    "consumerKey": "ck_xxxxx",
    "consumerSecret": "cs_xxxxx"
  }'
```

## Basic Usage

### Create a Connection

```typescript
POST /integration/woocommerce/connections
Authorization: Bearer <jwt_token>

{
  "storeName": "Main Store",
  "storeUrl": "https://mystore.com",
  "consumerKey": "ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "consumerSecret": "cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "isDefault": true
}
```

### Configure Export Mapping

```typescript
POST /integration/woocommerce/connections/1/export-mappings

{
  "connectionId": 1,
  "selectedFields": ["name", "sku", "price", "images", "COLOR", "Dimension"],
  "fieldMappings": {
    "price": "regular_price",
    "COLOR": "pa_color",
    "Dimension": "pa_dimension"
  }
}
```

### Export Products

```typescript
POST /integration/woocommerce/connections/export

{
  "connectionId": 1,
  "productIds": [101, 102, 103],
  "partialUpdate": true
}
```

### Import Products

```typescript
POST /integration/woocommerce/connections/import

{
  "connectionId": 1,
  "updateExisting": true,
  "onSkuConflict": "link",
  "useMapping": true
}
```

## Database Schema

### New Tables

1. **WooCommerceConnection** - Store multiple WooCommerce connections per user
2. **WooCommerceExportMapping** - Export field mapping configurations
3. **WooCommerceImportMapping** - Import attribute mapping configurations
4. **WooCommerceProductSync** - Track sync status per connection

### Key Relationships

```
User (1) -----> (N) WooCommerceConnection
WooCommerceConnection (1) -----> (N) WooCommerceExportMapping
WooCommerceConnection (1) -----> (N) WooCommerceImportMapping
WooCommerceConnection (1) -----> (N) WooCommerceProductSync
```

## Architecture

### Services

- **WooCommerceConnectionService** - Manages connections and mappings
- **WooCommerceMultiStoreService** - Handles export/import operations
- **WooCommerceService** (existing) - Legacy single-connection support

### Controllers

- **WooCommerceConnectionController** - New multi-store endpoints
- **WooCommerceController** (existing) - Legacy endpoints

### DTOs

All DTOs are in `src/integration/woocommerce/dto/woocommerce-connection.dto.ts`

## API Endpoints

### Connection Management
- `POST /integration/woocommerce/connections` - Create connection
- `GET /integration/woocommerce/connections` - List connections
- `GET /integration/woocommerce/connections/default` - Get default connection
- `PUT /integration/woocommerce/connections/:id` - Update connection
- `DELETE /integration/woocommerce/connections/:id` - Delete connection
- `POST /integration/woocommerce/connections/test` - Test connection

### Mapping Management
- `POST /integration/woocommerce/connections/:id/export-mappings` - Create export mapping
- `GET /integration/woocommerce/connections/:id/export-mappings` - List export mappings
- `PUT /integration/woocommerce/connections/export-mappings/:id` - Update export mapping
- `DELETE /integration/woocommerce/connections/export-mappings/:id` - Delete export mapping

### Product Operations
- `POST /integration/woocommerce/connections/export` - Export products
- `POST /integration/woocommerce/connections/import` - Import products
- `PUT /integration/woocommerce/connections/:cid/products/:pid` - Update product
- `DELETE /integration/woocommerce/connections/:cid/products/:pid` - Delete product
- `GET /integration/woocommerce/connections/:id/sync-status` - Get sync status

## Common Use Cases

### 1. Multiple Regional Stores

```typescript
// Create connections for different regions
POST /integration/woocommerce/connections
{ "storeName": "US Store", "storeUrl": "https://us.store.com", ... }

POST /integration/woocommerce/connections
{ "storeName": "EU Store", "storeUrl": "https://eu.store.com", ... }

// Export same products to both
POST /integration/woocommerce/connections/export
{ "connectionId": 1, "productIds": [1, 2, 3] }

POST /integration/woocommerce/connections/export
{ "connectionId": 2, "productIds": [1, 2, 3] }
```

### 2. Retail vs Wholesale

```typescript
// Different price mappings for retail and wholesale
// Retail mapping
POST /integration/woocommerce/connections/1/export-mappings
{
  "selectedFields": ["name", "sku", "retailPrice"],
  "fieldMappings": { "retailPrice": "regular_price" }
}

// Wholesale mapping
POST /integration/woocommerce/connections/2/export-mappings
{
  "selectedFields": ["name", "sku", "wholesalePrice"],
  "fieldMappings": { "wholesalePrice": "regular_price" }
}
```

### 3. Partial Price Updates

```typescript
POST /integration/woocommerce/connections/export
{
  "connectionId": 1,
  "productIds": [101, 102, 103],
  "fieldsToExport": ["name", "sku", "price"],
  "partialUpdate": true  // Only updates price, leaves other fields unchanged
}
```

## Configuration

### Environment Variables

No new environment variables required. The old single-connection credentials can coexist:

```env
# Legacy (optional, for backward compatibility)
WC_API_URL=https://yourstore.com
WC_CONSUMER_KEY=ck_xxx
WC_CONSUMER_SECRET=cs_xxx
```

### Permissions

Ensure users have these permissions:
- `integration:create` - Create connections
- `integration:read` - View connections
- `integration:update` - Update connections
- `integration:delete` - Delete connections
- `integration:export` - Export products
- `integration:import` - Import products

## Testing

### Unit Tests

```bash
npm run test
```

### Integration Tests

```bash
npm run test:e2e
```

### Manual Testing

1. Test connection creation
2. Test field mapping configuration
3. Test export with selective fields
4. Test import with attribute mapping
5. Test partial updates

## Migration from Single-Connection

### Option 1: Automatic Migration

Run the migration script (to be created):

```bash
npm run migrate:woocommerce-connections
```

### Option 2: Manual Setup

Users can manually create connections from their existing setup:

1. Get existing credentials
2. Create new connection using those credentials
3. Set as default
4. Continue using existing workflows

## Troubleshooting

### Connection Test Fails

**Problem:** "Failed to connect to WooCommerce store"

**Solutions:**
- Verify consumer key and secret
- Check WooCommerce REST API is enabled
- Ensure Read/Write permissions
- Verify store URL format

### Export Fails

**Problem:** "Export mapping must include name and sku fields"

**Solution:** Ensure `selectedFields` includes both "name" and "sku"

### Import Mapping Issues

**Problem:** Attributes not mapping correctly

**Solution:** 
- Verify WooCommerce attribute names (use `pa_` prefix)
- Check attribute mappings in import configuration
- Test with a single product first

## Performance Considerations

### Batch Operations

- Export in batches of 50-100 products
- Use partial updates when possible
- Leverage WooCommerce batch API for large operations

### Rate Limiting

- WooCommerce default: 10 requests per 10 seconds
- Implement exponential backoff
- Monitor rate limit headers

### Database Optimization

All necessary indexes are already created:
- `WooCommerceConnection`: `(userId, isActive)`, `(userId, isDefault)`
- `WooCommerceProductSync`: `(connectionId, syncStatus)`, `(productId)`

## Security

### Credential Storage

- Credentials stored in database (not environment variables)
- Never returned in API responses
- Use HTTPS for all communications

### Webhook Security

- Configure `webhookSecret` for each connection
- Validate webhook signatures

### Access Control

- All endpoints protected by JWT authentication
- Permission-based access control (RBAC)
- User isolation (can only access own connections)

## Support

### Documentation

- Full API documentation: `docs/MULTI_WOOCOMMERCE_API_GUIDE.md`
- Architecture diagrams: Coming soon
- Video tutorials: Coming soon

### Getting Help

1. Check the comprehensive API guide
2. Review use cases and examples
3. Test with the `/test` endpoint first
4. Enable debug logging for detailed error messages

## Roadmap

### Future Enhancements

- [ ] Bulk mapping configuration UI
- [ ] Scheduled sync operations
- [ ] Conflict resolution for bidirectional sync
- [ ] Advanced field transformation rules
- [ ] Product variant handling
- [ ] Category mapping
- [ ] Image optimization during sync
- [ ] Webhook-based real-time sync

## Contributing

When contributing to this module:

1. Follow NestJS best practices
2. Add unit tests for new features
3. Update documentation
4. Test backward compatibility
5. Run linting before committing

## License

© 2025 PixelPim. All rights reserved.

---

## Quick Reference Card

### Create Connection
```bash
POST /integration/woocommerce/connections
Body: { storeName, storeUrl, consumerKey, consumerSecret }
```

### Export Products
```bash
POST /integration/woocommerce/connections/export
Body: { connectionId, productIds, fieldsToExport?, partialUpdate? }
```

### Import Products
```bash
POST /integration/woocommerce/connections/import
Body: { connectionId, wooProductIds?, updateExisting?, onSkuConflict?, useMapping?, familyId? }
```

Parameters:
- `connectionId` (required): WooCommerce connection ID
- `wooProductIds` (optional): Array of specific WooCommerce product IDs to import
- `updateExisting` (optional): Whether to update products already synced from this connection (default: false)
- `onSkuConflict` (optional): How to handle SKU conflicts with existing products ('update', 'link', 'skip') (default: 'skip')
- `useMapping` (optional): Whether to use configured import mapping (default: true)
- `familyId` (optional): Family ID to attach all imported products to

### Configure Mapping
```bash
POST /integration/woocommerce/connections/:id/export-mappings
Body: { selectedFields, fieldMappings }
```

### Check Sync Status
```bash
GET /integration/woocommerce/connections/:id/sync-status
```

---

**Need Help?** See `docs/MULTI_WOOCOMMERCE_API_GUIDE.md` for detailed documentation.
