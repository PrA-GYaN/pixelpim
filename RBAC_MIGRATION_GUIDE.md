# Migration Guide for Existing PixelPim Installation

## Overview

If you have an existing PixelPim installation with users already in the database, follow this guide to safely migrate to the new RBAC system.

## Pre-Migration Checklist

- [ ] Backup your database
- [ ] Stop your application
- [ ] Note down current user count
- [ ] Ensure you have database access

## Migration Steps

### Step 1: Backup Database

```bash
# PostgreSQL backup
pg_dump -U your_username -d your_database > backup_before_rbac_$(date +%Y%m%d_%H%M%S).sql

# Or use your preferred backup method
```

### Step 2: Generate Migration

```bash
cd PixelPim_backend
npx prisma migrate dev --name add-rbac-system
```

This will create a migration file in `prisma/migrations/`.

### Step 3: Review Migration File

Open the generated migration file and verify it includes:
- CREATE TYPE "Role" enum
- ALTER TABLE "User" ADD COLUMN "role"
- ALTER TABLE "User" ADD COLUMN "ownerId"
- CREATE TABLE "UserPermission"

### Step 4: Apply Custom Migration SQL

After running the migration, you need to set roles for existing users.

**Option A: Set all existing users as OWNER (recommended)**

```sql
-- Set all existing users to OWNER role
UPDATE "User" 
SET role = 'OWNER' 
WHERE role IS NULL;

-- Verify the update
SELECT id, email, role, "ownerId" FROM "User";
```

**Option B: Manually assign roles**

```sql
-- Example: Set specific users as OWNER
UPDATE "User" 
SET role = 'OWNER' 
WHERE email IN ('user1@example.com', 'user2@example.com');

-- Set remaining users as STAFF with an owner
UPDATE "User" 
SET role = 'STAFF', "ownerId" = <owner_user_id>
WHERE role IS NULL;
```

### Step 5: Create Admin User via Seed

```bash
# Set admin credentials in .env
echo "ADMIN_EMAIL=admin@pixelpim.com" >> .env
echo "ADMIN_PASSWORD=YourSecurePassword123!" >> .env

# Run seed
npx prisma db seed
```

### Step 6: Regenerate Prisma Client

```bash
npx prisma generate
```

### Step 7: Restart Application

```bash
npm run start:dev
```

## Post-Migration Verification

### 1. Check User Roles

```sql
SELECT 
  id, 
  email, 
  role, 
  "ownerId",
  "createdAt"
FROM "User"
ORDER BY role, id;
```

Expected output:
- 1 ADMIN user (from seed)
- Multiple OWNER users (existing users)
- Possibly STAFF users if manually assigned

### 2. Test Admin Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@pixelpim.com",
    "password": "YourSecurePassword123!"
  }'
```

Should return JWT token with `"role": "ADMIN"`.

### 3. Test Existing User Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "existing.user@example.com",
    "password": "their_existing_password"
  }'
```

Should return JWT token with `"role": "OWNER"`.

### 4. Verify JWT Payload

Decode the JWT token at https://jwt.io and verify it contains:

```json
{
  "sub": <user_id>,
  "email": "user@example.com",
  "role": "OWNER",
  "ownerId": null,
  "iat": <timestamp>,
  "exp": <timestamp>
}
```

### 5. Test Existing Functionality

Test that your existing features still work:
- Product creation
- Asset upload
- Category management
- Integration exports

All existing users (now OWNER role) should have full access.

## Rollback Procedure (If Needed)

If something goes wrong, you can rollback:

### Option 1: Prisma Migrate Rollback (if migration not deployed)

```bash
npx prisma migrate reset
# Restore from backup
psql -U your_username -d your_database < backup_file.sql
```

### Option 2: Manual Rollback (if already deployed)

```sql
-- Drop new table
DROP TABLE IF EXISTS "UserPermission";

-- Remove new columns
ALTER TABLE "User" DROP COLUMN IF EXISTS "ownerId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "role";

-- Drop enum
DROP TYPE IF EXISTS "Role";
```

Then regenerate Prisma client:

```bash
npx prisma generate
```

## Common Migration Scenarios

### Scenario 1: Small Team (< 10 users)

**Approach:** Set all as OWNER

```sql
UPDATE "User" SET role = 'OWNER' WHERE role IS NULL;
```

**Benefits:**
- Everyone keeps full access
- No disruption to workflow
- Can add STAFF members later

### Scenario 2: Large Organization

**Approach:** Identify business owners and staff

1. Create a list of owner emails
2. Set owners:
```sql
UPDATE "User" 
SET role = 'OWNER' 
WHERE email IN ('owner1@company.com', 'owner2@company.com');
```

3. Assign staff to owners:
```sql
UPDATE "User" u
SET role = 'STAFF', "ownerId" = (
  SELECT id FROM "User" WHERE email = 'their_owner@company.com'
)
WHERE u.email = 'staff_member@company.com';
```

4. Assign initial permissions to staff (run after migration):
```sql
-- Grant basic read permissions to all staff
INSERT INTO "UserPermission" ("userId", resource, action, granted)
SELECT id, 'products', 'read', true
FROM "User"
WHERE role = 'STAFF';

INSERT INTO "UserPermission" ("userId", resource, action, granted)
SELECT id, 'assets', 'read', true
FROM "User"
WHERE role = 'STAFF';
```

