# MyDeal Integration - Complete Feature Set

## Overview

The MyDeal integration now includes three major features:
1. **Work Items Storage**: Automatically stores and tracks all MyDeal API work items (async responses)
2. **Configuration Import/Export**: Allows backup, transfer, and restoration of MyDeal connection settings
3. **Field Mapping**: Customize data transformation between internal system and MyDeal (similar to WooCommerce)

> **See Also**: [MYDEAL_MAPPING_GUIDE.md](./MYDEAL_MAPPING_GUIDE.md) for detailed mapping documentation

## Work Items Storage

### What Are Work Items?

MyDeal API operations (export, update, delete) often return async responses with a `PendingUri`. These are work items that need to be tracked until completion.

### Database Schema

A new `MyDealWorkItem` table stores all work items:

```prisma
model MyDealWorkItem {
  id                Int      @id @default(autoincrement())
  workItemId        String   @unique
  userId            Int
  productId         Int?
  status            String   @default("pending") // pending, processing, completed, failed
  operation         String   // export, update, delete
  requestPayload    Json?
  responseData      Json?
  errorMessage      String?
  pendingUri        String?
  externalProductId String?
  externalSku       String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  completedAt       DateTime?

  user              User     @relation("UserMyDealWorkItems", fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, productId])
  @@index([userId, status])
  @@index([workItemId])
}
```

### Automatic Tracking

Work items are automatically created and stored when:
- **Exporting products** to MyDeal
- **Updating products** on MyDeal
- **Deleting products** from MyDeal

#### Export Example

```typescript
// When exporting a product
const response = await mydealService.exportProduct(productId, userId);

// Work item is automatically created:
{
  workItemId: response.PendingUri || `work-${Date.now()}-${productId}`,
  userId: userId,
  productId: productId,
  status: 'pending',
  operation: 'export',
  requestPayload: mydealProductData,
  pendingUri: response.PendingUri,
  externalSku: product.sku
}
```

### API Endpoints

#### 1. Get Work Items

Retrieve all work items for the authenticated user with optional filters.

**Endpoint:** `GET /integration/mydeal/work-items`

**Query Parameters:**
- `status` (optional): Filter by status (pending, processing, completed, failed)
- `operation` (optional): Filter by operation (export, update, delete)
- `productId` (optional): Filter by specific product ID
- `limit` (optional): Limit number of results (default: 100)

**Example Request:**
```bash
GET /integration/mydeal/work-items?status=pending&limit=50
Authorization: Bearer <token>
```

**Example Response:**
```json
{
  "success": true,
  "count": 5,
  "items": [
    {
      "id": 123,
      "workItemId": "work-item-abc123",
      "userId": 1,
      "productId": 456,
      "status": "pending",
      "operation": "export",
      "requestPayload": { ... },
      "pendingUri": "/pending-responses/abc123",
      "externalSku": "PROD-001",
      "createdAt": "2026-01-11T10:00:00Z",
      "updatedAt": "2026-01-11T10:00:00Z"
    }
  ]
}
```

#### 2. Check Work Item Status

Check the status of a specific work item and update its database record.

**Endpoint:** `GET /integration/mydeal/work-item/:workItemId`

**Example Request:**
```bash
GET /integration/mydeal/work-item/work-item-abc123
Authorization: Bearer <token>
```

**Example Response:**
```json
{
  "ResponseStatus": "Complete",
  "Data": {
    "ExternalProductId": "PROD-001",
    "ProductSKU": "PROD-001",
    "Title": "Product Name"
  }
}
```

The database work item is automatically updated based on the response status.

### Work Item Lifecycle

```
┌─────────┐
│ Pending │ ──▶ API request sent, work item created
└────┬────┘
     │
     ▼
┌────────────┐
│ Processing │ ──▶ MyDeal is processing the request
└─────┬──────┘
      │
      ├──▶ Success
      │    ┌───────────┐
      └───▶│ Completed │ ──▶ responseData stored
           └───────────┘
      │
      └──▶ Error
           ┌────────┐
           │ Failed │ ──▶ errorMessage stored
           └────────┘
```

## Configuration Import/Export

### Why Configuration Management?

Configuration management allows you to:
- **Backup** MyDeal connection settings
- **Transfer** settings between environments (dev → staging → prod)
- **Share** configurations across team members
- **Restore** settings after accidental deletion
- **Version control** your integration settings

### Database Schema

A new `MyDealConnection` table stores connection configurations:

