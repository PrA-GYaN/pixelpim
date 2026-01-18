# MyDeal Integration for PixelPim

Complete marketplace integration enabling seamless product synchronization between PixelPim and MyDeal Australia.

## 🎯 Overview

This integration allows PixelPim users to:
- Export products to MyDeal marketplace
- Update existing MyDeal listings
- Fetch orders from MyDeal
- Enable automatic product synchronization
- Manage MyDeal credentials securely

## 🚀 Features

### Core Functionality
- ✅ **OAuth 2.0 Authentication** - Secure token-based authentication
- ✅ **Product Export** - Single and bulk product export
- ✅ **Product Update** - Update existing listings
- ✅ **Product Delete** - Deactivate products on MyDeal
- ✅ **Order Management** - Fetch and manage orders
- ✅ **Auto-Sync** - Automatic product updates
- ✅ **Async Operations** - Handle MyDeal's async API responses
- ✅ **Connection Testing** - Validate credentials before use

### Security
- ✅ JWT Authentication required
- ✅ RBAC permission guards
- ✅ Per-user credential storage
- ✅ Ownership guards
- ✅ Secure credential management

### Integration
- ✅ Integration logging and audit trail
- ✅ Error handling and recovery
- ✅ Token automatic refresh
- ✅ Work item status tracking

## 📋 Prerequisites

### MyDeal Account Requirements
You need a MyDeal seller account with API access. Contact MyDeal to obtain:

1. **Client ID** - API client identifier
2. **Client Secret** - API client secret
3. **Seller ID** - Your seller account ID
4. **Seller Token** - Your seller API token
5. **Base API URL** - Sandbox or production endpoint

### System Requirements
- Node.js 16+
- PostgreSQL database
- PixelPim backend installed
- Prisma ORM configured

## 🔧 Installation

### 1. Install Dependencies

All required dependencies are already in `package.json`:
```bash
npm install
```

### 2. No Database Migration Required

The integration uses existing tables:
- `UserIntegrationCredentials`
- `IntegrationLog`

### 3. Build the Project

```bash
npm run build
```

### 4. Start the Backend

```bash
# Development
npm run start:dev

# Production
npm run start:prod
```

## 🎮 Usage

### Step 1: Configure MyDeal Credentials

```http
POST /integration/mydeal/connection
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "baseApiUrl": "https://api-integrations-sandbox.mydeal.com.au",
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "sellerId": "your-seller-id",
  "sellerToken": "your-seller-token"
}
```

### Step 2: Test Connection

```http
POST /integration/mydeal/connection/test
Authorization: Bearer {jwt_token}
```

### Step 3: Export Products

```http
POST /integration/mydeal/export
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "productIds": [1, 2, 3, 4, 5]
}
```

### Step 4: Fetch Orders

```http
GET /integration/mydeal/orders?page=1&limit=100&status=ReadytoFulfill
Authorization: Bearer {jwt_token}
```

## 📚 API Documentation

### Connection Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/integration/mydeal/connection` | Save credentials |
| PUT | `/integration/mydeal/connection` | Update credentials |
| GET | `/integration/mydeal/connection` | Get connection info |
| DELETE | `/integration/mydeal/connection` | Delete credentials |
| POST | `/integration/mydeal/connection/test` | Test connection |

### Product Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/integration/mydeal/export` | Export products |
| POST | `/integration/mydeal/update/:id` | Update product |
| DELETE | `/integration/mydeal/:id` | Delete product |
| GET | `/integration/mydeal/products` | Fetch products |
| POST | `/integration/mydeal/pull-updates` | Pull updates |

### Order Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/integration/mydeal/orders` | Fetch orders |

### Utility Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/integration/mydeal/work-item/:id` | Check async status |

## 🔐 Required Permissions

Users need these RBAC permissions:

- `integration:create` - Create connections
- `integration:read` - Read connection/product/order data
- `integration:update` - Update products
- `integration:export` - Export products
- `integration:import` - Import/pull updates
- `integration:delete` - Delete products

## 📊 Data Flow

### Product Export Flow

```
1. User selects products
2. Backend fetches product data
3. Transforms to MyDeal format
4. Authenticates with OAuth
5. Sends to MyDeal API
6. MyDeal returns AsyncResponsePending
7. Backend logs operation
8. User can check work item status
```

### Auto-Sync Flow

```
1. Product updated in PixelPim
2. Check if auto-sync enabled
3. If yes, trigger MyDeal update
4. Update happens in background
5. Integration log updated
```

## 🗂️ File Structure

```
PixelPim_backend/
├── src/integration/mydeal/
│   ├── dto/
│   │   └── mydeal.dto.ts                # Type definitions
│   ├── mydeal.service.ts                # Main service
│   ├── mydeal.controller.ts             # API endpoints
│   ├── mydeal-auto-sync.service.ts      # Auto-sync
│   ├── mydeal-connection.service.ts     # Credentials
│   ├── mydeal-connection.controller.ts  # Connection API
│   └── index.ts                         # Exports
│
├── MYDEAL_INTEGRATION_COMPLETE.md       # Complete guide
├── MYDEAL_QUICK_REFERENCE.md            # Quick reference
├── MYDEAL_API_EXAMPLES.md               # API examples
├── MYDEAL_MIGRATION_GUIDE.md            # Migration guide
└── MYDEAL_README.md                     # This file
```

