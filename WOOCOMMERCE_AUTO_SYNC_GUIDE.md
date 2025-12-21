# WooCommerce Auto-Sync Feature

## Overview

The WooCommerce integration now supports **automatic synchronization** of products when they are updated in PixelPIM. This eliminates the need for manual exports in most cases, keeping your WooCommerce store automatically up-to-date.

## Features

### Automatic Sync Triggers

Products are **automatically synced** to all connected WooCommerce stores when:

1. **Product is Updated** - Any update to product fields (name, SKU, description, price, etc.)
2. **Product Attributes are Updated** - Changes to custom or family attributes
3. **Product Assets are Updated** - Adding, removing, or modifying product images/files

### Smart Sync Detection

- The system **only syncs products that have been previously synced** to WooCommerce
- If a product has never been exported to WooCommerce, updates won't trigger automatic sync
- Products can be synced to multiple WooCommerce connections, and all will be updated automatically

### Auto-Cleanup on Delete

When a product is deleted (soft delete or permanent delete):
- All WooCommerce sync records are automatically cleaned up
- This prevents orphaned sync data and keeps the database clean

## How It Works

### Initial Export (Manual - One Time)

To enable automatic sync for a product, you must first **manually export** it to WooCommerce:

```http
POST /integration/woocommerce/connections/export
```

**Request:**
```json
{
  "connectionId": 1,
  "productIds": [101, 102, 103],
  "fieldsToExport": ["name", "sku", "price", "images"]
}
```

This creates a sync record linking the product to WooCommerce.

### Automatic Updates

Once a product has been synced, **all subsequent updates are automatic**:

```typescript
// Update product - triggers auto-sync
PATCH /products/:id
{
  "name": "Updated Product Name",
  "price": 99.99
}

// Update attributes - triggers auto-sync
PATCH /products/:id/attributes
{
  "attributes": [
    { "attributeId": 1, "value": "Red" }
  ]
}

// Update assets (via product update) - triggers auto-sync
PATCH /products/:id
{
  "assets": [123, 456, 789]
}
```

All these operations will **automatically push updates to WooCommerce** in the background.

## Legacy Manual Export (Still Available)

The manual export endpoint is still available for:
- Initial product sync to WooCommerce
- Bulk exports of multiple products
- Re-syncing products that have errors
- One-time synchronization needs

```http
POST /integration/woocommerce/connections/export
```

This method is now considered **legacy** for product updates but remains the primary method for initial sync.

## Architecture

### Auto-Sync Service

```typescript
// New service: WooCommerceAutoSyncService
src/integration/woocommerce/woocommerce-auto-sync.service.ts
```

**Key Methods:**
- `autoSyncProductUpdate(productId, userId)` - Sync product updates
- `autoSyncAttributeUpdate(productId, userId)` - Sync attribute changes
- `autoSyncAssetUpdate(productId, userId)` - Sync asset changes
- `cleanupProductSyncData(productId)` - Delete sync records on product deletion

### Integration Points

The auto-sync service is integrated into ProductService at these points:

1. **Product Update** (`update` method)
   ```typescript
   // After successful update
   if (this.wooAutoSyncService) {
     this.wooAutoSyncService.autoSyncProductUpdate(id, userId);
   }
   ```

2. **Attribute Update** (`updateProductAttributeValues` method)
   ```typescript
   // After attribute update
   if (this.wooAutoSyncService) {
     this.wooAutoSyncService.autoSyncAttributeUpdate(productId, userId);
   }
   ```

3. **Family Attribute Update** (`updateProductFamilyAttributeValues` method)
   ```typescript
   // After family attribute update
   if (this.wooAutoSyncService) {
     this.wooAutoSyncService.autoSyncAttributeUpdate(productId, userId);
   }
   ```

4. **Product Delete** (`softDeleteProduct` and `permanentlyDeleteProduct` methods)
   ```typescript
   // Before deletion
   if (this.wooAutoSyncService) {
     this.wooAutoSyncService.cleanupProductSyncData(id);
   }
   ```

## Error Handling

### Non-Blocking Errors

Auto-sync errors **do not fail** the primary operation (product update/delete):