```prisma
model MyDealConnection {
  id             Int      @id @default(autoincrement())
  userId         Int
  connectionName String
  baseApiUrl     String
  clientId       String
  clientSecret   String
  sellerId       String
  sellerToken    String
  isActive       Boolean  @default(true)
  isDefault      Boolean  @default(false)
  lastSyncedAt   DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user           User                    @relation("UserMyDealConnections", fields: [userId], references: [id], onDelete: Cascade)
  exportMappings MyDealExportMapping[]
  importMappings MyDealImportMapping[]

  @@unique([userId, baseApiUrl])
  @@index([userId, isActive])
  @@index([userId, isDefault])
}

// MyDeal export field mappings
model MyDealExportMapping {
  id              Int              @id @default(autoincrement())
  connectionId    Int
  fieldMappings   Json             // Maps internal fields to MyDeal fields
  selectedFields  String[]         // List of fields to export
  isActive        Boolean          @default(true)
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  connection      MyDealConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)

  @@index([connectionId, isActive])
}

// MyDeal import attribute mappings
model MyDealImportMapping {
  id                Int              @id @default(autoincrement())
  connectionId      Int
  attributeMappings Json             // Maps MyDeal attributes to internal attributes
  fieldMappings     Json             // Maps MyDeal fields to internal fields
  isActive          Boolean          @default(true)
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  connection        MyDealConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)

  @@index([connectionId, isActive])
}
```

### API Endpoints

#### 1. Export Configuration

Export the current MyDeal connection configuration as JSON.

**Endpoint:** `GET /integration/mydeal/connection/export-configuration`

**Permissions Required:** `integration:read`

**Example Request:**
```bash
GET /integration/mydeal/connection/export-configuration
Authorization: Bearer <token>
```

**Example Response:**
```json
{
  "success": true,
  "configuration": {
    "version": "1.0",
    "integrationType": "mydeal",
    "connection": {
      "baseApiUrl": "https://api.mydeal.com.au",
      "clientId": "your-client-id",
      "clientSecret": "your-client-secret",
      "sellerId": "12345",
      "sellerToken": "your-seller-token"
    },
    "metadata": {
      "exportedAt": "2026-01-11T10:00:00Z",
      "exportedBy": 1
    }
  },
  "exportedAt": "2026-01-11T10:00:00Z"
}
```

#### 2. Import Configuration

Import a previously exported MyDeal configuration.

**Endpoint:** `POST /integration/mydeal/connection/import-configuration`

**Permissions Required:** `integration:create`

**Request Body:**
```json
{
  "configuration": {
    "version": "1.0",
    "integrationType": "mydeal",
    "connection": {
      "baseApiUrl": "https://api.mydeal.com.au",
      "clientId": "your-client-id",
      "clientSecret": "your-client-secret",
      "sellerId": "12345",
      "sellerToken": "your-seller-token"
    }
  }
}
```

**Example Request:**
```bash
POST /integration/mydeal/connection/import-configuration
Authorization: Bearer <token>
Content-Type: application/json

{
  "configuration": { ... }
}
```

**Example Response:**
```json
{
  "success": true,
  "message": "MyDeal configuration imported successfully",
  "imported": {
    "baseApiUrl": "https://api.mydeal.com.au",
    "sellerId": "12345"
  }
}
```

### Configuration Validation

Before importing, the system:
1. **Validates** the configuration structure
2. **Tests** the connection with provided credentials
3. **Verifies** the credentials can authenticate with MyDeal API
4. **Rejects** invalid or expired credentials

### Use Cases

#### Use Case 1: Environment Transfer

```bash
# Export from production
curl -X GET https://prod-api.example.com/integration/mydeal/connection/export-configuration \
  -H "Authorization: Bearer PROD_TOKEN" \
  > mydeal-prod-config.json

# Import to staging
curl -X POST https://staging-api.example.com/integration/mydeal/connection/import-configuration \
  -H "Authorization: Bearer STAGING_TOKEN" \
  -H "Content-Type: application/json" \
  -d @mydeal-prod-config.json
```

#### Use Case 2: Backup and Restore

```typescript
// Backup configuration before making changes
const backup = await mydealConnectionService.exportConfiguration(userId);
fs.writeFileSync('mydeal-backup.json', JSON.stringify(backup, null, 2));

// Restore if needed
const backupData = JSON.parse(fs.readFileSync('mydeal-backup.json'));
await mydealConnectionService.importConfiguration(userId, backupData);
```

#### Use Case 3: Team Sharing

```json
// Save team-shared configuration in version control
{
  "version": "1.0",
  "integrationType": "mydeal",
  "connecti`MyDealExportMapping` model
   - Added `MyDealImportMapping` model
   - Added on": {
    "baseApiUrl": "https://api.mydeal.com.au",
    "clientId": "${MYDEAL_CLIENT_ID}",
    "clientSecret": "${MYDEAL_CLIENT_SECRET}",
    "sellerId": "${MYDEAL_SELLER_ID}",
    "sellerToken": "${MYDEAL_SELLER_TOKEN}"
  }
}
```

## Migration

To apply the database changes:

