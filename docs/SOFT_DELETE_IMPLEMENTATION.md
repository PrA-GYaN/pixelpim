# Soft Delete Implementation Guide

## Overview

This document describes the soft-delete functionality implemented for Products and Assets in the PixelPim application. Soft delete allows records to be marked as deleted without actually removing them from the database, enabling data recovery and maintaining referential integrity.

## Schema Changes

### Updated Models

#### Product Model
```prisma
model Product {
  // ... existing fields ...
  deletedAt        DateTime?
  isDeleted        Boolean         @default(false)
  
  // Updated unique constraints to account for soft-deleted records
  @@unique([sku, userId, deletedAt])
  @@unique([name, userId, deletedAt])
  @@index([userId, isDeleted])
}
```

#### Asset Model
```prisma
model Asset {
  // ... existing fields ...
  deletedAt    DateTime?
  isDeleted    Boolean     @default(false)
  
  // Updated unique constraints to account for soft-deleted records
  @@unique([name, userId, assetGroupId, deletedAt])
  @@index([userId, isDeleted])
}
```

### Key Changes

1. **New Fields**:
   - `deletedAt`: Timestamp when the record was soft-deleted (nullable)
   - `isDeleted`: Boolean flag for quick filtering (default: false, indexed)

2. **Updated Unique Constraints**:
   - Added `deletedAt` to unique constraints to allow creating new records with the same SKU/name after soft deletion
   - This enables users to reuse SKUs/names after deleting products

3. **Indexes**:
   - Added composite index on `[userId, isDeleted]` for efficient querying of non-deleted records
   - Recommended: PostgreSQL partial indexes for even better performance (see below)

## Migration

The migration was created with:
```bash
npx prisma migrate dev --name add_soft_delete_fields
```

Migration file: `prisma/migrations/20251119045739_add_soft_delete_fields/migration.sql`

## Service Layer Implementation

### Product Service

#### New Methods

1. **`softDeleteProduct(id, userId, softDeleteVariants?)`**
   - Soft deletes a product by setting `deletedAt` and `isDeleted`
   - Optional: Also soft-delete all variants
   - Logs notification for user

2. **`restoreProduct(id, userId, restoreVariants?)`**
   - Restores a soft-deleted product
   - Checks for SKU conflicts before restoring
   - Optional: Also restore variants
   - Logs notification for user

3. **`getSoftDeletedProducts(userId, page, limit)`**
   - Fetches paginated list of soft-deleted products
   - Ordered by deletion date (most recent first)

4. **`permanentlyDeleteProduct(id, userId)`**
   - Permanently removes a soft-deleted product from the database
   - Unlinks variants before deletion
   - **Warning**: This operation is irreversible

#### Updated Methods

1. **`findAll()`**
   - Now accepts `includeDeleted` parameter (default: false)
   - Automatically filters out soft-deleted products unless explicitly requested

2. **`findOne()`**
   - Now accepts `includeDeleted` parameter (default: false)
   - Returns 404 for soft-deleted products unless explicitly requested

3. **`create()`**
   - Updated SKU uniqueness check to exclude soft-deleted products
   - Allows creating products with SKUs of soft-deleted records

4. **`remove()`**
   - Now performs soft delete instead of hard delete
   - Internally calls `softDeleteProduct()`

5. **`bulkRemove()`**
   - Updated to use soft delete for bulk operations
   - Filters exclude soft-deleted products from bulk selection

### Asset Service

#### New Methods

1. **`softDeleteAsset(id, userId)`**
   - Soft deletes an asset
   - Updates asset group size if applicable

2. **`restoreAsset(id, userId)`**
   - Restores a soft-deleted asset
   - Checks for name conflicts before restoring
   - Updates asset group size

3. **`getSoftDeletedAssets(userId, page, limit)`**
   - Fetches paginated list of soft-deleted assets
   - Ordered by deletion date

4. **`permanentlyDeleteAsset(id, userId)`**
   - Permanently deletes a soft-deleted asset
   - Removes files from Cloudinary and local storage
   - Updates asset group size

#### Updated Methods

1. **`findAll()`**
   - Added `includeDeleted` parameter (default: false)
   - Automatically filters out soft-deleted assets

2. **`findOne()`**
   - Added `includeDeleted` parameter (default: false)
   - Returns 404 for soft-deleted assets unless explicitly requested

