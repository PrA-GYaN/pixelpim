# MyDeal Integration - Migration Guide

## Overview

This guide covers the migration steps needed to enable MyDeal integration in your PixelPim installation.

## Prerequisites

- PixelPim backend running
- Database access
- Node.js and npm installed
- Prisma CLI available

## Migration Steps

### Step 1: Update Codebase

All necessary code files have been created. Ensure you have these files:

```
PixelPim_backend/src/integration/mydeal/
├── dto/mydeal.dto.ts
├── index.ts
├── mydeal.service.ts
├── mydeal.controller.ts
├── mydeal-auto-sync.service.ts
├── mydeal-connection.controller.ts
└── mydeal-connection.service.ts
```

Modified files:
- `src/integration/base/integration-type.enum.ts`
- `src/integration/base/integration.factory.ts`
- `src/integration/integration.module.ts`

### Step 2: Database Schema

**No database migration required!** The MyDeal integration uses existing tables:

1. `UserIntegrationCredentials` - Already exists for WooCommerce
2. `IntegrationLog` - Already exists for integration tracking

The `integrationType` field will support the new value: `'mydeal'`

### Step 3: Install Dependencies

No new dependencies are required. The integration uses existing packages:

```bash
# Verify these are in package.json (already there)
npm install axios
npm install @nestjs/common
npm install @prisma/client
```

### Step 4: Update TypeScript

Rebuild the TypeScript code:

```bash
cd PixelPim_backend
npm run build
```

### Step 5: Restart Backend

```bash
# Development
npm run start:dev

# Production
npm run start:prod
```

### Step 6: Verify Installation

Check that the MyDeal endpoints are available:

```bash
# Check health/status of backend
curl http://localhost:3000/health

# Verify MyDeal endpoints exist (will return 401 without auth)
curl http://localhost:3000/integration/mydeal/connection
```

## Database Verification

### Check Existing Schema

Verify that the required tables exist:

```sql
-- Check UserIntegrationCredentials table
SELECT * FROM "UserIntegrationCredentials" WHERE "integrationType" = 'mydeal' LIMIT 5;

-- Check IntegrationLog table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'IntegrationLog';
```

### Expected Schema

#### UserIntegrationCredentials
```prisma
model UserIntegrationCredentials {
  id              Int      @id @default(autoincrement())
  userId          Int
  integrationType String   // 'woocommerce', 'amazon', 'mydeal'
  credentials     Json     // Stores credentials
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user            User     @relation("UserIntegrationCredentials", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, integrationType])
  @@index([userId, integrationType])
}
```

#### IntegrationLog
```prisma
model IntegrationLog {
  id                   Int      @id @default(autoincrement())
  productId            Int
  integrationType      String   // 'woocommerce', 'amazon', 'shopify', 'mydeal'
  operation            String   // 'export', 'import', 'update', 'delete', 'webhook'
  status               String   // 'success', 'error', 'pending'
  message              String?
  errorDetails         Json?
  externalProductId    String?
  externalSku          String?
  metadata             Json?
  timestamp            DateTime @default(now())
  userId               Int

  user                 User     @relation("UserIntegrationLogs", fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, productId])
  @@index([userId, integrationType])
  @@index([timestamp])
  @@index([externalProductId, integrationType])
}
```

## Optional: Database Index Optimization

For better performance with MyDeal integration, you can add these indexes (optional):

```sql
-- Index for MyDeal credentials lookup (may already exist)
CREATE INDEX IF NOT EXISTS "UserIntegrationCredentials_userId_integrationType_idx" 
ON "UserIntegrationCredentials" ("userId", "integrationType");

-- Index for MyDeal integration logs (may already exist)
CREATE INDEX IF NOT EXISTS "IntegrationLog_userId_integrationType_idx" 
ON "IntegrationLog" ("userId", "integrationType");

-- Index for MyDeal product sync lookups (may already exist)
CREATE INDEX IF NOT EXISTS "IntegrationLog_externalProductId_integrationType_idx" 
ON "IntegrationLog" ("externalProductId", "integrationType");
```

## Testing Migration

### 1. Test Backend Startup

```bash
npm run start:dev

# Look for these logs:
# [NestApplication] Nest application successfully started
# [IntegrationModule] Module initialized
# [MyDealService] Service initialized
```

### 2. Test MyDeal Endpoints

```bash
# Should return 401 (unauthorized) - meaning endpoint exists
curl -X GET http://localhost:3000/integration/mydeal/connection

# Should return 401 (unauthorized) - meaning endpoint exists
curl -X POST http://localhost:3000/integration/mydeal/connection
```

### 3. Test with Valid JWT Token

```bash
# Replace YOUR_JWT_TOKEN with actual token
curl -X POST http://localhost:3000/integration/mydeal/connection/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "baseApiUrl": "https://api-integrations-sandbox.mydeal.com.au",
    "clientId": "test",
    "clientSecret": "test",
    "sellerId": "test",
    "sellerToken": "test"
  }'

# Expected: Connection test result (may fail with invalid credentials)
```

