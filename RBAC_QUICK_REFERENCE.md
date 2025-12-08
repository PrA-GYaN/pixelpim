# Quick Reference: RBAC System

## Roles
- `ADMIN` - Super user, creates OWNERs
- `OWNER` - Business owner, creates STAFF, full access
- `STAFF` - Limited access based on permissions

## Quick Start

### 1. Run Migration
```bash
npx prisma migrate dev --name add-rbac-system
```

### 2. Seed Admin User
```bash
npx prisma db seed
```

### 3. Login as Admin
```bash
POST /auth/login
{
  "email": "admin@pixelpim.com",
  "password": "Admin@12345"
}
```

## API Routes

### Admin
- `POST /admin/create-owner` - Create owner user

### Owner
- `POST /owner/create-staff` - Create staff user
- `POST /owner/staff/:id/permissions` - Assign permission
- `POST /owner/staff/:id/permissions/bulk` - Bulk assign
- `GET /owner/staff/:id/permissions` - View permissions
- `GET /owner/my-staff` - List staff members
- `DELETE /owner/staff/:id/permissions` - Remove permission

## Decorators

### Restrict by Role
```typescript
@Roles(Role.ADMIN, Role.OWNER)
```

### Require Permissions
```typescript
@RequirePermissions(
  { resource: 'products', action: 'create' }
)
```

### Apply Guards
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
// or
@UseGuards(JwtAuthGuard, PermissionsGuard)
```

## Common Resources
- products, assets, categories, families, attributes, integrations

## Common Actions
- create, read, update, delete, export, import

## Permission Rules
- ADMIN & OWNER: Full access (no checks needed)
- STAFF: Must have explicit permission
- Permissions are checked per request

## Example: Protect Endpoint
```typescript
@Post()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions({ resource: 'products', action: 'create' })
createProduct() {
  // Only users with permission can access
}
```

## Bulk Permission Assignment Example
```json
{
  "permissions": [
    { "resource": "products", "action": "read" },
    { "resource": "products", "action": "update" },
    { "resource": "assets", "action": "read" }
  ]
}
```
