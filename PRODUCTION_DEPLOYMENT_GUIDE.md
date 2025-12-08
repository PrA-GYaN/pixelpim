# Production Deployment Guide - Soft Delete Feature

## Pre-Deployment Checklist

- [ ] Database backup completed
- [ ] Migration file reviewed: `20251119045739_add_soft_delete_fields`
- [ ] Index recommendations reviewed: `soft_delete_indexes.sql`
- [ ] Team notified of deployment
- [ ] Rollback plan documented

---

## Deployment Steps

### 1. Backup Database

```bash
# PostgreSQL backup
pg_dump -h localhost -U postgres -d pixelpim > backup_before_soft_delete_$(date +%Y%m%d_%H%M%S).sql

# Or use your cloud provider's backup tool
# - AWS RDS: Create manual snapshot
# - Azure Database: Create backup
# - Heroku: heroku pg:backups:capture
```

### 2. Apply Migration (Production)

```bash
cd PixelPim_backend

# Set production environment variables
export DATABASE_URL="your_production_database_url"

# Apply migration
npx prisma migrate deploy

# Verify migration
npx prisma migrate status
```

**Expected Output:**
```
The following migration(s) have been applied:
migrations/
  └─ 20251119045739_add_soft_delete_fields/
    └─ migration.sql
```

### 3. Generate Prisma Client

```bash
npx prisma generate
```

### 4. (Optional but Recommended) Apply Partial Indexes

```bash
# Connect to production database
psql -h your-db-host -U your-db-user -d pixelpim

# Run the index script
\i prisma/soft_delete_indexes.sql

# Verify indexes created
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('Product', 'Asset')
  AND indexname LIKE 'idx_%_active_%';

# Exit psql
\q
```

### 5. Build and Deploy Application

```bash
# Build the application
npm run build

# Deploy to your hosting platform
# Examples:
# - Docker: docker build -t pixelpim-backend .
# - Heroku: git push heroku main
# - AWS: eb deploy
# - Manual: pm2 restart pixelpim-backend
```

### 6. Verify Deployment

```bash
# Test soft delete endpoint
curl -X DELETE https://your-domain.com/products/TEST_ID \
  -H "Authorization: Bearer $TOKEN"

# Test get deleted endpoint
curl https://your-domain.com/products/deleted \
  -H "Authorization: Bearer $TOKEN"

# Test restore endpoint
curl -X POST https://your-domain.com/products/TEST_ID/restore \
  -H "Authorization: Bearer $TOKEN"
```

---

## Post-Deployment Verification

### Database Verification

```sql
-- Check new columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'Product' 
  AND column_name IN ('deletedAt', 'isDeleted');

-- Check all existing records have isDeleted = false
SELECT COUNT(*) as total_products, 
       SUM(CASE WHEN "isDeleted" = false THEN 1 ELSE 0 END) as active_products,
       SUM(CASE WHEN "isDeleted" = true THEN 1 ELSE 0 END) as deleted_products
FROM "Product";

-- Same for Assets
SELECT COUNT(*) as total_assets,
       SUM(CASE WHEN "isDeleted" = false THEN 1 ELSE 0 END) as active_assets,
       SUM(CASE WHEN "isDeleted" = true THEN 1 ELSE 0 END) as deleted_assets
FROM "Asset";
```

**Expected Results:**
- `deletedAt` column: `timestamp without time zone`, nullable
- `isDeleted` column: `boolean`, not null
- All `active_products` should equal `total_products`
- All `deleted_products` should be 0

### Application Verification

```bash
# Check application logs for errors
# Docker: docker logs pixelpim-backend --tail 100
# PM2: pm2 logs pixelpim-backend --lines 100
# Heroku: heroku logs --tail

# Monitor application health
curl https://your-domain.com/health

# Test critical endpoints
curl https://your-domain.com/products \
  -H "Authorization: Bearer $TOKEN"
```

### Performance Verification

