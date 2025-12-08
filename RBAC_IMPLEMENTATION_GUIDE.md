# Hierarchical Role-Based Access Control (RBAC) System

## Overview

This document provides comprehensive information about implementing a hierarchical role-based access control system in your PixelPim application.

## System Architecture

### Roles Hierarchy

```
ADMIN (Super User)
  ↓ can create
OWNER (Business Owner)
  ↓ can create
STAFF (Employee with limited permissions)
```

### Role Definitions

1. **ADMIN**
   - Created automatically via database seed
   - Can create OWNER users
   - Has full system access
   - No ownerId (null)

2. **OWNER**
   - Created by ADMIN
   - Can do everything a normal user can do
   - Can create STAFF users
   - Can manage STAFF permissions
   - Has full access to all resources
   - No ownerId (null)

3. **STAFF**
   - Created by OWNER
   - Has limited permissions based on assigned permissions
   - Linked to OWNER via ownerId
   - Can only perform actions allowed by their permission set

## Migration Steps

### Step 1: Generate Prisma Migration

```bash
npx prisma migrate dev --name add-rbac-system
```

This will:
- Add `Role` enum (ADMIN, OWNER, STAFF)
- Add `role` field to User model (default: OWNER)
- Add `ownerId` field to User model
- Create `UserPermission` model
- Create owner-staff relationship

### Step 2: Update package.json for Seeding

Add the following to your `package.json`:

```json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

### Step 3: Install Required Dependencies

```bash
npm install ts-node --save-dev
```

### Step 4: Set Environment Variables

Add to your `.env` file:

```env
# Admin credentials for seed
ADMIN_EMAIL=admin@pixelpim.com
ADMIN_PASSWORD=YourSecurePassword123!
```

**⚠️ IMPORTANT:** Change these values to secure credentials before running in production!

### Step 5: Run Database Seed

```bash
npx prisma db seed
```

This will create the default ADMIN user.

### Step 6: Generate Prisma Client

```bash
npx prisma generate
```

### Step 7: Update Existing Users (Optional)

If you have existing users, you may want to set their role to OWNER:

```sql
UPDATE "User" SET role = 'OWNER' WHERE role IS NULL;
```

Or run this migration:

```bash
npx prisma migrate dev --name set-existing-users-as-owners
```

And manually update the migration SQL file to include:

```sql
UPDATE "User" SET role = 'OWNER' WHERE role IS NULL;
```

## API Endpoints

### Admin Endpoints

#### Create Owner User
```
POST /admin/create-owner
Authorization: Bearer <admin-jwt-token>

Body:
{
  "email": "owner@example.com",
  "fullname": "John Doe",
  "password": "SecurePass123!"
}

Response:
{
  "id": 2,
  "email": "owner@example.com",
  "fullname": "John Doe",
  "role": "OWNER",
  "createdAt": "2025-11-24T..."
}
```

### Owner Endpoints

#### Create Staff User
```
POST /owner/create-staff
Authorization: Bearer <owner-jwt-token>

Body:
{
  "email": "staff@example.com",
  "fullname": "Jane Smith",
  "password": "SecurePass123!"
}

Response:
{
  "id": 3,
  "email": "staff@example.com",
  "fullname": "Jane Smith",
  "role": "STAFF",
  "ownerId": 2,
  "createdAt": "2025-11-24T..."
}
```

#### Assign Single Permission to Staff
```
POST /owner/staff/:staffId/permissions
Authorization: Bearer <owner-jwt-token>

Body:
{
  "resource": "products",
  "action": "create",
  "granted": true
}

Response:
{
  "id": 1,
  "userId": 3,
  "resource": "products",
  "action": "create",
  "granted": true,
  "createdAt": "2025-11-24T...",
  "updatedAt": "2025-11-24T..."
}
```

#### Bulk Assign Permissions to Staff
```
POST /owner/staff/:staffId/permissions/bulk
Authorization: Bearer <owner-jwt-token>

Body:
{
  "permissions": [
    { "resource": "products", "action": "create", "granted": true },
    { "resource": "products", "action": "read", "granted": true },
    { "resource": "products", "action": "update", "granted": true },
    { "resource": "assets", "action": "read", "granted": true },
    { "resource": "categories", "action": "read", "granted": true }
  ]
}

Response:
{
  "message": "Permissions assigned successfully",
  "permissions": [...]
}
```

#### Get Staff Permissions
```
GET /owner/staff/:staffId/permissions
Authorization: Bearer <owner-jwt-token>

Response:
[
  {
    "id": 1,
    "userId": 3,
    "resource": "products",
    "action": "create",
    "granted": true,
    "createdAt": "2025-11-24T...",
    "updatedAt": "2025-11-24T..."
  },
  ...
]
```

#### Get My Staff Members
```
GET /owner/my-staff
Authorization: Bearer <owner-jwt-token>

