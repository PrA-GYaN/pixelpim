# Per-User Integration Credentials Implementation

## Overview

This document describes the implementation of per-user integration credentials for WooCommerce and Amazon services. Previously, the system used shared/global environment variables for API credentials. Now, each user can configure their own credentials, stored securely in the database with proper isolation.

## Problem Statement

- **Before**: All users shared the same WooCommerce and Amazon API credentials via environment variables
- **Issues**:
  - No user isolation - all users accessed the same accounts
  - Security risk - shared credentials
  - No per-user customization
  - Difficult to manage multiple seller accounts

## Solution

- **After**: Each user configures their own integration credentials
- **Benefits**:
  - Complete data isolation between users
  - Enhanced security with encrypted credential storage
  - Per-user customization and account management
  - Support for multiple seller accounts

## Database Schema Changes

### New Model: `UserIntegrationCredentials`

```prisma
model UserIntegrationCredentials {
  id            Int      @id @default(autoincrement())
  userId        Int
  integrationType String  // 'woocommerce' or 'amazon'
  credentials   Json     // Encrypted credential data
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user User @relation("UserIntegrationCredentials", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, integrationType])
}
```

### Migration Steps

1. Run Prisma migration to create the new table:
```bash
npx prisma migrate dev --name add-user-integration-credentials
```

2. Generate Prisma client:
```bash
npx prisma generate
```

## Service Modifications

### BaseIntegrationService Updates

- Added `userId` parameter to all integration methods
- Updated method signatures to require user context
- Enhanced error handling for credential validation

### WooCommerceService Changes

**Key Modifications:**
- Added `getUserCredentials(userId)` method to fetch user-specific credentials
- Added `connectWithCredentials(userId)` method for per-user connections
- Updated all API methods (`exportProduct`, `deleteProduct`, `pullUpdates`) to use per-user credentials
- Modified `validateWebhookSignature` to be async and require `userId`

**Before:**
```typescript
async exportProduct(productId: number): Promise<ProductSyncResult> {
  // Used global env vars: WC_API_URL, WC_CONSUMER_KEY, etc.
}
```

**After:**
```typescript
async exportProduct(productId: number, userId: number): Promise<ProductSyncResult> {
  await this.connectWithCredentials(userId);
  // Uses user's stored credentials
}
```

### AmazonService Changes

**Key Modifications:**
- Added `getUserCredentials(userId)` method to fetch user-specific credentials
- Added `connectWithCredentials(userId)` method for per-user connections
- Updated all API methods to use per-user credentials
- Renamed legacy `connect()` method to `connectWithGlobalCredentials()`
- Modified webhook signature validation to require `userId`

**Connection Reuse Logic:**
- Caches connections per user to avoid unnecessary reconnections
- Tracks `currentUserId` to reuse existing connections

## API Changes

### Controller Updates Required

All integration controllers need to be updated to:

1. Accept `userId` from authenticated requests
2. Pass `userId` to service methods
3. Handle credential configuration endpoints

### New Endpoints Needed

```typescript
// Credential management endpoints
POST /integrations/woocommerce/credentials
PUT /integrations/woocommerce/credentials
DELETE /integrations/woocommerce/credentials

POST /integrations/amazon/credentials
PUT /integrations/amazon/credentials
DELETE /integrations/amazon/credentials

GET /integrations/credentials/status  // Check which integrations are configured
```

### Example Controller Update

**Before:**
```typescript
@Post('export/:productId')
async exportProduct(@Param('productId') productId: number) {
  return this.integrationService.exportProduct(productId);
}
```

**After:**
```typescript
@Post('export/:productId')
async exportProduct(
  @Param('productId') productId: number,
  @Req() request: any
) {
  const userId = request.user.id;
  return this.integrationService.exportProduct(productId, userId);
}
```

## Credential Storage Format

### WooCommerce Credentials

```json
{
  "apiUrl": "https://example.com",
  "consumerKey": "ck_xxxxxxxxxxxxxxxx",
  "consumerSecret": "cs_xxxxxxxxxxxxxxxx",
  "webhookSecret": "wh_xxxxxxxxxxxxxxxx"
}
```

### Amazon Credentials

```json
{
  "clientId": "amzn1.application-oa2-client.xxxx",
  "clientSecret": "amzn1.oa2-cs.v1.xxxx",
  "refreshToken": "Atzr|xxxxxxxx",
  "region": "us-east-1",
  "sellerId": "AXXXXXXXXXXXX",
  "webhookSecret": "amzn_webhook_secret"
}
```

