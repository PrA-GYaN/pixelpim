# Permissions Guard Setup - Complete

## Overview
PermissionsGuard has been successfully added to all resource controllers. Staff users now require explicit permissions to access resources.

## How It Works

### Permission Hierarchy:
1. **ADMIN**: Bypass all permission checks (full access)
2. **OWNER**: Bypass all permission checks (full access to their data)
3. **STAFF**: Must have explicit `UserPermission` entries with `granted=true`

### Permission Format:
```typescript
{
  resource: string,  // e.g., 'products', 'categories', 'assets'
  action: string     // e.g., 'read', 'create', 'update', 'delete'
}
```

## Required Permissions by Resource

### Products
- `products:create` - Create new products
- `products:read` - View products
- `products:update` - Update existing products
- `products:delete` - Delete products

### Categories
- `categories:create` - Create new categories
- `categories:read` - View categories
- `categories:update` - Update existing categories
- `categories:delete` - Delete categories

### Assets
- `assets:create` - Upload new assets
- `assets:read` - View assets
- `assets:update` - Update asset metadata
- `assets:delete` - Delete assets

### Attributes
- `attributes:create` - Create new attributes
- `attributes:read` - View attributes
- `attributes:update` - Update existing attributes
- `attributes:delete` - Delete attributes

### Families
- `families:create` - Create new families
- `families:read` - View families
- `families:update` - Update existing families
- `families:delete` - Delete families

### Attribute Groups
- `attribute-groups:create` - Create new attribute groups
- `attribute-groups:read` - View attribute groups
- `attribute-groups:update` - Update existing attribute groups
- `attribute-groups:delete` - Delete attribute groups

### Asset Groups
- `asset-groups:create` - Create new asset groups
- `asset-groups:read` - View asset groups
- `asset-groups:update` - Update existing asset groups
- `asset-groups:delete` - Delete asset groups

### Integration
- `integration:export` - Export products to marketplace
- `integration:update` - Update products on marketplace
- `integration:delete` - Delete products from marketplace
- `integration:read` - View integration logs and pull updates

### Notifications
- `notifications:read` - View notifications (applied to all notification endpoints)

### Webhooks
- `webhooks:create` - Create new webhooks
- `webhooks:read` - View webhooks
- `webhooks:update` - Update existing webhooks
- `webhooks:delete` - Delete webhooks

### API Keys
- `api-keys:manage` - Generate, view, and regenerate API keys (applied to all api-key endpoints)

## SQL Commands to Grant Permissions

### Example: Grant Staff User Full Product Access
```sql
-- Staff user ID: 5 (ownerId: 4)
INSERT INTO "UserPermission" ("userId", "resource", "action", "granted", "createdAt", "updatedAt")
VALUES
  (5, 'products', 'read', true, NOW(), NOW()),
  (5, 'products', 'create', true, NOW(), NOW()),
  (5, 'products', 'update', true, NOW(), NOW()),
  (5, 'products', 'delete', true, NOW(), NOW());
```

### Example: Grant Read-Only Access to Multiple Resources
```sql
INSERT INTO "UserPermission" ("userId", "resource", "action", "granted", "createdAt", "updatedAt")
VALUES
  (5, 'products', 'read', true, NOW(), NOW()),
  (5, 'categories', 'read', true, NOW(), NOW()),
  (5, 'assets', 'read', true, NOW(), NOW()),
  (5, 'attributes', 'read', true, NOW(), NOW()),
  (5, 'families', 'read', true, NOW(), NOW());
```