3. **`create()`**
   - Updated name uniqueness check to exclude soft-deleted assets

4. **`remove()`**
   - Now performs soft delete instead of hard delete

## Controller Endpoints

### Product Controller

#### New Endpoints

1. **GET `/products/deleted`**
   - Get soft-deleted products
   - Query params: `page`, `limit`
   - Returns paginated list of soft-deleted products

2. **POST `/products/:id/restore`**
   - Restore a soft-deleted product
   - Query param: `restoreVariants=true` (optional)
   - Returns restored product

3. **DELETE `/products/:id/permanent`**
   - Permanently delete a soft-deleted product
   - **Warning**: Irreversible operation
   - Returns success message

#### Updated Endpoints

- **DELETE `/products/:id`**: Now performs soft delete

### Asset Controller

#### New Endpoints

1. **GET `/assets/deleted`**
   - Get soft-deleted assets
   - Query params: `page`, `limit`
   - Returns paginated list of soft-deleted assets

2. **POST `/assets/:id/restore`**
   - Restore a soft-deleted asset
   - Returns restored asset

3. **DELETE `/assets/:id/permanent`**
   - Permanently delete a soft-deleted asset
   - **Warning**: Irreversible operation
   - Removes files from storage
   - Returns success message

#### Updated Endpoints

- **DELETE `/assets/:id`**: Now performs soft delete

## Prisma Middleware

### Automatic Filtering

The `softDeleteMiddleware` automatically filters out soft-deleted records in all read operations unless explicitly requested.

**File**: `src/middleware/softDeleteMiddleware.ts`

**Features**:
- Automatically adds `isDeleted: false` to WHERE clauses
- Applies to: `findUnique`, `findFirst`, `findMany`, `count`, `aggregate`, `groupBy`
- Can be bypassed by explicitly setting `isDeleted: true` or `isDeleted: undefined`
- Also filters update/delete operations to prevent accidental modification of soft-deleted records

**Usage**:
```typescript
// Normal query - automatically excludes soft-deleted
const products = await prisma.product.findMany({ where: { userId: 1 } });

// Include soft-deleted records explicitly
const allProducts = await prisma.product.findMany({ 
  where: { userId: 1, isDeleted: undefined } 
});

// Query only soft-deleted records
const deletedProducts = await prisma.product.findMany({ 
  where: { userId: 1, isDeleted: true } 
});
```

## Database Index Recommendations

### PostgreSQL Partial Indexes

For optimal query performance, create partial indexes on non-deleted records:

```sql
-- Product partial indexes
CREATE INDEX idx_product_active_sku_userid 
ON "Product" (sku, "userId") 
WHERE "isDeleted" = false;

CREATE INDEX idx_product_active_name_userid 
ON "Product" (name, "userId") 
WHERE "isDeleted" = false;

-- Asset partial indexes
CREATE INDEX idx_asset_active_name_userid_groupid 
ON "Asset" (name, "userId", "assetGroupId") 
WHERE "isDeleted" = false;
```

**Benefits**:
- Smaller index size (only non-deleted records)
- Faster queries for active records
- Improved uniqueness checking
- Better performance for the 99% case (non-deleted records)

### Index Usage

The existing composite indexes are already in place:
- `Product(userId, isDeleted)`
- `Asset(userId, isDeleted)`

These enable fast filtering of soft-deleted records.

## Best Practices

### 1. Use Soft Delete by Default

```typescript
// ❌ Don't use hard delete directly
await prisma.product.delete({ where: { id } });

// ✅ Use the service method (soft delete)
await productService.remove(id, userId);
```

### 2. Check Before Restoring

The restore methods automatically check for conflicts, but you should inform users:

```typescript
try {
  await productService.restoreProduct(id, userId);
} catch (error) {
  if (error instanceof ConflictException) {
    // Inform user that SKU is already in use
  }
}
```

### 3. Permanent Deletion Requires Confirmation

Always require user confirmation before permanent deletion:

```typescript
// Frontend should show a warning dialog
const confirmed = await showConfirmationDialog(
  'This action cannot be undone. Permanently delete this product?'
);

if (confirmed) {
  await productService.permanentlyDeleteProduct(id, userId);
}
```

### 4. Soft Delete Relations

