# Multi-WooCommerce Integration - Developer Migration Guide

## Overview

This guide helps developers migrate from the single-connection WooCommerce integration to the new multi-store system.

---

## Prerequisites

- Node.js 16+ and npm installed
- PostgreSQL database
- Prisma CLI installed (`npm install -g prisma`)
- Existing PixelPim backend running

---

## Step-by-Step Migration

### Step 1: Update Dependencies

Ensure you have the latest dependencies:

```bash
cd PixelPim_backend
npm install
```

### Step 2: Database Schema Update

#### Option A: Using Prisma Migrate (Recommended for Production)

```bash
# Generate migration
npx prisma migrate dev --name add_multi_woocommerce_support

# Apply migration
npx prisma migrate deploy
```

#### Option B: Using Prisma Push (Development/Testing)

```bash
# Push schema changes directly
npx prisma db push

# Generate Prisma client
npx prisma generate
```

### Step 3: Verify Database Changes

Check that new tables were created:

```bash
# Connect to PostgreSQL
psql -U your_username -d your_database

# List tables
\dt

# You should see:
# - WooCommerceConnection
# - WooCommerceExportMapping
# - WooCommerceImportMapping
# - WooCommerceProductSync
```

### Step 4: Restart Application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

### Step 5: Verify Endpoints

Test that new endpoints are accessible:

```bash
# Health check (should return 200)
curl http://localhost:3000/health

# Test new connection endpoint (should return 401 without auth)
curl http://localhost:3000/integration/woocommerce/connections
```

---

## Migrating Existing Data

### Automated Migration Script

Create a migration script to convert existing credentials:

**File:** `scripts/migrate-woocommerce-connections.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateWooCommerceConnections() {
  console.log('Starting WooCommerce connection migration...');

  // Get all existing WooCommerce credentials
  const existingCredentials = await prisma.userIntegrationCredentials.findMany({
    where: {
      integrationType: 'woocommerce',
      isActive: true,
    },
  });

  console.log(`Found ${existingCredentials.length} existing WooCommerce credentials`);

  for (const cred of existingCredentials) {
    try {
      const credentials = cred.credentials as any;

      // Check if connection already exists
      const existingConnection = await prisma.wooCommerceConnection.findFirst({
        where: {
          userId: cred.userId,
          storeUrl: credentials.apiUrl,
        },
      });

      if (existingConnection) {
        console.log(`Connection already exists for user ${cred.userId}`);
        continue;
      }

      // Create new connection
      const connection = await prisma.wooCommerceConnection.create({
        data: {
          userId: cred.userId,
          storeName: 'Default Store', // User can rename later
          storeUrl: credentials.apiUrl,
          consumerKey: credentials.consumerKey,
          consumerSecret: credentials.consumerSecret,
          webhookSecret: credentials.webhookSecret,
          isDefault: true,
          isActive: true,
        },
      });

      console.log(`✓ Created connection ${connection.id} for user ${cred.userId}`);

      // Create default export mapping
      await prisma.wooCommerceExportMapping.create({
        data: {
          connectionId: connection.id,
          selectedFields: ['name', 'sku', 'description', 'price', 'images', 'status'],
          fieldMappings: {},
          isActive: true,
        },
      });

      console.log(`✓ Created default export mapping for connection ${connection.id}`);

      // Create default import mapping
      await prisma.wooCommerceImportMapping.create({
        data: {
          connectionId: connection.id,
          attributeMappings: {},
          fieldMappings: {},
          isActive: true,
        },
      });

      console.log(`✓ Created default import mapping for connection ${connection.id}`);

    } catch (error) {
      console.error(`✗ Failed to migrate credentials for user ${cred.userId}:`, error);
    }
  }

  console.log('Migration completed!');
  await prisma.$disconnect();
}

// Run migration
migrateWooCommerceConnections()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
```

**Run the migration:**

```bash
# Add script to package.json
# "scripts": {
#   "migrate:woocommerce": "ts-node scripts/migrate-woocommerce-connections.ts"
# }

npm run migrate:woocommerce
```

### Manual Migration (For Individual Users)

If automatic migration isn't feasible, users can manually create connections:

```bash
# 1. Get user's existing credentials
curl -X GET http://localhost:3000/integrations/credentials/status \
  -H "Authorization: Bearer <user_jwt_token>"

# 2. Create connection using those credentials
curl -X POST http://localhost:3000/integration/woocommerce/connections \
  -H "Authorization: Bearer <user_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "storeName": "My Store",
    "storeUrl": "<store_url_from_credentials>",
    "consumerKey": "<key_from_credentials>",
    "consumerSecret": "<secret_from_credentials>",
    "webhookSecret": "<webhook_secret_from_credentials>",
    "isDefault": true
  }'
```