### Scenario 3: Multi-Tenant Setup

**Approach:** Each tenant is an OWNER

```sql
-- Set tenant admins as OWNER
UPDATE "User" 
SET role = 'OWNER' 
WHERE email LIKE '%@tenant1.com' AND is_admin = true;

-- Set tenant users as STAFF under their tenant admin
UPDATE "User" u
SET role = 'STAFF', 
    "ownerId" = (
      SELECT id FROM "User" 
      WHERE email LIKE CONCAT('%@', SUBSTRING(u.email FROM '@(.*)$'))
      AND role = 'OWNER'
      LIMIT 1
    )
WHERE email LIKE '%@tenant1.com' AND is_admin = false;
```

## Troubleshooting

### Issue: Migration fails with foreign key error

**Solution:**
Ensure no orphaned records exist:

```sql
-- Check for invalid user references
SELECT COUNT(*) FROM "Product" p
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = p."userId");
```

### Issue: Existing users can't login after migration

**Cause:** Role not set properly

**Solution:**
```sql
-- Check if users have null role
SELECT id, email, role FROM "User" WHERE role IS NULL;

-- Set them as OWNER
UPDATE "User" SET role = 'OWNER' WHERE role IS NULL;
```

### Issue: Admin user already exists error during seed

**Solution:**
The seed script checks for existing admin. If you get this error, an admin already exists. Find it:

```sql
SELECT * FROM "User" WHERE role = 'ADMIN';
```

### Issue: JWT validation fails after migration

**Cause:** Old tokens don't have role/ownerId

**Solution:**
Users need to re-login to get new tokens with role information. Old tokens will fail validation.

**Quick fix:** Clear all active sessions and require re-login.

## Environment Variables

Add these to your `.env` file:

```env
# Admin credentials for seed
ADMIN_EMAIL=admin@pixelpim.com
ADMIN_PASSWORD=YourSecurePassword123!

# JWT secret (ensure this is already set)
JWT_SECRET=your-existing-secret-key

# Database URL (should already be set)
DATABASE_URL=postgresql://user:password@localhost:5432/pixelpim
```

## Performance Considerations

The migration adds:
1. One enum type (minimal impact)
2. Two columns to User table (instant for < 100k users)
3. One new table (UserPermission) - initially empty
4. Two indexes on UserPermission

Expected downtime: < 1 minute for most installations

## Data Integrity Checks

Run these queries after migration:

```sql
-- 1. Check all users have a role
SELECT COUNT(*) as users_without_role 
FROM "User" 
WHERE role IS NULL;
-- Expected: 0

-- 2. Check STAFF have valid owners
SELECT COUNT(*) as invalid_staff 
FROM "User" 
WHERE role = 'STAFF' AND "ownerId" IS NULL;
-- Expected: 0

-- 3. Check owner references are valid
SELECT COUNT(*) as invalid_owner_refs 
FROM "User" u 
WHERE u."ownerId" IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM "User" o WHERE o.id = u."ownerId");
-- Expected: 0

-- 4. Check OWNER/ADMIN don't have owners
SELECT COUNT(*) as owners_with_owner 
FROM "User" 
WHERE role IN ('OWNER', 'ADMIN') AND "ownerId" IS NOT NULL;
-- Expected: 0

-- 5. Verify admin exists
SELECT COUNT(*) as admin_count 
FROM "User" 
WHERE role = 'ADMIN';
-- Expected: 1 (at least)
```

## Maintenance Queries

Useful queries for managing the RBAC system:

```sql
-- View role distribution
SELECT role, COUNT(*) 
FROM "User" 
GROUP BY role;

-- List all owner-staff relationships
SELECT 
  o.email as owner_email,
  s.email as staff_email,
  s.id as staff_id
FROM "User" o
JOIN "User" s ON s."ownerId" = o.id
WHERE o.role = 'OWNER' AND s.role = 'STAFF'
ORDER BY o.email, s.email;

-- View permissions summary
SELECT 
  u.email,
  u.role,
  p.resource,
  p.action,
  p.granted
FROM "User" u
LEFT JOIN "UserPermission" p ON p."userId" = u.id
WHERE u.role = 'STAFF'
ORDER BY u.email, p.resource, p.action;
```

## Success Criteria

Your migration is successful when:

- [x] All users have a role assigned
- [x] No null roles in User table
- [x] Admin user exists and can login
- [x] Existing users can login with new JWT structure
- [x] Existing features work for OWNER users
- [x] No foreign key constraint violations
- [x] Application starts without errors
- [x] All data integrity checks pass

## Need Help?

If you encounter issues:

1. Check application logs
2. Review Prisma migration logs
3. Verify database constraints
4. Refer to RBAC_IMPLEMENTATION_GUIDE.md
5. Check RBAC_QUICK_REFERENCE.md for usage

## Post-Migration Tasks

1. **Update Frontend**
   - Add role-based UI elements
   - Show/hide features based on role
   - Add permission management interface

2. **Update Documentation**
   - Inform users about new roles
   - Provide training on permission management
   - Update API documentation

3. **Security Audit**
   - Review all endpoints
   - Add appropriate guards
   - Test permission boundaries

4. **Monitor**
   - Watch for permission errors
   - Track user feedback
   - Adjust permissions as needed
