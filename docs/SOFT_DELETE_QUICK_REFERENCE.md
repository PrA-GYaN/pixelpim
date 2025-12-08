# Soft Delete Quick Reference

## API Endpoints

### Products

#### Delete (Soft Delete)
```http
DELETE /products/:id
```
- Soft deletes a product
- Product can be restored later

#### Get Soft-Deleted Products
```http
GET /products/deleted?page=1&limit=10
```
- Lists all soft-deleted products
- Paginated response

#### Restore Product
```http
POST /products/:id/restore?restoreVariants=true
```
- Restores a soft-deleted product
- Optional: `restoreVariants=true` to also restore variants
- Returns error if SKU conflict exists

#### Permanently Delete Product
```http
DELETE /products/:id/permanent
```
- **Warning**: Irreversible operation
- Only works on soft-deleted products
- Removes product from database completely

### Assets

#### Delete (Soft Delete)
```http
DELETE /assets/:id
```
- Soft deletes an asset
- Asset can be restored later

#### Get Soft-Deleted Assets
```http
GET /assets/deleted?page=1&limit=10
```
- Lists all soft-deleted assets
- Paginated response

#### Restore Asset
```http
POST /assets/:id/restore
```
- Restores a soft-deleted asset
- Returns error if name conflict exists

#### Permanently Delete Asset
```http
DELETE /assets/:id/permanent
```
- **Warning**: Irreversible operation
- Removes asset and files from storage
- Only works on soft-deleted assets

## Service Methods

### ProductService

```typescript
// Soft delete a product
await productService.softDeleteProduct(productId, userId, softDeleteVariants);

// Restore a soft-deleted product
await productService.restoreProduct(productId, userId, restoreVariants);

// Get soft-deleted products
await productService.getSoftDeletedProducts(userId, page, limit);

// Permanently delete (hard delete)
await productService.permanentlyDeleteProduct(productId, userId);

// Query with includeDeleted flag
await productService.findAll(userId, search, status, categoryId, 
  attributeIds, attributeGroupId, familyId, page, limit, 
  sortBy, sortOrder, includeDeleted);
```

### AssetService

```typescript
// Soft delete an asset
await assetService.softDeleteAsset(assetId, userId);

// Restore a soft-deleted asset
await assetService.restoreAsset(assetId, userId);

// Get soft-deleted assets
await assetService.getSoftDeletedAssets(userId, page, limit);

// Permanently delete (hard delete)
await assetService.permanentlyDeleteAsset(assetId, userId);

// Query with includeDeleted flag
await assetService.findAll(userId, assetGroupId, page, limit, filters, includeDeleted);
```

## Prisma Queries

### Exclude Soft-Deleted (Default)
```typescript
// Automatically excludes soft-deleted due to middleware
const products = await prisma.product.findMany({
  where: { userId: 1 }
});
```

### Include Soft-Deleted
```typescript
// Explicitly set isDeleted to undefined to bypass middleware
const allProducts = await prisma.product.findMany({
  where: { userId: 1, isDeleted: undefined }
});
```

### Query Only Soft-Deleted
```typescript
const deletedProducts = await prisma.product.findMany({
  where: { userId: 1, isDeleted: true }
});
```

### Query with Specific Delete Status
```typescript
// Include both deleted and non-deleted
const allProducts = await prisma.product.findMany({
  where: { 
    userId: 1,
    OR: [
      { isDeleted: true },
      { isDeleted: false }
    ]
  }
});
```

## Database Schema

### Product
```typescript
{
  id: number;
  name: string;
  sku: string;
  deletedAt: DateTime | null;  // Timestamp of deletion
  isDeleted: boolean;           // Flag for quick filtering
  // ... other fields
}
```

### Asset
```typescript
{
  id: number;
  name: string;
  fileName: string;
  deletedAt: DateTime | null;  // Timestamp of deletion
  isDeleted: boolean;           // Flag for quick filtering
  // ... other fields
}
```

## Common Patterns

