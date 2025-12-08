# Soft Delete Feature - Complete Implementation

## 🎯 Overview

This implementation adds soft-delete functionality to the PixelPim backend for **Products** and **Assets**. Soft delete marks records as deleted without removing them from the database, enabling data recovery and maintaining referential integrity.

## 📁 Files Modified/Created

### Schema & Migration
- ✅ `prisma/schema.prisma` - Updated Product and Asset models
- ✅ `prisma/migrations/20251119045739_add_soft_delete_fields/migration.sql` - Database migration
- ✅ `prisma/soft_delete_indexes.sql` - Performance optimization indexes

### Backend Services
- ✅ `src/product/product.service.ts` - Added soft-delete methods
- ✅ `src/asset/asset.service.ts` - Added soft-delete methods
- ✅ `src/middleware/softDeleteMiddleware.ts` - Automatic filtering middleware
- ✅ `src/prisma/prisma.service.ts` - Integrated middleware

### Controllers
- ✅ `src/product/product.controller.ts` - New soft-delete endpoints
- ✅ `src/asset/asset.controller.ts` - New soft-delete endpoints

### Documentation
- ✅ `docs/SOFT_DELETE_IMPLEMENTATION.md` - Complete implementation guide
- ✅ `docs/SOFT_DELETE_QUICK_REFERENCE.md` - Developer quick reference
- ✅ `SOFT_DELETE_SUMMARY.md` - Implementation summary
- ✅ `PRODUCTION_DEPLOYMENT_GUIDE.md` - Production deployment steps

## 🚀 Quick Start

### 1. Apply Migration (Already Applied)
```bash
npx prisma migrate deploy
npx prisma generate
```

### 2. (Optional) Apply Performance Indexes
```bash
psql -d pixelpim -f prisma/soft_delete_indexes.sql
```

### 3. Test Endpoints

**Soft Delete a Product:**
```bash
curl -X DELETE http://localhost:3000/products/1 \
  -H "Authorization: Bearer $TOKEN"
```

**Get Deleted Products:**
```bash
curl http://localhost:3000/products/deleted \
  -H "Authorization: Bearer $TOKEN"
```

**Restore a Product:**
```bash
curl -X POST http://localhost:3000/products/1/restore \
  -H "Authorization: Bearer $TOKEN"
```

## 📚 Documentation

### For Developers
- **Implementation Guide**: [`docs/SOFT_DELETE_IMPLEMENTATION.md`](docs/SOFT_DELETE_IMPLEMENTATION.md)
  - Complete technical details
  - Schema changes
  - Service layer implementation
  - Middleware functionality
  - Best practices

- **Quick Reference**: [`docs/SOFT_DELETE_QUICK_REFERENCE.md`](docs/SOFT_DELETE_QUICK_REFERENCE.md)
  - API endpoints
  - Code examples
  - Common patterns
  - Testing examples

### For DevOps/Deployment
- **Deployment Guide**: [`PRODUCTION_DEPLOYMENT_GUIDE.md`](PRODUCTION_DEPLOYMENT_GUIDE.md)
  - Pre-deployment checklist
  - Step-by-step deployment
  - Rollback procedures
  - Monitoring setup
  - Troubleshooting

### Summary
- **Implementation Summary**: [`SOFT_DELETE_SUMMARY.md`](SOFT_DELETE_SUMMARY.md)
  - Feature overview
  - Deliverables checklist
  - API examples
  - Key features

## 🎨 Key Features

### 1. Automatic Filtering ✨
All queries automatically exclude soft-deleted records via Prisma middleware:

```typescript
// Automatically excludes soft-deleted
const products = await prisma.product.findMany({ 
  where: { userId: 1 } 
});

// Include soft-deleted if needed
const allProducts = await productService.findAll(
  userId, search, status, categoryId, 
  attributeIds, attributeGroupId, familyId, 
  page, limit, sortBy, sortOrder, 
  true // includeDeleted
);
```

### 2. Data Recovery 🔄
Restore soft-deleted records with conflict detection:

```typescript
// Soft delete
await productService.softDeleteProduct(productId, userId);

// Restore (checks for SKU conflicts)
await productService.restoreProduct(productId, userId);
```

### 3. Cascade Control 🌊
Choose whether to cascade deletions to related records:

```typescript
// Delete product only
await productService.softDeleteProduct(productId, userId, false);

// Delete product AND variants
await productService.softDeleteProduct(productId, userId, true);
```

### 4. Flexible Unique Constraints 🔑
Reuse SKUs/names after deletion:

```prisma
// Before: @@unique([sku, userId])
// After:  @@unique([sku, userId, deletedAt])

// Allows:
1. Product "A" with SKU "ABC-123" (active)
2. Delete Product "A" (soft-deleted with deletedAt = 2024-01-01)
3. Create new Product "B" with SKU "ABC-123" (active)
4. Both records exist in DB without conflict
```

### 5. Performance Optimized ⚡
Partial indexes for fast queries:

```sql
-- Only indexes non-deleted records
CREATE INDEX idx_product_active_sku_userid 
ON "Product" (sku, "userId") 
WHERE "isDeleted" = false;
```

## 🛠️ New API Endpoints

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/products/deleted?page=1&limit=10` | List soft-deleted products |
| POST | `/products/:id/restore?restoreVariants=true` | Restore a product |
| DELETE | `/products/:id/permanent` | Permanently delete (⚠️ irreversible) |
| DELETE | `/products/:id` | Soft delete (updated) |

### Assets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/assets/deleted?page=1&limit=10` | List soft-deleted assets |
| POST | `/assets/:id/restore` | Restore an asset |
| DELETE | `/assets/:id/permanent` | Permanently delete (⚠️ irreversible) |
| DELETE | `/assets/:id` | Soft delete (updated) |

## 🔍 Service Methods

### ProductService

```typescript
// Soft delete operations
softDeleteProduct(id, userId, softDeleteVariants?)
restoreProduct(id, userId, restoreVariants?)
getSoftDeletedProducts(userId, page, limit)
permanentlyDeleteProduct(id, userId)

// Updated query methods (now have includeDeleted parameter)
findAll(...params, includeDeleted?)
findOne(id, userId, includeDeleted?)
```

### AssetService

```typescript
// Soft delete operations
softDeleteAsset(id, userId)
restoreAsset(id, userId)
getSoftDeletedAssets(userId, page, limit)
permanentlyDeleteAsset(id, userId)

// Updated query methods
findAll(...params, includeDeleted?)
findOne(id, userId, includeDeleted?)
```

## 📊 Database Changes

### Schema Updates

**Product Model:**
```prisma
model Product {
  // ... existing fields ...
  deletedAt    DateTime?
  isDeleted    Boolean    @default(false)
  
  @@unique([sku, userId, deletedAt])
  @@unique([name, userId, deletedAt])
  @@index([userId, isDeleted])
}
```

**Asset Model:**
```prisma
model Asset {
  // ... existing fields ...
  deletedAt    DateTime?
  isDeleted    Boolean    @default(false)
  
  @@unique([name, userId, assetGroupId, deletedAt])
  @@index([userId, isDeleted])
}
```

### Recommended Indexes

```sql
-- Apply with: psql -d pixelpim -f prisma/soft_delete_indexes.sql

-- Product indexes
idx_product_active_sku_userid
idx_product_active_name_userid
idx_product_active_category
idx_product_active_family
idx_product_active_variants

-- Asset indexes
idx_asset_active_name_userid_groupid
idx_asset_active_by_group
idx_asset_active_ungrouped
idx_asset_active_mimetype

-- Cleanup indexes
idx_product_deleted
idx_asset_deleted
idx_product_old_deleted
idx_asset_old_deleted
```

## ⚙️ Configuration

### Prisma Middleware

The soft-delete middleware is automatically applied in `PrismaService`:

```typescript
// src/prisma/prisma.service.ts
constructor() {
  super();
  this.$use(softDeleteMiddleware);
}
```

**What it does:**
- Adds `isDeleted: false` to all read queries
- Filters soft-deleted records automatically
- Can be bypassed with explicit `isDeleted` value

## 🧪 Testing

### Manual Testing

```bash
# 1. Soft delete a product
DELETE http://localhost:3000/products/1

# 2. Verify it's not in main list
GET http://localhost:3000/products
# Should NOT include product 1

# 3. Verify it's in deleted list
GET http://localhost:3000/products/deleted
# Should include product 1

# 4. Restore it
POST http://localhost:3000/products/1/restore

# 5. Verify it's back in main list
GET http://localhost:3000/products
# Should include product 1 again
```

### Unit Test Example

```typescript
describe('Soft Delete', () => {
  it('should soft delete and restore a product', async () => {
    // Create product
    const product = await service.create({ 
      sku: 'TEST', 
      name: 'Test' 
    }, userId);

    // Soft delete
    await service.softDeleteProduct(product.id, userId);
    
    // Verify not in main list
    const products = await service.findAll(userId);
    expect(products.data.find(p => p.id === product.id)).toBeUndefined();
    
    // Restore
    await service.restoreProduct(product.id, userId);
    
    // Verify back in main list
    const restoredProducts = await service.findAll(userId);
    expect(restoredProducts.data.find(p => p.id === product.id)).toBeDefined();
  });
});
```