## Rollback Procedure

If you need to rollback the MyDeal integration:

### 1. Remove MyDeal Files

```bash
cd PixelPim_backend/src/integration
rm -rf mydeal/
```

### 2. Revert Modified Files

Restore these files from git:
```bash
git checkout src/integration/base/integration-type.enum.ts
git checkout src/integration/base/integration.factory.ts
git checkout src/integration/integration.module.ts
```

### 3. Rebuild

```bash
npm run build
```

### 4. Restart Backend

```bash
npm run start:dev
```

### 5. Clean Database (Optional)

```sql
-- Remove MyDeal credentials (optional)
DELETE FROM "UserIntegrationCredentials" WHERE "integrationType" = 'mydeal';

-- Remove MyDeal logs (optional)
DELETE FROM "IntegrationLog" WHERE "integrationType" = 'mydeal';
```

## Troubleshooting

### Issue: Backend Won't Start

**Solution**: Check for TypeScript compilation errors
```bash
npm run build
# Look for any errors in the output
```

### Issue: MyDeal Endpoints Return 404

**Solution**: Verify module registration
```bash
# Check that IntegrationModule includes MyDeal components
cat src/integration/integration.module.ts | grep -i mydeal
```

### Issue: Database Errors

**Solution**: Verify schema
```bash
# Generate Prisma client
npx prisma generate

# Check database connection
npx prisma db pull
```

### Issue: Authentication Fails

**Solution**: Check JWT token and permissions
- Verify JWT token is valid
- Check user has required permissions (integration:read, integration:create, etc.)
- Verify RBAC configuration

## Environment Variables (Optional)

While not required, you can add these optional environment variables:

```env
# .env file
MYDEAL_BASE_URL=https://api-integrations-sandbox.mydeal.com.au
MYDEAL_API_TIMEOUT=30000
```

## Production Deployment

### Checklist

- [ ] Test all endpoints in staging environment
- [ ] Verify database indexes are in place
- [ ] Test with production MyDeal credentials
- [ ] Enable logging for MyDeal operations
- [ ] Set up monitoring for MyDeal API calls
- [ ] Configure rate limiting if needed
- [ ] Update API documentation
- [ ] Train support team on MyDeal integration
- [ ] Prepare rollback plan

### Environment-Specific Configuration

#### Development
```env
MYDEAL_BASE_URL=https://api-integrations-sandbox.mydeal.com.au
NODE_ENV=development
```

#### Staging
```env
MYDEAL_BASE_URL=https://api-integrations-sandbox.mydeal.com.au
NODE_ENV=staging
```

#### Production
```env
MYDEAL_BASE_URL=https://api-integrations.mydeal.com.au
NODE_ENV=production
```

## Monitoring Setup

### Log Integration Events

```sql
-- View recent MyDeal operations
SELECT 
  "productId",
  "operation",
  "status",
  "message",
  "timestamp"
FROM "IntegrationLog"
WHERE "integrationType" = 'mydeal'
ORDER BY "timestamp" DESC
LIMIT 50;

-- Count operations by status
SELECT 
  "operation",
  "status",
  COUNT(*) as count
FROM "IntegrationLog"
WHERE "integrationType" = 'mydeal'
AND "timestamp" > NOW() - INTERVAL '24 hours'
GROUP BY "operation", "status";

-- Find failed operations
SELECT 
  "productId",
  "operation",
  "message",
  "errorDetails",
  "timestamp"
FROM "IntegrationLog"
WHERE "integrationType" = 'mydeal'
AND "status" = 'error'
ORDER BY "timestamp" DESC;
```

### Performance Monitoring

Monitor these metrics:
1. MyDeal API response times
2. Token refresh frequency
3. Failed authentication attempts
4. Product export success rate
5. Order fetch latency

## Support & Documentation

- **Implementation Guide**: `MYDEAL_INTEGRATION_COMPLETE.md`
- **Quick Reference**: `MYDEAL_QUICK_REFERENCE.md`
- **API Examples**: `MYDEAL_API_EXAMPLES.md`
- **Summary**: `MYDEAL_INTEGRATION_SUMMARY.md`

## Success Criteria

Migration is successful when:
- ✅ Backend starts without errors
- ✅ MyDeal endpoints are accessible
- ✅ Connection test works
- ✅ Credentials can be saved
- ✅ Products can be exported
- ✅ Orders can be fetched
- ✅ Integration logs are created
- ✅ No TypeScript compilation errors

## Post-Migration Tasks

1. Update frontend to include MyDeal option
2. Add MyDeal logo to integration selection
3. Create user documentation
4. Train support team
5. Set up monitoring alerts
6. Schedule regular integration tests

---

**Migration Version**: 1.0.0
**Date**: December 30, 2025
**Status**: Ready for Deployment