```typescript
this.wooAutoSyncService.autoSyncProductUpdate(id, userId).catch((error: any) => {
  this.logger.error(`Auto-sync to WooCommerce failed: ${error.message}`);
});
```

- Product updates succeed even if WooCommerce sync fails
- Errors are logged for debugging
- Failed syncs can be manually re-triggered later

### Sync Status Tracking

Check sync status for any product:

```http
GET /integration/woocommerce/connections/:connectionId/sync-status?productIds=101,102
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "productId": 101,
      "wooProductId": 456,
      "lastExportedAt": "2025-12-18T10:30:00.000Z",
      "syncStatus": "synced",
      "errorMessage": null
    }
  ]
}
```

## Benefits

### For Users
- ✅ **No manual intervention required** after initial setup
- ✅ **Real-time sync** - changes reflect immediately in WooCommerce
- ✅ **Multi-store support** - updates push to all connected stores
- ✅ **Automatic cleanup** - no orphaned data

### For Developers
- ✅ **Non-blocking architecture** - doesn't slow down updates
- ✅ **Error resilience** - sync failures don't break product operations
- ✅ **Clean separation** - sync logic isolated in dedicated service
- ✅ **Backward compatible** - legacy manual export still works

## Migration Guide

### Existing Products

For products already in your system:

1. **One-time manual export** to establish sync relationship
2. **All future updates** will sync automatically
3. **No code changes needed** in your application

### New Products

For products created after this update:

1. Create product in PixelPIM as usual
2. **Export once** to WooCommerce using manual export endpoint
3. **Updates happen automatically** from that point forward

## Monitoring

### Logs

Auto-sync operations are logged:

```
[WooCommerceAutoSyncService] Auto-syncing product 101 to 2 WooCommerce connection(s)
[WooCommerceAutoSyncService] Successfully auto-synced product 101 to connection Store A
[WooCommerceAutoSyncService] Failed to auto-sync product 101 to connection Store B: Connection timeout
```

### Database Records

Sync status is tracked in `WooCommerceProductSync` table:

```prisma
model WooCommerceProductSync {
  id                 Int      @id @default(autoincrement())
  connectionId       Int
  productId          Int
  wooProductId       Int
  lastExportedAt     DateTime?
  lastModifiedFields Json?
  syncStatus         String   @default("synced")
  errorMessage       String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}
```

## Troubleshooting

### Product Not Auto-Syncing

**Cause:** Product has never been manually exported
**Solution:** Perform initial manual export to create sync relationship

### Sync Errors

**Cause:** WooCommerce connection issues, invalid credentials, network problems
**Solution:** Check sync status endpoint, verify connection settings, retry manual export

### Sync Data Not Cleaning Up

**Cause:** Database error during deletion
**Solution:** Manually delete orphaned records from `WooCommerceProductSync` table

## API Reference

### Manual Export (Legacy/Initial Sync)

```http
POST /integration/woocommerce/connections/export
Authorization: Bearer {token}
Content-Type: application/json

{
  "connectionId": 1,
  "productIds": [101, 102],
  "fieldsToExport": ["name", "sku", "price", "images", "COLOR"],
  "partialUpdate": false
}
```

### Check Sync Status

```http
GET /integration/woocommerce/connections/:connectionId/sync-status
Authorization: Bearer {token}
```

### Get Sync Statistics

```http
GET /integration/woocommerce/connections/:connectionId/stats
Authorization: Bearer {token}
```

## Future Enhancements

Potential improvements for future releases:

1. **Batch Sync Queue** - Queue multiple updates and sync in batches
2. **Sync Retry Logic** - Automatically retry failed syncs
3. **Selective Auto-Sync** - Allow users to disable auto-sync for specific products
4. **Sync Conflict Resolution** - Handle conflicts when product updated in both systems
5. **Webhook-based Sync** - Two-way sync using webhooks

## Conclusion

The auto-sync feature significantly improves the user experience by eliminating manual export steps for product updates. The system is designed to be:

- **Reliable** - Non-blocking, error-resilient
- **Efficient** - Only syncs when needed
- **Transparent** - Full logging and status tracking
- **Backward Compatible** - Doesn't break existing workflows

For questions or issues, refer to the main WooCommerce integration documentation or contact support.