### Example: Grant Full Access to All Resources
```sql
INSERT INTO "UserPermission" ("userId", "resource", "action", "granted", "createdAt", "updatedAt")
VALUES
  -- Products
  (5, 'products', 'read', true, NOW(), NOW()),
  (5, 'products', 'create', true, NOW(), NOW()),
  (5, 'products', 'update', true, NOW(), NOW()),
  (5, 'products', 'delete', true, NOW(), NOW()),
  -- Categories
  (5, 'categories', 'read', true, NOW(), NOW()),
  (5, 'categories', 'create', true, NOW(), NOW()),
  (5, 'categories', 'update', true, NOW(), NOW()),
  (5, 'categories', 'delete', true, NOW(), NOW()),
  -- Assets
  (5, 'assets', 'read', true, NOW(), NOW()),
  (5, 'assets', 'create', true, NOW(), NOW()),
  (5, 'assets', 'update', true, NOW(), NOW()),
  (5, 'assets', 'delete', true, NOW(), NOW()),
  -- Attributes
  (5, 'attributes', 'read', true, NOW(), NOW()),
  (5, 'attributes', 'create', true, NOW(), NOW()),
  (5, 'attributes', 'update', true, NOW(), NOW()),
  (5, 'attributes', 'delete', true, NOW(), NOW()),
  -- Families
  (5, 'families', 'read', true, NOW(), NOW()),
  (5, 'families', 'create', true, NOW(), NOW()),
  (5, 'families', 'update', true, NOW(), NOW()),
  (5, 'families', 'delete', true, NOW(), NOW()),
  -- Attribute Groups
  (5, 'attribute-groups', 'read', true, NOW(), NOW()),
  (5, 'attribute-groups', 'create', true, NOW(), NOW()),
  (5, 'attribute-groups', 'update', true, NOW(), NOW()),
  (5, 'attribute-groups', 'delete', true, NOW(), NOW()),
  -- Asset Groups
  (5, 'asset-groups', 'read', true, NOW(), NOW()),
  (5, 'asset-groups', 'create', true, NOW(), NOW()),
  (5, 'asset-groups', 'update', true, NOW(), NOW()),
  (5, 'asset-groups', 'delete', true, NOW(), NOW()),
  -- Integration
  (5, 'integration', 'export', true, NOW(), NOW()),
  (5, 'integration', 'update', true, NOW(), NOW()),
  (5, 'integration', 'delete', true, NOW(), NOW()),
  (5, 'integration', 'read', true, NOW(), NOW()),
  -- Notifications
  (5, 'notifications', 'read', true, NOW(), NOW()),
  -- Webhooks
  (5, 'webhooks', 'read', true, NOW(), NOW()),
  (5, 'webhooks', 'create', true, NOW(), NOW()),
  (5, 'webhooks', 'update', true, NOW(), NOW()),
  (5, 'webhooks', 'delete', true, NOW(), NOW()),
  -- API Keys
  (5, 'api-keys', 'manage', true, NOW(), NOW());
```

## Testing

### Test 1: Staff WITHOUT Permission (Should Fail)
```sql
-- Clear all permissions
DELETE FROM "UserPermission" WHERE "userId" = 5;
```

```bash
# Test GET /products with staff user (ID: 5)
# Expected: 403 Forbidden
# Message: "Access denied: Missing permission 'read' on 'products'"
```

### Test 2: Staff WITH Read Permission (Should Succeed)
```sql
-- Grant only read permission
INSERT INTO "UserPermission" ("userId", "resource", "action", "granted", "createdAt", "updatedAt")
VALUES (5, 'products', 'read', true, NOW(), NOW());
```

```bash
# Test GET /products with staff user (ID: 5)
# Expected: 200 OK
# Returns: Owner's products (userId: 4)
```

### Test 3: Staff Tries to Create Without Permission (Should Fail)
```sql
-- Staff has only read permission (from Test 2)
```

```bash
# Test POST /products with staff user (ID: 5)
# Expected: 403 Forbidden
# Message: "Access denied: Missing permission 'create' on 'products'"
```

### Test 4: Staff WITH Create Permission (Should Succeed)
```sql
-- Grant create permission
INSERT INTO "UserPermission" ("userId", "resource", "action", "granted", "createdAt", "updatedAt")
VALUES (5, 'products', 'create', true, NOW(), NOW());
```

```bash
# Test POST /products with staff user (ID: 5)
# Expected: 201 Created
# Product created with userId: 4 (owner's ID via effectiveUserId)
```

## Quick Setup for Your Test User