---

## Updating Existing Code

### Before: Single Connection

```typescript
// Old way - using WooCommerceService directly
@Injectable()
export class ProductService {
  constructor(
    private woocommerceService: WooCommerceService,
  ) {}

  async exportToWooCommerce(productIds: number[], userId: number) {
    return this.woocommerceService.exportProducts(productIds, userId);
  }
}
```

### After: Multi-Connection

```typescript
// New way - using WooCommerceMultiStoreService
@Injectable()
export class ProductService {
  constructor(
    private multiStoreService: WooCommerceMultiStoreService,
    private connectionService: WooCommerceConnectionService,
  ) {}

  async exportToWooCommerce(
    productIds: number[],
    userId: number,
    connectionId?: number,
  ) {
    // Use provided connection or default
    if (!connectionId) {
      const defaultConnection = await this.connectionService.getDefaultConnection(userId);
      connectionId = defaultConnection.id;
    }

    return this.multiStoreService.exportProducts(userId, {
      connectionId,
      productIds,
    });
  }

  // New: Export to multiple stores
  async exportToMultipleStores(
    productIds: number[],
    userId: number,
    connectionIds: number[],
  ) {
    const results = [];
    
    for (const connectionId of connectionIds) {
      const result = await this.multiStoreService.exportProducts(userId, {
        connectionId,
        productIds,
      });
      results.push(result);
    }

    return results;
  }
}
```

---

## Backward Compatibility

### Maintaining Old Endpoints

The old WooCommerce endpoints can be updated to use the new system internally:

**File:** `src/integration/woocommerce/woocommerce.service.ts`

```typescript
@Injectable()
export class WooCommerceService extends BaseIntegrationService {
  constructor(
    protected prisma: PrismaService,
    protected configService: ConfigService,
    private connectionService: WooCommerceConnectionService,
    private multiStoreService: WooCommerceMultiStoreService,
  ) {
    super(prisma, configService);
  }

  /**
   * Legacy export method - now uses default connection
   * @deprecated Use WooCommerceMultiStoreService.exportProducts() instead
   */
  async exportProducts(productIds: number[], userId: number) {
    // Get default connection
    const defaultConnection = await this.connectionService.getDefaultConnection(userId);

    // Use new multi-store service
    const result = await this.multiStoreService.exportProducts(userId, {
      connectionId: defaultConnection.id,
      productIds,
    });

    // Transform to old response format
    return {
      syncedCount: result.syncedCount,
      failedCount: result.failedCount,
      results: result.results.map(r => ({
        productId: r.productId,
        status: r.status,
        externalProductId: r.wooProductId?.toString(),
        message: r.message,
      })),
    };
  }
}
```

### Supporting Both Systems

During transition period, support both:

```typescript
@Controller('integration/woocommerce')
export class WooCommerceController {
  constructor(
    private woocommerceService: WooCommerceService, // Legacy
    private multiStoreService: WooCommerceMultiStoreService, // New
    private connectionService: WooCommerceConnectionService,
  ) {}

  /**
   * Legacy endpoint - uses default connection
   * @deprecated Use POST /integration/woocommerce/connections/export
   */
  @Post('export')
  async legacyExport(@Body() dto: LegacyExportDto, @GetUser() user: User) {
    return this.woocommerceService.exportProducts(dto.productIds, user.id);
  }

  /**
   * New endpoint - supports multiple connections
   */
  @Post('connections/export')
  async multiStoreExport(@Body() dto: ExportProductsDto, @GetUser() user: User) {
    return this.multiStoreService.exportProducts(user.id, dto);
  }
}
```

---

## Testing Strategy

### 1. Unit Tests

Create tests for new services:

**File:** `src/integration/woocommerce/woocommerce-connection.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { WooCommerceConnectionService } from './woocommerce-connection.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('WooCommerceConnectionService', () => {
  let service: WooCommerceConnectionService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WooCommerceConnectionService,
        {
          provide: PrismaService,
          useValue: {
            wooCommerceConnection: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              updateMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<WooCommerceConnectionService>(WooCommerceConnectionService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createConnection', () => {
    it('should create a new connection', async () => {
      const dto = {
        storeName: 'Test Store',
        storeUrl: 'https://test.com',
        consumerKey: 'ck_test',
        consumerSecret: 'cs_test',
        isDefault: true,
      };

      const mockConnection = { id: 1, ...dto, userId: 1 };
      jest.spyOn(prisma.wooCommerceConnection, 'create').mockResolvedValue(mockConnection);

      const result = await service.createConnection(1, dto);

      expect(result).toBeDefined();
      expect(result.storeName).toBe('Test Store');
    });

    it('should throw error for duplicate store URL', async () => {
      const dto = {
        storeName: 'Test Store',
        storeUrl: 'https://test.com',
        consumerKey: 'ck_test',
        consumerSecret: 'cs_test',
      };

      jest.spyOn(prisma.wooCommerceConnection, 'findUnique').mockResolvedValue({ id: 1 } as any);

      await expect(service.createConnection(1, dto)).rejects.toThrow();
    });
  });

  // Add more tests...
});
```

### 2. Integration Tests

**File:** `test/woocommerce-multistore.e2e-spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('WooCommerce Multi-Store (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login and get token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password' });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Connection Management', () => {
    it('should create a connection', () => {
      return request(app.getHttpServer())
        .post('/integration/woocommerce/connections')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          storeName: 'Test Store',
          storeUrl: 'https://test.com',
          consumerKey: 'ck_test',
          consumerSecret: 'cs_test',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBeDefined();
          expect(res.body.storeName).toBe('Test Store');
        });
    });

    it('should list connections', () => {
      return request(app.getHttpServer())
        .get('/integration/woocommerce/connections')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  // Add more tests...
});
```

### 3. Manual Testing Checklist

Create a manual test checklist:

**File:** `docs/TESTING_CHECKLIST.md`

```markdown
# Multi-WooCommerce Testing Checklist

## Connection Management
- [ ] Create connection with valid credentials
- [ ] Create connection with invalid credentials (should fail gracefully)
- [ ] Test connection before saving
- [ ] Update connection details
- [ ] Set default connection
- [ ] Delete connection
- [ ] List all connections
- [ ] Get specific connection

## Export Mapping
- [ ] Create export mapping with required fields
- [ ] Create export mapping without name/sku (should fail)
- [ ] Update export mapping
- [ ] Activate/deactivate mapping
- [ ] Delete mapping
- [ ] List mappings

## Import Mapping
- [ ] Create import mapping
- [ ] Update import mapping
- [ ] Activate/deactivate mapping
- [ ] Delete mapping

## Product Operations
- [ ] Export products to default connection
- [ ] Export products to specific connection
- [ ] Export with selective fields
- [ ] Export with partial update
- [ ] Import products from WooCommerce
- [ ] Import with attribute mapping
- [ ] Update single product
- [ ] Delete product from WooCommerce
- [ ] Check sync status

## Multi-Store Scenarios
- [ ] Export same product to multiple stores
- [ ] Import from multiple stores
- [ ] Different field mappings per store
- [ ] Switch default connection

## Error Handling
- [ ] Handle connection timeout
- [ ] Handle invalid credentials
- [ ] Handle WooCommerce API errors
- [ ] Handle network failures
- [ ] Handle rate limiting

## Performance
- [ ] Bulk export (100+ products)
- [ ] Bulk import (100+ products)
- [ ] Concurrent operations
- [ ] Large product catalogs
```

---

## Environment Configuration

### Development

```env
# .env.development
DATABASE_URL="postgresql://user:password@localhost:5432/pixelpim_dev"
LOG_LEVEL=debug

# Legacy credentials (optional, for backward compatibility)
WC_API_URL=https://oldstore.com
WC_CONSUMER_KEY=ck_legacy
WC_CONSUMER_SECRET=cs_legacy
```

### Production

```env
# .env.production
DATABASE_URL="postgresql://user:password@prod-db:5432/pixelpim_prod"
LOG_LEVEL=info

# Remove legacy credentials after migration
```

---

## Rollback Plan

If migration encounters issues:

### Step 1: Database Rollback

```bash
# Revert migration
npx prisma migrate resolve --rolled-back <migration_name>

# Or drop tables manually
psql -U your_username -d your_database

DROP TABLE "WooCommerceProductSync";
DROP TABLE "WooCommerceImportMapping";
DROP TABLE "WooCommerceExportMapping";
DROP TABLE "WooCommerceConnection";
```

### Step 2: Code Rollback

```bash
# Revert code changes
git revert <commit_hash>

# Or checkout previous version
git checkout <previous_tag>
```