## ⚠️ Important Notes

### For Developers
1. ✅ Always use service methods for deletions
2. ✅ Never bypass the service layer
3. ✅ Use `includeDeleted: true` sparingly
4. ✅ Test cascade behavior for your use case
5. ❌ Don't use `prisma.product.delete()` directly

### For Frontend
1. Update delete buttons to show "Move to Trash" or similar
2. Add "Deleted Items" / "Trash" view
3. Add "Restore" functionality
4. Require confirmation for permanent delete
5. Update search/filter logic (backend handles it, but UI should reflect it)

### For Production
1. Database backup before deployment
2. Apply migration during low-traffic period
3. Monitor query performance after deployment
4. Consider implementing cleanup job for old deleted records
5. Apply partial indexes for optimal performance

## 🔄 Cleanup Strategy

### Option 1: Scheduled Job (Recommended)

```typescript
// Run daily via cron
@Cron('0 2 * * *') // 2 AM
async cleanupOldDeletedRecords() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const oldProducts = await prisma.product.findMany({
    where: { isDeleted: true, deletedAt: { lt: thirtyDaysAgo } }
  });
  
  for (const product of oldProducts) {
    await productService.permanentlyDeleteProduct(product.id, product.userId);
  }
}
```

### Option 2: Manual Cleanup

```sql
-- Find records deleted > 30 days ago
SELECT COUNT(*) FROM "Product" 
WHERE "isDeleted" = true 
  AND "deletedAt" < (CURRENT_TIMESTAMP - INTERVAL '30 days');

-- Permanently delete them (⚠️ irreversible)
DELETE FROM "Product"
WHERE "isDeleted" = true 
  AND "deletedAt" < (CURRENT_TIMESTAMP - INTERVAL '30 days');
```

## 📈 Monitoring

### Metrics to Track

```sql
-- Soft delete rate
SELECT DATE("deletedAt"), COUNT(*) 
FROM "Product" 
WHERE "isDeleted" = true 
GROUP BY DATE("deletedAt");

-- Active vs deleted records
SELECT 
  COUNT(*) FILTER (WHERE "isDeleted" = false) as active,
  COUNT(*) FILTER (WHERE "isDeleted" = true) as deleted,
  COUNT(*) as total
FROM "Product";

-- Storage impact
SELECT pg_size_pretty(pg_total_relation_size('Product')) as size;
```

## 🐛 Troubleshooting

### Common Issues

1. **"Unique constraint violation on restore"**
   - Another product with the same SKU exists
   - Solution: Rename or delete the conflicting product

2. **"Queries still return deleted records"**
   - Check if `isDeleted` is explicitly set in WHERE clause
   - Solution: Don't set `isDeleted` unless intentional

3. **"Performance degradation"**
   - Too many soft-deleted records
   - Solution: Apply partial indexes and implement cleanup job

See [`docs/SOFT_DELETE_IMPLEMENTATION.md`](docs/SOFT_DELETE_IMPLEMENTATION.md) for detailed troubleshooting.

## 🎓 Learn More

- [Full Implementation Guide](docs/SOFT_DELETE_IMPLEMENTATION.md)
- [Quick Reference](docs/SOFT_DELETE_QUICK_REFERENCE.md)
- [Production Deployment](PRODUCTION_DEPLOYMENT_GUIDE.md)
- [Implementation Summary](SOFT_DELETE_SUMMARY.md)

## ✅ Checklist

- [x] Schema updated
- [x] Migration created and applied
- [x] Service layer updated
- [x] Controllers updated
- [x] Middleware implemented
- [x] Documentation complete
- [x] Index recommendations provided
- [ ] Frontend integration (out of scope)
- [ ] Unit tests (recommended)
- [ ] Integration tests (recommended)
- [ ] Cleanup job (optional)
- [ ] Partial indexes applied (optional but recommended)

## 🙏 Support

Questions or issues? Check:
1. [Implementation Guide](docs/SOFT_DELETE_IMPLEMENTATION.md) - Technical details
2. [Quick Reference](docs/SOFT_DELETE_QUICK_REFERENCE.md) - Code examples
3. [Deployment Guide](PRODUCTION_DEPLOYMENT_GUIDE.md) - Production steps

---

**Status**: ✅ **Complete and Ready for Production**

All backend implementation is complete. No frontend code was generated as requested.
