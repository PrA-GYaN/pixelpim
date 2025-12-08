# WooCommerce Integration - Quick Start Guide

## 🚀 Quick Setup

### 1. Environment Configuration

Add to your `.env` file:

```env
# WooCommerce API Configuration
WC_API_URL=https://your-store.com
WC_CONSUMER_KEY=ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WC_CONSUMER_SECRET=cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WC_WEBHOOK_SECRET=your_webhook_secret_here
```

> **Note:** For local development, you can use `http://localhost:8080` or `http://your-site.local`

### 2. Generate WooCommerce API Keys

1. Log into your WooCommerce admin panel
2. Navigate to: **WooCommerce → Settings → Advanced → REST API**
3. Click **Add key**
4. Configure:
   - Description: `PixelPim Integration`
   - User: Select admin user
   - Permissions: `Read/Write`
5. Click **Generate API key**
6. Copy the **Consumer key** and **Consumer secret** to your `.env`

### 3. Verify Installation

```bash
# Check if the modern SDK is installed
npm list @woocommerce/woocommerce-rest-api

# Expected output:
# @woocommerce/woocommerce-rest-api@1.0.1
```

## 📝 Basic Usage Examples

### Export a Product to WooCommerce

```typescript
// In your service or controller
async exportToWooCommerce(productId: number, userId: number) {
  const result = await this.wooCommerceService.exportProduct(productId, userId);
  
  if (result.status === 'success') {
    console.log(`Product exported! WooCommerce ID: ${result.externalProductId}`);
  } else {
    console.error(`Export failed: ${result.message}`);
  }
}
```

### Pull Products from WooCommerce

```typescript
async syncFromWooCommerce(userId: number) {
  const result = await this.wooCommerceService.pullUpdates(userId);
  
  console.log(`Synced ${result.syncedCount} products`);
  console.log(result.updates); // Array of {productId, action}
}
```

### Update a Product

```typescript
async updateProduct(productId: number, userId: number) {
  const result = await this.wooCommerceService.updateProduct(productId, userId);
  return result;
}
```

### Delete a Product

```typescript
async deleteProduct(productId: number, userId: number) {
  const result = await this.wooCommerceService.deleteProduct(productId, userId);
  return result;
}
```

## 🔌 Direct API Access

### GET Request

```typescript
const response = await this.wooCommerce.get('products', {
  sku: 'ABC123',
  per_page: 10,
  page: 1
});

const products = response.data;
const total = response.headers['x-wp-total'];
```

### POST Request (Create)

```typescript
const productData = {
  name: 'My New Product',
  sku: 'NEW-SKU-001',
  regular_price: '29.99',
  description: 'Product description here',
  status: 'publish'
};

const response = await this.wooCommerce.post('products', productData);
const newProduct = response.data;
```

### PUT Request (Update)

```typescript
const updateData = {
  name: 'Updated Product Name',
  regular_price: '39.99'
};

const response = await this.wooCommerce.put(`products/${productId}`, updateData);
const updatedProduct = response.data;
```

### DELETE Request

```typescript
const response = await this.wooCommerce.delete(`products/${productId}`, {
  force: true // Permanently delete (skip trash)
});
```

## 🎣 Webhook Integration

### Setup in WooCommerce

1. Go to **WooCommerce → Settings → Advanced → Webhooks**
2. Click **Add webhook**
3. Configure:
   - **Name:** `PixelPim Product Sync`
   - **Status:** Active
   - **Topic:** `Product created`, `Product updated`, or `Product deleted`
   - **Delivery URL:** `https://your-api.com/integration/woocommerce/webhook`
   - **Secret:** Use the same value as `WC_WEBHOOK_SECRET` in your `.env`
   - **API Version:** WC REST API v3
4. Save webhook

### Handling Webhooks

```typescript
@Post('webhook')
async handleWebhook(
  @Headers() headers: any,
  @Body() body: any,
) {
  // Validate signature
  const isValid = this.wooCommerceService.validateWebhookSignature(headers, body);
  
  if (!isValid) {
    throw new BadRequestException('Invalid webhook signature');
  }
  
  // Process webhook
  return await this.wooCommerceService.handleWebhook(body);
}
```

## 🛠️ Common Tasks

### Get Product Count

```typescript
const count = await this.wooCommerceService.getWooCommerceProductCount();
console.log(`Total products in WooCommerce: ${count}`);
```

### Batch Export Multiple Products

```typescript
const productIds = [1, 2, 3, 4, 5];
const results = await Promise.all(
  productIds.map(id => this.wooCommerceService.exportProduct(id, userId))
);

const successful = results.filter(r => r.status === 'success').length;
const failed = results.filter(r => r.status === 'error').length;

console.log(`Exported: ${successful}, Failed: ${failed}`);
```

### Search Products by SKU

```typescript
const response = await this.wooCommerce.get('products', { sku: 'SEARCH-SKU' });
const products = response.data;

if (products.length > 0) {
  console.log('Product found:', products[0]);
} else {
  console.log('Product not found');
}
```

### Pagination Example