For staff user (ID: 5, ownerId: 4) to access products:

```sql
-- Grant read permission only
INSERT INTO "UserPermission" ("userId", "resource", "action", "granted", "createdAt", "updatedAt")
VALUES (5, 'products', 'read', true, NOW(), NOW());
```

Or grant full product access:

```sql
INSERT INTO "UserPermission" ("userId", "resource", "action", "granted", "createdAt", "updatedAt")
VALUES
  (5, 'products', 'read', true, NOW(), NOW()),
  (5, 'products', 'create', true, NOW(), NOW()),
  (5, 'products', 'update', true, NOW(), NOW()),
  (5, 'products', 'delete', true, NOW(), NOW());
```

## Verify Permissions

```sql
-- Check what permissions a staff user has
SELECT * FROM "UserPermission" WHERE "userId" = 5 AND "granted" = true;

-- Check if staff has specific permission
SELECT * FROM "UserPermission" 
WHERE "userId" = 5 
  AND "resource" = 'products' 
  AND "action" = 'read' 
  AND "granted" = true;
```

## Error Responses

### 403 Forbidden - Missing Permission
```json
{
  "statusCode": 403,
  "message": "Access denied: Missing permission 'read' on 'products'",
  "error": "Forbidden"
}
```

### 403 Forbidden - Not Authenticated
```json
{
  "statusCode": 403,
  "message": "Access denied: User not authenticated",
  "error": "Forbidden"
}
```

### 403 Forbidden - Invalid Role
```json
{
  "statusCode": 403,
  "message": "Access denied: Invalid role",
  "error": "Forbidden"
}
```

## Implementation Summary

### Files Modified (14 controllers):
1. ✅ `product.controller.ts` - All CRUD operations protected
2. ✅ `category.controller.ts` - All CRUD operations protected
3. ✅ `asset.controller.ts` - All CRUD operations protected
4. ✅ `attribute.controller.ts` - All CRUD operations protected
5. ✅ `family.controller.ts` - All CRUD operations protected
6. ✅ `attribute-group.controller.ts` - All CRUD operations protected
7. ✅ `asset-group.controller.ts` - All CRUD operations protected
8. ✅ `integration.controller.ts` - Export operations protected
9. ✅ `integration-log.controller.ts` - All log endpoints protected
10. ✅ `woocommerce.controller.ts` - All operations protected
11. ✅ `amazon.controller.ts` - All operations protected
12. ✅ `notification.controller.ts` - All endpoints protected
13. ✅ `webhook.controller.ts` - All CRUD operations protected
14. ✅ `api-key.controller.ts` - All endpoints protected

### Guard Application Pattern:
```typescript
@Controller('resource')
@UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
export class ResourceController {
  
  @Get()
  @RequirePermissions({ resource: 'resource', action: 'read' })
  async findAll() { }
  
  @Post()
  @RequirePermissions({ resource: 'resource', action: 'create' })
  async create() { }
  
  @Patch(':id')
  @RequirePermissions({ resource: 'resource', action: 'update' })
  async update() { }
  
  @Delete(':id')
  @RequirePermissions({ resource: 'resource', action: 'delete' })
  async remove() { }
}
```

## Combined Flow

1. **Request arrives** → JWT Authentication
2. **EffectiveUserInterceptor** → Sets `effectiveUserId` based on role
3. **OwnershipGuard** → Verifies authentication
4. **PermissionsGuard** → Checks if user has required permissions
   - ADMIN/OWNER: Bypass permission check ✅
   - STAFF: Check `UserPermission` table
     - Has permission: Continue ✅
     - Missing permission: 403 Forbidden ❌
5. **Controller** → Executes with `effectiveUserId`
6. **Service** → Queries data filtered by `effectiveUserId`

## Next Steps

1. Run SQL commands to grant permissions to your test staff user
2. Test API endpoints with staff user authentication
3. Verify that requests without permissions return 403
4. Verify that requests with permissions return owner's data

---

**Status**: ✅ Complete and Ready for Testing
**Date**: November 25, 2025