Response:
[
  {
    "id": 3,
    "email": "staff@example.com",
    "fullname": "Jane Smith",
    "role": "STAFF",
    "ownerId": 2,
    "createdAt": "2025-11-24T..."
  },
  ...
]
```

#### Remove Permission from Staff
```
DELETE /owner/staff/:staffId/permissions?resource=products&action=create
Authorization: Bearer <owner-jwt-token>

Response:
{
  "message": "Permission removed successfully"
}
```

## Using Guards and Decorators

### Role-Based Access Control

Use the `@Roles()` decorator with `RolesGuard` to restrict endpoints by role:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { Roles } from './auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductController {
  
  // Only ADMIN and OWNER can access this
  @Get('all')
  @Roles(Role.ADMIN, Role.OWNER)
  getAllProducts() {
    // ...
  }
}
```

### Permission-Based Access Control

Use the `@RequirePermissions()` decorator with `PermissionsGuard` for granular control:

```typescript
import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { RequirePermissions } from './auth/decorators/permissions.decorator';

@Controller('products')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductController {
  
  // ADMIN and OWNER auto-pass, STAFF needs explicit permission
  @Post()
  @RequirePermissions({ resource: 'products', action: 'create' })
  createProduct() {
    // STAFF users must have "create" permission on "products" resource
  }
  
  // Multiple permissions required
  @Post('bulk-import')
  @RequirePermissions(
    { resource: 'products', action: 'create' },
    { resource: 'products', action: 'import' }
  )
  bulkImportProducts() {
    // STAFF users must have both permissions
  }
}
```

### Combined Usage

You can combine both guards for maximum control:

```typescript
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ProductController {
  
  @Post()
  @Roles(Role.OWNER, Role.STAFF)  // Only OWNER and STAFF can attempt
  @RequirePermissions({ resource: 'products', action: 'create' })
  createProduct() {
    // OWNER auto-passes
    // STAFF needs explicit permission
  }
}
```

## Permission Resources and Actions

### Standard Resources
- `products`
- `assets`
- `categories`
- `families`
- `attributes`
- `integrations`
- `webhooks`
- `notifications`

### Standard Actions
- `create`
- `read`
- `update`
- `delete`
- `export`
- `import`

You can define custom resources and actions as needed for your application.

## JWT Token Structure

The JWT token now includes role and ownership information:

```json
{
  "sub": 3,
  "email": "staff@example.com",
  "role": "STAFF",
  "ownerId": 2,
  "iat": 1700000000,
  "exp": 1700086400
}
```

## Database Schema Changes

### User Model
```prisma
model User {
  // ... existing fields
  role            Role             @default(OWNER)
  ownerId         Int?
  
  // Hierarchical relationship
  owner              User?            @relation("OwnerStaff", fields: [ownerId], references: [id])
  staffMembers       User[]           @relation("OwnerStaff")
  
  // Permissions
  permissions        UserPermission[] @relation("StaffPermissions")
}
```

### UserPermission Model
```prisma
model UserPermission {
  id         Int      @id @default(autoincrement())
  userId     Int
  resource   String
  action     String
  granted    Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user       User     @relation("StaffPermissions", fields: [userId], references: [id])

  @@unique([userId, resource, action])
}
```

## Testing the System

### 1. Test Admin Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@pixelpim.com",
    "password": "YourSecurePassword123!"
  }'
```

### 2. Create Owner (as Admin)
```bash
curl -X POST http://localhost:3000/admin/create-owner \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "email": "owner@example.com",
    "fullname": "John Owner",
    "password": "SecurePass123!"
  }'
```

### 3. Login as Owner
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@example.com",
    "password": "SecurePass123!"
  }'
```

### 4. Create Staff (as Owner)
```bash
curl -X POST http://localhost:3000/owner/create-staff \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <owner-token>" \
  -d '{
    "email": "staff@example.com",
    "fullname": "Jane Staff",
    "password": "SecurePass123!"
  }'
```

### 5. Assign Permissions (as Owner)
```bash
curl -X POST http://localhost:3000/owner/staff/3/permissions/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <owner-token>" \
  -d '{
    "permissions": [
      { "resource": "products", "action": "read" },
      { "resource": "products", "action": "update" }
    ]
  }'
```

## Security Considerations

1. **Password Security**: Always use strong passwords and enforce password policies
2. **Token Expiration**: JWT tokens expire in 24 hours by default
3. **Permission Validation**: Permissions are checked on every request
4. **Hierarchical Isolation**: Staff can only be managed by their owner
5. **Default Permissions**: New STAFF users have NO permissions by default

## Troubleshooting

### Issue: Existing users can't log in after migration
**Solution**: Run the SQL to set existing users as OWNER role

### Issue: Permission denied errors
**Solution**: Check that:
- User has correct role
- STAFF users have required permissions assigned
- Guards are properly applied to routes

### Issue: Seed fails
**Solution**: Check that:
- Database connection is working
- No existing ADMIN user exists
- Environment variables are set correctly

## Next Steps

1. Update existing controllers to use role-based guards
2. Implement permission checks for STAFF users
3. Create frontend UI for permission management
4. Add audit logging for permission changes
5. Implement password reset functionality for all user types
