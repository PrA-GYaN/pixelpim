# WooCommerce Auto-Sync - Quick Reference

## 🎯 What Changed?

Products now **automatically sync to WooCommerce** when updated. No more manual exports needed for product updates!

## ✨ Key Features

- ✅ **Auto-sync on product update** - Name, price, description, etc.
- ✅ **Auto-sync on attribute update** - Custom and family attributes
- ✅ **Auto-sync on asset update** - Images and files
- ✅ **Auto-cleanup on delete** - Removes sync data when product deleted
- ✅ **Multi-store support** - Syncs to all connected WooCommerce stores
- ✅ **Non-blocking** - Sync failures don't break product updates

## 🚀 Quick Start

### 1. Initial Export (One Time)
```http
POST /integration/woocommerce/connections/export
{
  "connectionId": 1,
  "productIds": [101, 102, 103]
}
```
**This enables auto-sync for these products.**

### 2. Update Product (Auto-syncs!)
```http
PATCH /products/101
{
  "name": "Updated Product Name",
  "price": 99.99
}
```
**Automatically syncs to WooCommerce!**

### 3. Update Attributes (Auto-syncs!)
```http
PATCH /products/101/attributes
{
  "attributes": [
    { "attributeId": 1, "value": "Red" }
  ]
}
```
**Automatically syncs to WooCommerce!**

## 📊 Check Sync Status

```http
GET /integration/woocommerce/connections/:connectionId/sync-status?productIds=101
```

**Response:**
```json
{
  "data": [{
    "productId": 101,
    "wooProductId": 456,
    "lastExportedAt": "2025-12-18T10:30:00Z",
    "syncStatus": "synced",
    "errorMessage": null
  }]
}
```

## 🔧 Manual Export (Still Available)

Use manual export for:
- Initial product sync
- Bulk operations
- Re-syncing failed products

```http
POST /integration/woocommerce/connections/export
```

## ⚠️ Important Notes

1. **Initial export required** - Products must be manually exported once
2. **One-way sync** - Updates only push to WooCommerce (not from WooCommerce)
3. **Non-blocking** - Product updates succeed even if sync fails
4. **Errors logged** - Check logs for sync failures

## 🐛 Troubleshooting

### Product Not Auto-Syncing?
**Solution:** Perform initial manual export first

### Sync Failing?
**Check:**
- WooCommerce connection credentials
- Store accessibility
- Sync status endpoint for error details

### View Logs
```
[WooCommerceAutoSyncService] Auto-syncing product 101
[WooCommerceAutoSyncService] Successfully synced to Store A
[ProductService] Auto-sync failed: Connection timeout
```

## 📚 Full Documentation

See [`WOOCOMMERCE_AUTO_SYNC_GUIDE.md`](./WOOCOMMERCE_AUTO_SYNC_GUIDE.md) for complete documentation.

## 🎓 Migration Guide

### Existing Products
```bash
# Option 1: Export all at once
POST /integration/woocommerce/connections/export
{
  "connectionId": 1,
  "productIds": [all-your-product-ids]
}

# Option 2: Export gradually as needed
# Just export products when you're ready
# Auto-sync enables automatically
```

### New Products
1. Create product in PixelPIM
2. Export once to WooCommerce
3. All updates auto-sync from then on

## ✅ What You Get

- **Less work** - No manual exports for updates
- **Real-time sync** - Changes reflect immediately
- **Multi-store** - One update, all stores updated
- **Reliable** - Errors don't break your workflow
- **Clean data** - Automatic cleanup on delete

## 🔄 Workflow Comparison

### Before (Manual)
```
1. Update product
2. Go to sync center
3. Select products
4. Click export
5. Wait for sync
6. Check results
```

### After (Automatic)
```
1. Update product
✅ Done! (Auto-syncs in background)
```

---

**Questions?** Check the full guides:
- [`WOOCOMMERCE_AUTO_SYNC_GUIDE.md`](./WOOCOMMERCE_AUTO_SYNC_GUIDE.md)
- [`WOOCOMMERCE_AUTO_SYNC_IMPLEMENTATION_SUMMARY.md`](./WOOCOMMERCE_AUTO_SYNC_IMPLEMENTATION_SUMMARY.md)