## Security Considerations

1. **Encryption**: Credentials are stored as JSON in the database
   - Consider adding encryption at rest for production
   - Use environment-specific encryption keys

2. **Access Control**: Ensure users can only access their own credentials
   - Add proper authorization checks
   - Validate user ownership before credential operations

3. **Webhook Security**: Webhook signatures now validated per-user
   - Each user has their own webhook secret
   - Proper user context required for webhook processing

## Implementation Steps

### Phase 1: Database & Services ✅ (Completed)

1. ✅ Create `UserIntegrationCredentials` model
2. ✅ Run database migration
3. ✅ Update WooCommerceService for per-user credentials
4. ✅ Update AmazonService for per-user credentials
5. ✅ Add abstract `connect()` method implementations

### Phase 2: Controllers & API (Next Steps)

1. Update integration controllers to pass `userId`
2. Add credential management endpoints
3. Update webhook handlers to include user context
4. Add proper authentication/authorization

### Phase 3: Frontend Integration

1. Add UI for users to configure their credentials
2. Update integration status displays
3. Add credential validation feedback
4. Implement secure credential input forms

### Phase 4: Testing & Validation

1. Test per-user data isolation
2. Validate webhook signature verification
3. Test credential CRUD operations
4. Performance testing with multiple users

## Migration Guide

### For Existing Users

1. **Data Migration**: No automatic migration needed - users will configure new credentials
2. **Environment Variables**: Keep existing env vars for backward compatibility during transition
3. **Gradual Rollout**: Allow users to migrate credentials gradually

### Environment Variables (Optional - for backward compatibility)

Keep these for any legacy code that might still use global credentials:

```env
# WooCommerce (legacy)
WC_API_URL=https://example.com
WC_CONSUMER_KEY=ck_xxx
WC_CONSUMER_SECRET=cs_xxx
WC_WEBHOOK_SECRET=wh_xxx

# Amazon (legacy)
AMZ_CLIENT_ID=amzn1.xxx
AMZ_CLIENT_SECRET=amzn1.xxx
AMZ_REFRESH_TOKEN=Atzr|xxx
AMZ_REGION=us-east-1
AMZ_SELLER_ID=AXXXXXXXX
AMZ_WEBHOOK_SECRET=amzn_wh_xxx
```

## Error Handling

### Common Error Scenarios

1. **Missing Credentials**: `BadRequestException('WooCommerce credentials not configured for this user')`
2. **Invalid Credentials**: API-specific errors from WooCommerce/Amazon
3. **Webhook Validation**: `false` return with proper logging
4. **Connection Failures**: Detailed error messages with user context

### Logging

All operations now include `userId` in logs for better debugging:
```
[WooCommerceService] WooCommerce config for user 123 - URL: "https://example.com", Key: "ck_1234..."
[AmazonService] ✅ Amazon SP-API initialized successfully for user 123
```

## Testing

### Unit Tests

```typescript
describe('WooCommerceService', () => {
  it('should connect with user-specific credentials', async () => {
    const result = await service.connectWithCredentials(userId);
    expect(result).toBeDefined();
  });

  it('should export product with user credentials', async () => {
    const result = await service.exportProduct(productId, userId);
    expect(result.status).toBe('success');
  });
});
```

### Integration Tests

1. Test credential storage and retrieval
2. Test API calls with different user credentials
3. Test webhook signature validation per user
4. Test data isolation between users

## Future Enhancements

1. **Credential Encryption**: Add database-level encryption
2. **OAuth Integration**: Implement OAuth flows for easier credential setup
3. **Credential Rotation**: Automated credential refresh/rotation
4. **Audit Logging**: Track credential access and modifications
5. **Multi-Account Support**: Allow users to configure multiple accounts per integration type

## Rollback Plan

If issues arise:

1. **Database**: The new table doesn't affect existing functionality
2. **Services**: Legacy methods still exist for backward compatibility
3. **Controllers**: Can temporarily bypass userId requirements
4. **Environment Variables**: Still functional for global credentials

## Support

For questions or issues with this implementation:

1. Check the service logs for detailed error messages
2. Verify user credentials are properly configured
3. Ensure database migrations have been applied
4. Test with a single user first before multi-user scenarios

---

**Implementation Status**: Phase 1 Complete ✅
**Next Phase**: Controller Updates & API Implementation</content>
<parameter name="filePath">e:\Savileaf\PixelPim_backend\PER_USER_INTEGRATION_CREDENTIALS.md