### Safe Delete with Confirmation
```typescript
// Controller
@Delete(':id')
async remove(@Param('id') id: number, @GetUser() user: User) {
  // Soft delete (default)
  return this.productService.remove(id, user.id);
}

// For permanent delete, require explicit confirmation
@Delete(':id/permanent')
async permanentDelete(@Param('id') id: number, @GetUser() user: User) {
  // Verify it's soft-deleted first
  const product = await this.productService.findOne(id, user.id, true);
  if (!product.isDeleted) {
    throw new BadRequestException('Product must be soft-deleted first');
  }
  return this.productService.permanentlyDeleteProduct(id, user.id);
}
```

### Restore with Conflict Handling
```typescript
try {
  const result = await productService.restoreProduct(productId, userId);
  return { success: true, product: result.product };
} catch (error) {
  if (error instanceof ConflictException) {
    return { 
      success: false, 
      message: 'Cannot restore: SKU already in use by another product'
    };
  }
  throw error;
}
```

### Bulk Operations
```typescript
// Soft delete multiple products
const productIds = [1, 2, 3, 4, 5];
let deletedCount = 0;

for (const id of productIds) {
  try {
    await productService.softDeleteProduct(id, userId);
    deletedCount++;
  } catch (error) {
    console.error(`Failed to delete product ${id}:`, error.message);
  }
}

console.log(`Soft deleted ${deletedCount} products`);
```

### Cleanup Old Deleted Records
```typescript
// Cleanup job - runs daily
async cleanupOldDeletedRecords() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const oldProducts = await prisma.product.findMany({
    where: {
      isDeleted: true,
      deletedAt: { lt: thirtyDaysAgo }
    },
    select: { id: true, userId: true }
  });

  for (const product of oldProducts) {
    await productService.permanentlyDeleteProduct(product.id, product.userId);
  }
}
```

## Error Handling

### Not Found
```typescript
throw new NotFoundException('Product with ID ${id} not found or already deleted');
```

### Conflict on Restore
```typescript
throw new ConflictException('Cannot restore: A product with SKU "${sku}" already exists');
```

### Already Deleted
```typescript
// When attempting to soft-delete an already deleted record
throw new NotFoundException('Product not found or already deleted');
```

## Testing Examples

### Unit Test
```typescript
describe('ProductService - Soft Delete', () => {
  it('should soft delete a product', async () => {
    const result = await service.softDeleteProduct(1, userId);
    expect(result.product.isDeleted).toBe(true);
    expect(result.product.deletedAt).toBeDefined();
  });

  it('should restore a soft-deleted product', async () => {
    await service.softDeleteProduct(1, userId);
    const result = await service.restoreProduct(1, userId);
    expect(result.product.isDeleted).toBe(false);
    expect(result.product.deletedAt).toBeNull();
  });

  it('should throw conflict error when restoring with SKU conflict', async () => {
    await service.softDeleteProduct(1, userId);
    await service.create({ sku: 'SAME-SKU', name: 'New' }, userId);
    
    await expect(service.restoreProduct(1, userId))
      .rejects.toThrow(ConflictException);
  });
});
```

### Integration Test
```typescript
describe('DELETE /products/:id', () => {
  it('should soft delete a product', async () => {
    const response = await request(app.getHttpServer())
      .delete('/products/1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.message).toContain('soft deleted');
  });
});

describe('POST /products/:id/restore', () => {
  it('should restore a soft-deleted product', async () => {
    await request(app.getHttpServer())
      .delete('/products/1')
      .set('Authorization', `Bearer ${token}`);

    const response = await request(app.getHttpServer())
      .post('/products/1/restore')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.product.isDeleted).toBe(false);
  });
});
```

## Best Practices

1. ✅ Always use soft delete for user-initiated deletions
2. ✅ Require confirmation for permanent deletions
3. ✅ Check for conflicts before restoring
4. ✅ Implement cleanup jobs for old deleted records
5. ✅ Log all deletion and restoration operations
6. ✅ Use `includeDeleted: true` only when explicitly needed
7. ✅ Create partial indexes for better performance
8. ❌ Don't bypass the service layer for deletions
9. ❌ Don't permanently delete without user confirmation
10. ❌ Don't forget to handle cascade deletions for related records