```typescript
async getAllProducts() {
  let page = 1;
  let allProducts = [];
  let hasMore = true;
  
  while (hasMore) {
    const response = await this.wooCommerce.get('products', {
      per_page: 100,
      page: page
    });
    
    allProducts = [...allProducts, ...response.data];
    
    const totalPages = parseInt(response.headers['x-wp-totalpages']);
    hasMore = page < totalPages;
    page++;
  }
  
  return allProducts;
}
```

## ⚠️ Error Handling

### Comprehensive Error Handling

```typescript
try {
  const response = await this.wooCommerce.get('products', { sku });
  return response.data;
} catch (error) {
  if (error.response) {
    // WooCommerce API responded with error
    this.logger.error('WooCommerce API Error:', {
      status: error.response.status,
      statusText: error.response.statusText,
      message: error.response.data.message,
      code: error.response.data.code
    });
    
    // Handle specific errors
    if (error.response.status === 401) {
      throw new UnauthorizedException('Invalid WooCommerce credentials');
    } else if (error.response.status === 404) {
      throw new NotFoundException('Product not found in WooCommerce');
    } else if (error.response.status === 429) {
      throw new TooManyRequestsException('Rate limit exceeded');
    }
  } else if (error.request) {
    // Request was made but no response
    this.logger.error('Network Error - No response from WooCommerce');
    throw new ServiceUnavailableException('Cannot connect to WooCommerce');
  } else {
    // Something else happened
    this.logger.error('Unexpected Error:', error.message);
    throw new InternalServerErrorException('An unexpected error occurred');
  }
}
```

### Rate Limiting Handler

```typescript
async makeRequestWithRetry(endpoint: string, params: any, maxRetries = 3) {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      return await this.wooCommerce.get(endpoint, params);
    } catch (error) {
      if (error.response?.status === 429 && retries < maxRetries - 1) {
        // Rate limited - wait and retry
        const retryAfter = error.response.headers['retry-after'] || 60;
        this.logger.warn(`Rate limited. Retrying after ${retryAfter}s...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        retries++;
      } else {
        throw error;
      }
    }
  }
}
```

## 🧪 Testing

### Using HTTP Client

See `api-woocommerce-integration.http` for complete test examples.

```http
### Test Connection
POST http://localhost:3000/integration/woocommerce/test
Authorization: Bearer YOUR_JWT_TOKEN

### Export Product
POST http://localhost:3000/integration/woocommerce/export
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "productIds": [1, 2, 3]
}
```

### Unit Test Example

```typescript
describe('WooCommerceService', () => {
  it('should export product successfully', async () => {
    const productId = 1;
    const userId = 1;
    
    const result = await service.exportProduct(productId, userId);
    
    expect(result.status).toBe('success');
    expect(result.externalProductId).toBeDefined();
  });
});
```

## 📊 Monitoring & Logs

### Check Integration Logs

```typescript
// Query integration logs
const logs = await this.prisma.integrationLog.findMany({
  where: {
    integrationType: IntegrationType.WOOCOMMERCE,
    userId: userId,
  },
  orderBy: {
    timestamp: 'desc'
  },
  take: 10
});

logs.forEach(log => {
  console.log(`${log.operation} - ${log.status}: ${log.message}`);
});
```

### Check Recent Errors

```typescript
const errors = await this.prisma.integrationLog.findMany({
  where: {
    integrationType: IntegrationType.WOOCOMMERCE,
    status: IntegrationStatus.ERROR,
  },
  orderBy: {
    timestamp: 'desc'
  },
  take: 5
});
```

## 🔧 Troubleshooting

### Connection Issues

```bash
# Test WooCommerce connection directly
curl -u "ck_xxx:cs_xxx" https://your-store.com/wp-json/wc/v3/products

# Check if API is enabled
curl https://your-store.com/wp-json/wc/v3/
```

### Debug Mode

Enable verbose logging in your service:

```typescript
constructor() {
  this.logger.setLogLevels(['error', 'warn', 'log', 'debug', 'verbose']);
}
```

### Common Issues

| Issue | Solution |
|-------|----------|
| `ECONNREFUSED` | Check WC_API_URL is correct and accessible |
| `401 Unauthorized` | Verify consumer key/secret are correct |
| `404 Not Found` | Check permalink settings in WordPress |
| `SSL Certificate Error` | Use HTTP for local dev or fix certificates |
| `Rate Limit (429)` | Implement retry logic with exponential backoff |

## 📚 Additional Resources

- [Migration Guide](./WOOCOMMERCE_MIGRATION_GUIDE.md) - Detailed migration documentation
- [WooCommerce REST API Docs](https://woocommerce.github.io/woocommerce-rest-api-docs/)
- [SDK Repository](https://github.com/woocommerce/woocommerce-rest-api-js-lib)
- [Integration Tests](../api-woocommerce-integration.http)

## 🆘 Support

For issues or questions:
1. Check the logs: `prisma.integrationLog` table
2. Review error messages in console
3. Test direct API calls with curl
4. Verify environment variables
5. Check WooCommerce admin for API key status
