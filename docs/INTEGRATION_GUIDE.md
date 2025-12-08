# WooCommerce & Amazon Seller Integration Guide

## Overview

PixelPim backend now supports **bidirectional synchronization** with **WooCommerce** and **Amazon Seller Central** through REST APIs and webhook integrations. All credentials are securely managed through environment variables.

---

## Table of Contents

1. [Environment Configuration](#environment-configuration)
2. [WooCommerce Integration](#woocommerce-integration)
3. [Amazon Seller Integration](#amazon-seller-integration)
4. [API Endpoints](#api-endpoints)
5. [Webhook Configuration](#webhook-configuration)
6. [Integration Logs](#integration-logs)
7. [Troubleshooting](#troubleshooting)

---

## Environment Configuration

### Required Environment Variables

Copy `.env.example` to `.env` and configure the following variables:

#### WooCommerce
```env
WC_API_URL=https://yourstore.com/wp-json/wc/v3
WC_CONSUMER_KEY=ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WC_CONSUMER_SECRET=cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WC_WEBHOOK_SECRET=your_wc_webhook_secret_key
```

#### Amazon Seller Central (SP-API)
```env
AMZ_CLIENT_ID=amzn1.application-oa2-client.xxxxxxxxxxxxxxxxxxxxxxxx
AMZ_CLIENT_SECRET=amzn1.oa2-cs.v1.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AMZ_REFRESH_TOKEN=Atzr|IwEBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AMZ_REGION=us-east-1
AMZ_SELLER_ID=AXXXXXXXXXXXXX
AMZ_WEBHOOK_SECRET=your_amazon_webhook_secret_key
```

### Obtaining Credentials

#### WooCommerce Credentials
1. Log in to your WordPress admin panel
2. Navigate to **WooCommerce → Settings → Advanced → REST API**
3. Click **Add key**
4. Set description (e.g., "PixelPim Integration")
5. Set user as your admin account
6. Set permissions to **Read/Write**
7. Click **Generate API key**
8. Copy the **Consumer key** and **Consumer secret**

#### Amazon SP-API Credentials
1. Register for Amazon Selling Partner API access:
   - Visit [Amazon Developer Console](https://developer.amazon.com/)
   - Register as a developer
2. Create a new SP-API application:
   - Go to **Developer Console → Apps & Services**
   - Create new app
   - Complete OAuth configuration
3. Obtain credentials:
   - **Client ID** and **Client Secret** from app settings
   - **Refresh Token** through OAuth authorization flow
   - **Seller ID** from Seller Central account settings

---

## WooCommerce Integration

### Features

- ✅ **Export products** to WooCommerce
- ✅ **Update existing products** in WooCommerce
- ✅ **Delete products** from WooCommerce
- ✅ **Pull updates** from WooCommerce to PixelPim
- ✅ **Webhook support** for real-time updates
- ✅ **Automatic SKU matching** to prevent duplicates
- ✅ **Image synchronization** (main image, sub-images, assets)
- ✅ **Attribute mapping** to product description
- ✅ **Category synchronization**

### Product Transformation

PixelPim products are transformed to WooCommerce format:

| PixelPim Field | WooCommerce Field | Notes |
|----------------|-------------------|-------|
| `name` | `name` | Product name |
| `sku` | `sku` | Unique identifier |
| `imageUrl` | `images[0]` | Main image |
| `subImages` | `images[1..n]` | Additional images |
| `assets` | `images` | Asset images appended |
| `productLink` | `description` | Included in HTML description |
| `attributes` | `description` | Formatted as HTML list |
| Price attribute | `regular_price` | Extracted from attributes |
| `category` | `categories` | Category name |
| `status` | `status` | `incomplete` → `draft`, else `publish` |

### Webhook Events Supported

| Event | Action |
|-------|--------|
| `product.created` | Creates or updates product in PixelPim |
| `product.updated` | Updates product in PixelPim |
| `product.deleted` | Deletes product from PixelPim |

---

## Amazon Seller Integration

### Features

- ✅ **Export products** to Amazon via Listings API
- ✅ **Update inventory** on Amazon
- ✅ **Update pricing** on Amazon
- ✅ **Delete listings** (set quantity to 0)
- ✅ **Pull inventory** from Amazon FBA
- ✅ **Webhook support** for notifications
- ✅ **Automatic ASIN tracking**
- ✅ **Multi-marketplace support** (US, UK, Canada, etc.)

### Product Transformation

PixelPim products are transformed to Amazon SP-API format:

| PixelPim Field | Amazon Field | Notes |
|----------------|--------------|-------|
| `sku` | `sku` | Seller SKU |
| `name` | `productName` | Product title |
| Price attribute | `price` | Listing price |
| Stock attribute | `quantity` | Available quantity |
| `imageUrl` | `mainImage` | Main product image |
| `attributes` | `description` | Formatted description |

### Webhook Notification Types

| Notification Type | Action |
|-------------------|--------|
| `INVENTORY_UPDATE` | Updates stock quantity in PixelPim |
| `PRICE_CHANGE` | Updates price attribute in PixelPim |
| `LISTINGS_ITEM_STATUS_CHANGE` | Updates product status |

### Amazon Marketplace IDs

| Region | Marketplace ID | Region Code |
|--------|----------------|-------------|
| United States | `ATVPDKIKX0DER` | `us-east-1` |
| United Kingdom | `A1F83G8C2ARO7P` | `eu-west-1` |
| Canada | `A2EUQ1WTGCTBG2` | `us-west-2` |

---

## API Endpoints

All endpoints require JWT authentication via `Authorization: Bearer <token>` header (except webhook endpoints).

### WooCommerce Endpoints

#### Export Products
```http
POST /integration/woocommerce/export
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "productIds": [1, 2, 3]
}
```

**Response:**
```json
{
  "success": true,
  "syncedCount": 3,
  "failedCount": 0,
  "woocommerceTotal": 150,
  "results": [
    {
      "productId": 1,
      "status": "success",
      "wooProductId": 456,
      "message": null
    }
  ]
}
```

#### Update Product
```http
POST /integration/woocommerce/update/:productId
Authorization: Bearer <jwt_token>
```

#### Delete Product
```http
DELETE /integration/woocommerce/:productId
Authorization: Bearer <jwt_token>
```

#### Pull Updates from WooCommerce
```http
GET /integration/woocommerce/pull
Authorization: Bearer <jwt_token>
```

#### Webhook Endpoint (No Auth)
```http
POST /integration/woocommerce/webhook
X-WC-Webhook-Signature: <signature>
Content-Type: application/json

{
  "topic": "product.updated",
  "resource": {
    "id": 456,
    "name": "Product Name",
    "sku": "PROD-001",
    ...
  }
}
```

### Amazon Endpoints

#### Export Products
```http
POST /integration/amazon/export
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "productIds": [1, 2, 3]
}
```

**Response:**
```json
{
  "success": true,
  "syncedCount": 3,
  "failedCount": 0,
  "results": [
    {
      "productId": 1,
      "status": "success",
      "asin": "B08XYZ1234",
      "message": null
    }
  ]
}
```

#### Update Product
```http
POST /integration/amazon/update/:productId
Authorization: Bearer <jwt_token>
```

#### Delete Product
```http
DELETE /integration/amazon/:productId
Authorization: Bearer <jwt_token>
```

#### Pull Updates from Amazon
```http
GET /integration/amazon/pull
Authorization: Bearer <jwt_token>
```

#### Webhook Endpoint (No Auth)
```http
POST /integration/amazon/webhook
X-Amz-SNS-Signature: <signature>
Content-Type: application/json

{
  "notificationType": "INVENTORY_UPDATE",
  "payload": {
    "sku": "PROD-001",
    "quantity": 50
  }
}
```

---

## Webhook Configuration

### WooCommerce Webhooks

1. **Navigate to WooCommerce Webhooks:**
   - WordPress Admin → WooCommerce → Settings → Advanced → Webhooks

2. **Create New Webhook:**
   - Click **Add webhook**
   - Set **Name**: `PixelPim Product Created`
   - Set **Status**: `Active`
   - Set **Topic**: `Product created`
   - Set **Delivery URL**: `https://your-pixelpim-backend.com/integration/woocommerce/webhook`
   - Set **Secret**: Use the value from `WC_WEBHOOK_SECRET` in your `.env`
   - Set **API Version**: `WP REST API Integration v3`
   - Click **Save webhook**

3. **Repeat for Other Events:**
   - `Product updated`
   - `Product deleted`

### Webhook Security

#### WooCommerce
Webhooks are validated using HMAC-SHA256 signature:
```
X-WC-Webhook-Signature: base64(HMAC-SHA256(payload, WC_WEBHOOK_SECRET))
```

#### Amazon
SNS notifications are validated using signature verification:
```
X-Amz-SNS-Signature: base64(signature)
```

### Testing Webhooks

Use tools like:
- **Postman** for manual testing
- **ngrok** for local development tunneling
- **RequestBin** for debugging webhook payloads

Example ngrok setup:
```bash
ngrok http 3000
# Use the HTTPS URL for webhook delivery URL
# https://abcd1234.ngrok.io/integration/woocommerce/webhook
```

---

## Integration Logs

All integration activities are logged in the `IntegrationLog` table:

```typescript
{
  id: number;
  productId: number;
  integrationType: 'woocommerce' | 'amazon';
  operation: 'export' | 'import' | 'update' | 'delete' | 'webhook';
  status: 'success' | 'error' | 'pending';
  message?: string;
  errorDetails?: object;
  externalProductId?: string;  // WooCommerce ID or Amazon ASIN
  externalSku?: string;
  metadata?: object;
  timestamp: Date;
  userId: number;
}
```

### Querying Logs

```typescript
// Get all WooCommerce logs for a user
const logs = await prisma.integrationLog.findMany({
  where: {
    userId: 1,
    integrationType: 'woocommerce',
  },
  orderBy: { timestamp: 'desc' },
});

// Get failed integrations
const failedLogs = await prisma.integrationLog.findMany({
  where: {
    status: 'error',
  },
});
```

---

## Troubleshooting

### Common Issues

#### WooCommerce Connection Failed
- ✅ Verify `WC_API_URL` ends with `/wp-json/wc/v3`
- ✅ Check consumer key and secret are correct
- ✅ Ensure REST API is enabled in WooCommerce
- ✅ Check firewall/security plugin isn't blocking API requests
- ✅ Verify user has admin permissions

#### Amazon SP-API Errors
- ✅ Ensure refresh token hasn't expired
- ✅ Verify client ID and secret are correct
- ✅ Check you have appropriate SP-API permissions
- ✅ Confirm marketplace/region settings
- ✅ Review rate limiting (Amazon has strict quotas)

#### Webhook Not Receiving
- ✅ Verify webhook URL is publicly accessible
- ✅ Check webhook secret matches `.env` value
- ✅ Review webhook delivery logs in platform
- ✅ Test with ngrok for local development
- ✅ Check server firewall isn't blocking incoming requests

#### Product Not Syncing
- ✅ Ensure product has SKU set
- ✅ Check product status is not "incomplete"
- ✅ Verify required attributes are present
- ✅ Review integration logs for error details
- ✅ Check API rate limits

### Debug Mode

Enable detailed logging:
```typescript
// In service constructor
this.logger = new Logger(this.constructor.name);
this.logger.setLogLevels(['log', 'error', 'warn', 'debug', 'verbose']);
```

### API Testing with cURL

**WooCommerce:**
```bash
curl -X POST https://your-api.com/integration/woocommerce/export \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"productIds": [1, 2, 3]}'
```

**Amazon:**
```bash
curl -X POST https://your-api.com/integration/amazon/export \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"productIds": [1, 2, 3]}'
```

---

## Architecture

### Integration Flow Diagram

```
┌──────────────┐
│  PixelPim    │
│   Frontend   │
└──────┬───────┘
       │ JWT Auth
       ▼
┌──────────────────────────────────┐
│   Integration Controller         │
│  (WooCommerce / Amazon)          │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│   Integration Service            │
│  - BaseIntegrationService        │
│  - WooCommerceService            │
│  - AmazonService                 │
└──────┬───────────────────────────┘
       │
       ├────────────┬────────────────┐
       ▼            ▼                ▼
┌──────────┐  ┌──────────┐    ┌──────────┐
│WooCommerce│  │ Amazon   │    │PostgreSQL│
│   API     │  │  SP-API  │    │  Prisma  │
└───────────┘  └──────────┘    └──────────┘
```

### Class Hierarchy

```
BaseIntegrationService (Abstract)
├── WooCommerceService
└── AmazonService

IntegrationFactory
└── Returns appropriate service based on type
```

---

## Support

For issues or questions:
- Check integration logs in database
- Review this documentation
- Enable debug logging
- Test with smaller batches
- Verify credentials and permissions

---

## Future Enhancements

- [ ] Shopify integration
- [ ] eBay integration
- [ ] Bulk webhook processing
- [ ] Retry mechanism for failed syncs
- [ ] Scheduled automatic syncs
- [ ] Real-time sync notifications
- [ ] Multi-marketplace inventory sync
- [ ] Advanced error recovery