```sql
-- Check query performance (should use indexes)
EXPLAIN ANALYZE 
SELECT * FROM "Product" 
WHERE "userId" = 1 AND "isDeleted" = false 
LIMIT 10;

-- Verify index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE tablename IN ('Product', 'Asset')
ORDER BY idx_scan DESC;
```

---

## Rollback Plan

### If Issues Occur:

#### Option 1: Quick Rollback (Disable Soft Delete)

```bash
# 1. Revert to previous deployment
git revert HEAD
npm run build
# Deploy previous version

# 2. Application will continue working with new columns
#    (they just won't be used)
```

#### Option 2: Full Rollback (Remove Columns)

**⚠️ WARNING: This will remove all soft-delete data**

```bash
# 1. Permanently delete all soft-deleted records
# Run this SQL BEFORE rolling back migration:
DELETE FROM "ProductAsset" 
WHERE "productId" IN (
  SELECT id FROM "Product" WHERE "isDeleted" = true
);

DELETE FROM "ProductAttribute" 
WHERE "productId" IN (
  SELECT id FROM "Product" WHERE "isDeleted" = true
);

DELETE FROM "Product" WHERE "isDeleted" = true;
DELETE FROM "Asset" WHERE "isDeleted" = true;

# 2. Rollback migration
npx prisma migrate revert

# 3. Verify rollback
npx prisma migrate status

# 4. Deploy previous application version
```

---

## Monitoring

### Metrics to Track

1. **Soft Delete Rate**
   ```sql
   SELECT DATE("deletedAt") as delete_date, COUNT(*) as delete_count
   FROM "Product"
   WHERE "isDeleted" = true
   GROUP BY DATE("deletedAt")
   ORDER BY delete_date DESC
   LIMIT 7;
   ```

2. **Restore Rate**
   ```sql
   -- Track in application logs or create a separate audit table
   ```

3. **Storage Growth**
   ```sql
   SELECT 
     pg_size_pretty(pg_total_relation_size('Product')) as product_size,
     pg_size_pretty(pg_total_relation_size('Asset')) as asset_size;
   ```

4. **Query Performance**
   ```sql
   -- Monitor slow queries
   SELECT query, calls, mean_exec_time, max_exec_time
   FROM pg_stat_statements
   WHERE query LIKE '%Product%' OR query LIKE '%Asset%'
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

### Alerts to Configure

1. High rate of soft deletes (threshold: > 100/hour)
2. Slow query performance (threshold: > 1s)
3. Database storage growth (threshold: > 80% capacity)
4. Failed restore attempts (potential data conflicts)

---

## Cleanup Job Setup (Optional)

### Create Scheduled Cleanup Job

```typescript
// cleanup.service.ts
@Injectable()
export class CleanupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productService: ProductService,
    private readonly assetService: AssetService,
  ) {}

  // Run this daily via cron job
  @Cron('0 2 * * *') // 2 AM daily
  async cleanupOldDeletedRecords() {
    const retentionDays = 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Find old deleted products
    const oldProducts = await this.prisma.product.findMany({
      where: {
        isDeleted: true,
        deletedAt: { lt: cutoffDate }
      },
      select: { id: true, userId: true }
    });

    // Permanently delete
    for (const product of oldProducts) {
      try {
        await this.productService.permanentlyDeleteProduct(
          product.id, 
          product.userId
        );
      } catch (error) {
        console.error(`Failed to cleanup product ${product.id}:`, error);
      }
    }

    // Same for assets
    const oldAssets = await this.prisma.asset.findMany({
      where: {
        isDeleted: true,
        deletedAt: { lt: cutoffDate }
      },
      select: { id: true, userId: true }
    });

    for (const asset of oldAssets) {
      try {
        await this.assetService.permanentlyDeleteAsset(
          asset.id, 
          asset.userId
        );
      } catch (error) {
        console.error(`Failed to cleanup asset ${asset.id}:`, error);
      }
    }

    console.log(`Cleanup complete: ${oldProducts.length} products, ${oldAssets.length} assets`);
  }
}
```

### Alternative: AWS Lambda/Cloud Function

```javascript
// serverless-cleanup.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.handler = async (event) => {
  const retentionDays = 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const oldProducts = await prisma.product.findMany({
    where: {
      isDeleted: true,
      deletedAt: { lt: cutoffDate }
    }
  });

  for (const product of oldProducts) {
    await prisma.product.delete({ where: { id: product.id } });
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ 
      deleted: oldProducts.length,
      date: cutoffDate 
    })
  };
};
```

---

## Troubleshooting

### Issue: Migration Failed

**Error**: `Foreign key constraint failed`

**Solution**:
```sql
-- Check for orphaned records
SELECT p.id, p.name 
FROM "Product" p 
LEFT JOIN "User" u ON p."userId" = u.id 
WHERE u.id IS NULL;