```bash
# Generate Prisma client
npx prisma generate

# Run migration
npx prisma migrate dev --name add_mydeal_workitems_and_config

# Or apply to production
npx prisma migrate deploy
```

## Summary of Changes

### Files Modified

1. **prisma/schema.prisma**
   - Added `MyDealWorkItem` model
   - Added `MyDealConnection` model
   - Added relations to `User` model

2. **src/integration/mydeal/mydeal.service.ts**
   - Added `storeWorkItem()` method
   - Added `getWorkItems()` method
   - Updated `exportProduct()` to store work items
   - Updated `deleteProduct()` to store work items
   - Updated `checkWorkItemStatus()` to update stored items

3. **src/integration/mydeal/mydeal.controller.ts**
   - Added `GET /work-items` endpoint

4. **src/integration/mydeal/mydeal-connection.co
   - Added export mapping endpoints (create, read, update, delete)
   - Added import mapping endpoints (create, read, update, delete)ntroller.ts**
   - Added `GET /export-configuration` endpoint
   - Added `POST /import-configuration` e
   - Added export mapping methods (create, read, update, delete)
   - Added import mapping methods (create, read, update, delete)ndpoint

5. **src/integration/mydeal/mydeal-connection.service.ts**
   - Added `exportConfiguration()` method
   - Added `importConfiguration()` method

6. **src/integration/mydeal/dto/mydeal.dto.ts**
   - Added `MyDealConfiguratio

7. **src/integration/mydeal/dto/mydeal-mapping.dto.ts** (NEW)
   - Added `CreateMyDealExportMappingDto`
   - Added `UpdateMyDealExportMappingDto`

Includes:
- `MyDealWorkItem` table
- `MyDealConnection` table
- `MyDealExportMapping` table
- `MyDealImportMapping` table
- All necessary indexes and foreign keys
   - Added `CreateMyDealImportMappingDto`
   - Added `UpdateMyDealImportMappingDto`
   - Added response DTOs for mappingsnDto`
   - Added `ImportConfigurationDto`
   - Added `ExportConfigurationResponseDto`
   - Added `ImportConfigurationResponseDto`
   - Added `MyDealWorkItemDto`

### Database Migration

Created: `prisma/migrations/20260111_add_mydeal_workitems_and_config/migration.sql`

## Testing

### Test Work Items Storage

```typescript
// 1. Export a product
POST /integration/mydeal/export
{
  "productIds": [123]
}

// 2. Check work items
GET /integration/mydeal/work-items?status=pending

// 3. Check specific work item status
GET /integration/mydeal/work-item/work-item-abc123

// 4. Verify completed items
GET /integration/mydeal/work-items?status=completed
```


// 5. Create export mapping
POST /integration/mydeal/connection/connections/1/export-mappings
{
  "fieldMappings": { "name": "Title", "sku": "ProductSKU" },
  "selectedFields": ["name", "sku"],
  "isActive": true
}

// 6. Get active export mapping
GET /integration/mydeal/connection/connections/1/export-mappings/active
### Test Configuration Management

```typescript
// 1. Export configuration
GET /integration/mydeal/connection/export-configuration
// Save response

// 2. Delete configuration
DELETE /integration/mydeal/connection

// 3. Import configuration
POST /integration/mydeal/connection/import-configuration
{
  "configuration": { /* saved export */ }
}

// 4. Verify connection w
- Advanced field transformation functions in mappings
- Mapping templates for common use cases

## Related Documentation

- [MYDEAL_MAPPING_GUIDE.md](./MYDEAL_MAPPING_GUIDE.md) - Comprehensive guide to field mappings
- [MYDEAL_INTEGRATION_COMPLETE.md](./MYDEAL_INTEGRATION_COMPLETE.md) - Original integration documentation
- [MYDEAL_QUICK_REFERENCE.md](./MYDEAL_QUICK_REFERENCE.md) - Quick reference guideorks
POST /integration/mydeal/connection/test
```

## Security Considerations

1. **Sensitive Data**: Credentials are stored encrypted in the database
2. **Export Safety**: Exported configurations contain sensitive data - handle securely
3. **Import Validation**: All imports are validated and tested before saving
4. **User Isolation**: Work items and configurations are user-specific with proper access controls

## Best Practices

1. **Regular Backups**: Export configurations regularly
2. **Version Control**: Store sanitized configs (without secrets) in version control
3. **Environment Variables**: Use environment variables for secrets in team-shared configs
4. **Work Item Monitoring**: Regularly check work items to ensure operations complete
5. **Error Handling**: Monitor failed work items and investigate causes

## Future Enhancements

Potential future improvements:
- Automatic retry for failed work items
- Webhooks for work item completion
- Configuration versioning
- Multiple MyDeal connections per user
- Bulk work item operations
- Work item notifications