### Step 3: Verify Functionality

```bash
# Test old endpoints still work
curl -X POST http://localhost:3000/integration/woocommerce/export \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"productIds": [1, 2, 3]}'
```

---

## Monitoring and Observability

### Add Logging

```typescript
// In services
this.logger.log(`Creating connection for user ${userId}`);
this.logger.error(`Failed to export product ${productId}:`, error);
this.logger.warn(`No active export mapping found for connection ${connectionId}`);
```

### Add Metrics

```typescript
// Track sync operations
metrics.increment('woocommerce.export.success', { connectionId });
metrics.increment('woocommerce.export.failure', { connectionId });
metrics.histogram('woocommerce.export.duration', duration);
```

### Health Checks

```typescript
@Get('health')
async checkHealth() {
  const connections = await this.connectionService.getConnections(userId);
  const activeConnections = connections.filter(c => c.isActive).length;

  return {
    status: 'healthy',
    activeConnections,
    timestamp: new Date().toISOString(),
  };
}
```

---

## Documentation Updates

### 1. Update API Documentation

- Add new endpoints to OpenAPI/Swagger docs
- Update Postman collections
- Update integration guides

### 2. Update User Documentation

- Create user guide for multi-store setup
- Update screenshots and tutorials
- Create video walkthroughs

### 3. Update Developer Documentation

- Update architecture diagrams
- Document new services and their responsibilities
- Update code examples

---

## Common Issues and Solutions

### Issue 1: Migration Fails

**Problem:** Prisma migration fails with constraint errors

**Solution:**
```bash
# Reset database (development only!)
npx prisma migrate reset

# Or manually fix constraints
psql -U user -d database
ALTER TABLE "UserIntegrationCredentials" DROP CONSTRAINT IF EXISTS "unique_constraint_name";
```

### Issue 2: Duplicate Connections

**Problem:** Multiple connections created for same store

**Solution:**
```sql
-- Find duplicates
SELECT "userId", "storeUrl", COUNT(*)
FROM "WooCommerceConnection"
GROUP BY "userId", "storeUrl"
HAVING COUNT(*) > 1;

-- Keep only the latest
DELETE FROM "WooCommerceConnection"
WHERE id NOT IN (
  SELECT MAX(id)
  FROM "WooCommerceConnection"
  GROUP BY "userId", "storeUrl"
);
```

### Issue 3: Export Mapping Validation

**Problem:** Users can't export without name/sku

**Solution:** Update validation messages and documentation to emphasize required fields.

---

## Support and Resources

### Internal Resources

- Full API Guide: `docs/MULTI_WOOCOMMERCE_API_GUIDE.md`
- Quick Start: `MULTI_WOOCOMMERCE_README.md`
- Implementation Summary: `MULTI_WOOCOMMERCE_IMPLEMENTATION_SUMMARY.md`

### External Resources

- [WooCommerce REST API Documentation](https://woocommerce.github.io/woocommerce-rest-api-docs/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [NestJS Documentation](https://docs.nestjs.com/)

### Getting Help

1. Check existing documentation
2. Review error logs
3. Test with Postman/curl
4. Contact development team

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Database migration tested
- [ ] Rollback plan documented
- [ ] Monitoring configured
- [ ] Documentation updated

### Deployment

- [ ] Backup production database
- [ ] Deploy database migration
- [ ] Deploy application code
- [ ] Verify health checks
- [ ] Test critical endpoints
- [ ] Monitor error rates

### Post-Deployment

- [ ] Verify all endpoints accessible
- [ ] Check database performance
- [ ] Monitor error logs
- [ ] Gather user feedback
- [ ] Update status page

---

## Timeline

### Week 1: Migration Preparation
- Database migration script ready
- Testing environment prepared
- Documentation complete

### Week 2: Staging Deployment
- Deploy to staging
- Run automated tests
- Perform manual testing
- Fix any issues

### Week 3: Production Rollout
- Deploy to production (off-peak hours)
- Monitor closely for 24 hours
- Collect user feedback
- Address any issues

### Week 4: Cleanup
- Remove deprecated code (if applicable)
- Update documentation
- Conduct retrospective

---

## Success Criteria

Migration is successful when:

✅ All new tables created  
✅ All endpoints functional  
✅ Existing data migrated  
✅ Tests passing  
✅ Documentation complete  
✅ No regression in existing functionality  
✅ Performance metrics acceptable  
✅ Zero critical bugs

---

**Last Updated:** December 11, 2025  
**Version:** 1.0.0