When soft-deleting a product, decide whether to cascade to variants:

```typescript
// Soft delete product only
await productService.softDeleteProduct(id, userId, false);

// Soft delete product and all variants
await productService.softDeleteProduct(id, userId, true);
```

### 5. Cleanup Strategy

Consider implementing a cleanup job to permanently delete old soft-deleted records:

```typescript
// Example: Delete records soft-deleted > 30 days ago
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const oldDeleted = await prisma.product.findMany({
  where: {
    isDeleted: true,
    deletedAt: { lt: thirtyDaysAgo }
  }
});

// Permanently delete each record
for (const product of oldDeleted) {
  await productService.permanentlyDeleteProduct(product.id, product.userId);
}
```

## Error Handling

### Common Scenarios

1. **Product/Asset Not Found**
   ```typescript
   throw new NotFoundException('Product with ID ${id} not found or already deleted');
   ```

2. **Restore Conflict**
   ```typescript
   throw new ConflictException('Cannot restore: A product with SKU "${sku}" already exists');
   ```

3. **Already Deleted**
   - Attempting to soft-delete an already deleted record returns a not found error
   - This is intentional to prevent duplicate deletion notifications

## Testing

### Unit Tests

Test scenarios to cover:
1. Soft delete a product/asset
2. Restore a soft-deleted product/asset
3. Attempt to restore with conflict
4. Permanently delete a soft-deleted record
5. Query excludes soft-deleted records
6. Query with `includeDeleted: true`
7. Create new record with same SKU/name as soft-deleted record

### Integration Tests

Test API endpoints:
1. DELETE /products/:id (soft delete)
2. GET /products/deleted
3. POST /products/:id/restore
4. DELETE /products/:id/permanent

## Migration Path

### From Existing Data

If you have existing data without soft-delete fields:

1. Migration automatically adds `deletedAt` (NULL) and `isDeleted` (false)
2. All existing records are considered "not deleted"
3. No data loss or changes required

### Rollback

If you need to rollback the soft-delete feature:

```bash
# Revert migration
npx prisma migrate revert

# Or manually remove the fields and update schema
```

**Note**: Permanently deleted records cannot be recovered after rollback.

## Performance Considerations

1. **Index Usage**: The composite index `(userId, isDeleted)` enables efficient filtering
2. **Partial Indexes**: Recommended for PostgreSQL to improve query performance
3. **Middleware Overhead**: Minimal - only adds a WHERE clause filter
4. **Storage**: Soft-deleted records remain in the database, increasing storage needs
5. **Cleanup**: Implement periodic cleanup to remove old soft-deleted records

## Security Considerations

1. **Authorization**: Soft delete and restore operations check user ownership
2. **Audit Trail**: `deletedAt` timestamp provides audit information
3. **Permanent Delete**: Only allow for administrators or after confirmation
4. **Data Recovery**: Soft delete enables data recovery without backups

## Future Enhancements

1. **Restore History**: Track restore events in a separate table
2. **Bulk Restore**: Add endpoint to restore multiple items
3. **Scheduled Cleanup**: Automated job to permanently delete old records
4. **Deleted Items UI**: Admin interface to browse and restore deleted items
5. **Cascade Rules**: More granular control over cascading soft deletes

## Troubleshooting

### Issue: Unique constraint violation on restore

**Cause**: A new record was created with the same SKU/name after soft delete

**Solution**: The restore method checks for conflicts and returns a clear error message. User must either:
1. Delete or rename the conflicting record
2. Permanently delete the old soft-deleted record

### Issue: Middleware not filtering soft-deleted records

**Cause**: Explicit `isDeleted` value in WHERE clause

**Solution**: Don't set `isDeleted` in queries unless you specifically want to include deleted records

### Issue: Performance degradation

**Cause**: Too many soft-deleted records without partial indexes

**Solution**: 
1. Create partial indexes (see recommendations)
2. Implement cleanup strategy for old deleted records

## Summary

The soft-delete implementation provides:
- ✅ Data safety and recovery
- ✅ Referential integrity
- ✅ Audit trail
- ✅ User-friendly deletion/restoration
- ✅ Automatic filtering via middleware
- ✅ Performance optimizations
- ✅ Flexible cascade options

All delete operations now use soft delete by default, with explicit permanent delete requiring confirmation.