-- Delete orphaned records
DELETE FROM "Product" WHERE "userId" NOT IN (SELECT id FROM "User");

-- Retry migration
npx prisma migrate deploy
```

### Issue: Unique Constraint Violation

**Error**: `Unique constraint failed on the fields: (sku,userId,deletedAt)`

**Solution**:
```sql
-- Find duplicates
SELECT "sku", "userId", COUNT(*) 
FROM "Product" 
WHERE "isDeleted" = false
GROUP BY "sku", "userId" 
HAVING COUNT(*) > 1;

-- Soft delete duplicates (keep most recent)
WITH ranked_products AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY "sku", "userId" ORDER BY "createdAt" DESC) as rn
  FROM "Product"
  WHERE "isDeleted" = false
)
UPDATE "Product" 
SET "isDeleted" = true, "deletedAt" = NOW()
WHERE id IN (
  SELECT id FROM ranked_products WHERE rn > 1
);
```

### Issue: Slow Queries

**Error**: Queries taking too long after migration

**Solution**:
```sql
-- Apply partial indexes
\i prisma/soft_delete_indexes.sql

-- Update statistics
ANALYZE "Product";
ANALYZE "Asset";

-- Vacuum if needed
VACUUM ANALYZE "Product";
VACUUM ANALYZE "Asset";
```

---

## Communication Template

### Pre-Deployment Email

```
Subject: [Maintenance] Soft Delete Feature Deployment

Hi Team,

We will be deploying the soft-delete feature for Products and Assets:

Date: [DATE]
Time: [TIME] (estimated 10 minutes)
Impact: No downtime expected

Changes:
- Products and Assets will be soft-deleted instead of permanently deleted
- Users can restore deleted items within 30 days
- New "Deleted Items" view will be available

What to expect:
- Existing products/assets remain unchanged
- All delete operations will be safe and reversible
- New restore functionality available

If you notice any issues, please contact: [CONTACT]

Thanks,
[YOUR NAME]
```

### Post-Deployment Email

```
Subject: [Complete] Soft Delete Feature Deployed Successfully

Hi Team,

The soft-delete feature has been deployed successfully.

Status: ✅ Deployed
Time: [TIME]
Migration: Applied successfully
Verification: All tests passed

New Endpoints:
- GET /products/deleted - View deleted products
- POST /products/:id/restore - Restore a product
- DELETE /products/:id/permanent - Permanently delete

Next Steps:
- Frontend team can start integration
- Documentation available in /docs folder
- Monitor dashboard for any anomalies

If you encounter any issues, please report immediately.

Thanks,
[YOUR NAME]
```

---

## Success Criteria

✅ Migration applied without errors
✅ All existing records have `isDeleted = false`
✅ Soft delete endpoint working correctly
✅ Restore endpoint working correctly
✅ Queries exclude soft-deleted records
✅ Application logs show no errors
✅ Performance metrics within acceptable range
✅ Team notified of successful deployment

---

## Support

For issues or questions:
1. Check documentation: `/docs/SOFT_DELETE_IMPLEMENTATION.md`
2. Review quick reference: `/docs/SOFT_DELETE_QUICK_REFERENCE.md`
3. Check application logs
4. Contact: [SUPPORT_EMAIL]

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Verified By**: _______________
**Sign-off**: _______________