## 🧪 Testing

### Test Connection

```bash
curl -X POST http://localhost:3000/integration/mydeal/connection/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{
    "baseApiUrl": "https://api-integrations-sandbox.mydeal.com.au",
    "clientId": "test-client",
    "clientSecret": "test-secret",
    "sellerId": "12345",
    "sellerToken": "test-token"
  }'
```

### Export Products

```bash
curl -X POST http://localhost:3000/integration/mydeal/export \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{
    "productIds": [1, 2, 3]
  }'
```

## 🐛 Troubleshooting

### Authentication Failed
**Problem**: Can't connect to MyDeal API

**Solutions**:
- Verify all credentials are correct
- Check if using correct environment (sandbox vs production)
- Ensure credentials are active in MyDeal portal
- Test credentials with connection test endpoint

### Product Export Fails
**Problem**: Products fail to export

**Solutions**:
- Ensure product has SKU
- Verify product has required fields (name, price)
- Check product has at least one image
- Review error message in response

### Async Operation Pending
**Problem**: Export returns pending status

**Solutions**:
- This is normal for MyDeal API
- Wait 5-10 seconds
- Check work item status endpoint
- Review integration logs

### Missing Credentials
**Problem**: 401 or "credentials not configured"

**Solutions**:
- Save credentials first via connection endpoint
- Verify credentials are saved: GET /integration/mydeal/connection
- Check user has proper permissions
- Ensure JWT token is valid

## 📈 Performance

### Recommendations
- Export products in batches of 50-100
- Use auto-sync for frequently updated products
- Check work item status after 5-10 seconds for large batches
- Monitor integration logs for patterns

### Limitations
- MyDeal API has rate limits (check with MyDeal)
- Async operations may take several seconds
- Large product batches may timeout

## 🔄 Auto-Sync

Auto-sync is automatically enabled when you export a product. It will:
- Detect product updates in PixelPim
- Automatically update on MyDeal
- Log all sync operations
- Handle errors gracefully

### Manage Auto-Sync

```typescript
// Enable
await mydealAutoSyncService.enableAutoSync(productId, userId);

// Disable
await mydealAutoSyncService.disableAutoSync(productId, userId);

// Check status
const enabled = await mydealAutoSyncService.isAutoSyncEnabled(productId, userId);
```

## 📖 Additional Documentation

- **[Complete Implementation Guide](MYDEAL_INTEGRATION_COMPLETE.md)** - Detailed implementation info
- **[Quick Reference](MYDEAL_QUICK_REFERENCE.md)** - Quick start and API reference
- **[API Examples](MYDEAL_API_EXAMPLES.md)** - Complete code examples
- **[Migration Guide](MYDEAL_MIGRATION_GUIDE.md)** - Deployment and migration steps

## 🆚 Comparison with Other Integrations

| Feature | WooCommerce | MyDeal | Amazon |
|---------|-------------|--------|---------|
| Authentication | API Keys | OAuth 2.0 | MWS/SP-API |
| Multi-Store | ✅ | ❌ | ❌ |
| Sync Type | Synchronous | Asynchronous | Both |
| Auto-Sync | ✅ | ✅ | ✅ |
| Order Mgmt | ✅ | ✅ | ✅ |
| Field Mapping | ✅ | Fixed | Fixed |

## 🎁 What's Included

- ✅ Complete TypeScript implementation
- ✅ Full CRUD operations
- ✅ OAuth 2.0 authentication
- ✅ Auto-sync functionality
- ✅ Order management
- ✅ Comprehensive error handling
- ✅ Integration logging
- ✅ Permission guards
- ✅ Four documentation files
- ✅ Code examples
- ✅ Migration guide

## 🚧 Roadmap

### Version 1.1 (Future)
- [ ] Multi-store support
- [ ] Custom field mapping UI
- [ ] Category sync from MyDeal
- [ ] Webhook enhancements
- [ ] Bulk operation optimization

### Version 1.2 (Future)
- [ ] Order fulfillment
- [ ] Inventory real-time sync
- [ ] Advanced error recovery
- [ ] Performance monitoring dashboard
- [ ] Credential encryption at rest

## 🤝 Contributing

This integration follows PixelPim coding standards:
- TypeScript strict mode
- NestJS architectural patterns
- Prisma ORM for database
- JWT authentication
- RBAC permissions

## 📝 License

Part of PixelPim project. See main project license.

## 🙋 Support

For issues or questions:

1. Check the troubleshooting section above
2. Review integration logs in database
3. Consult documentation files
4. Contact PixelPim support team

For MyDeal API issues:
- Contact MyDeal support
- Check MyDeal API documentation
- Verify seller account status

## ✨ Credits

Developed following the same architectural patterns as the existing WooCommerce integration.

## 📅 Version History

- **v1.0.0** (2025-12-30) - Initial implementation
  - OAuth 2.0 authentication
  - Product export/update/delete
  - Order fetching
  - Auto-sync
  - Complete documentation

---

**Status**: ✅ Production Ready
**Version**: 1.0.0
**Last Updated**: December 30, 2025
