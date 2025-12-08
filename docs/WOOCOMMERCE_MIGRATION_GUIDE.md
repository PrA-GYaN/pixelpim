# WooCommerce API Migration Guide

## Overview

This guide documents the migration from the legacy `woocommerce-api` package to the modern official `@woocommerce/woocommerce-rest-api` SDK.

## What Changed

### Package Update

**Old Package:**
```json
"woocommerce-api": "^1.5.0"
```

**New Package:**
```json
"@woocommerce/woocommerce-rest-api": "^1.0.1"
```

### Import Statement

**Old:**
```typescript
import WooCommerceAPI = require('woocommerce-api');
```

**New:**
```typescript
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';
```

### Initialization

**Old (Legacy API):**
```typescript
this.wooCommerce = new WooCommerceAPI({
  url: baseUrl,
  consumerKey: wcKey,
  consumerSecret: wcSecret,
  wpAPI: true,
  version: 'wc/v3',
  verifySsl: false,
});
```

**New (Modern SDK):**
```typescript
this.wooCommerce = new WooCommerceRestApi({
  url: baseUrl,
  consumerKey: wcKey,
  consumerSecret: wcSecret,
  version: 'wc/v3',
  queryStringAuth: baseUrl.startsWith('https://') ? false : true,
});
```

### Key Differences

1. **No `wpAPI` property**: The modern SDK automatically handles the WordPress REST API path
2. **No `verifySsl` property**: SSL verification is handled automatically
3. **`queryStringAuth` instead of callback-based auth**: 
   - Set to `true` for HTTP (local development)
   - Set to `false` for HTTPS (production) - uses OAuth1.0a

### API Call Methods

**Old (Callback-based with Bluebird promises):**
```typescript
// Callback style
this.wooCommerce.get('products', { sku }, (err, data, res) => {
  if (err) {
    reject(err);
    return;
  }
  const products = JSON.parse(res);
  resolve(products);
});

// Or with Bluebird promisify
const products = await this.wooCommerce.getAsync('products', { sku });
```

**New (Native async/await):**
```typescript
// Clean async/await syntax
const response = await this.wooCommerce.get('products', { sku });
const products = response.data;
```

## Environment Variables

Ensure these are set in your `.env` file:

```env
# Required
WC_API_URL=https://your-store.com
WC_CONSUMER_KEY=ck_xxxxxxxxxxxxx
WC_CONSUMER_SECRET=cs_xxxxxxxxxxxxx

# Optional (for webhook signature validation)
WC_WEBHOOK_SECRET=your_webhook_secret
```

### URL Configuration

The modern SDK is more flexible with URL formats:

✅ **Accepted formats:**
- `https://example.com`
- `http://localhost:8080`
- `example.com` (will be converted to `http://example.com` or `https://example.com` based on local detection)

❌ **No longer needed:**
- `/wp-json/wc/v3` suffix (SDK adds this automatically)

## Updated API Methods

### GET Request

```typescript
// Get products with filter
const response = await this.wooCommerce.get('products', { 
  sku: 'ABC123',
  per_page: 100 
});
const products = response.data;

// Response includes headers for pagination
const total = response.headers['x-wp-total'];
const totalPages = response.headers['x-wp-totalpages'];
```

### POST Request

```typescript
// Create a product
const productData = {
  name: 'New Product',
  sku: 'SKU123',
  regular_price: '29.99',
  status: 'publish'
};

const response = await this.wooCommerce.post('products', productData);
const createdProduct = response.data;
```

### PUT Request

```typescript
// Update a product
const updateData = {
  name: 'Updated Product Name',
  regular_price: '39.99'
};

const response = await this.wooCommerce.put(`products/${productId}`, updateData);
const updatedProduct = response.data;
```

### DELETE Request

```typescript
// Delete a product (with force flag to skip trash)
const response = await this.wooCommerce.delete(`products/${productId}`, { 
  force: true 
});
const result = response.data;
```

## Error Handling

The modern SDK provides better error information:

```typescript
try {
  const response = await this.wooCommerce.get('products', { sku });
  return response.data;
} catch (error) {
  // Error includes response data with WooCommerce error details
  if (error.response) {
    this.logger.error('WooCommerce API Error:', {
      status: error.response.status,
      statusText: error.response.statusText,
      data: error.response.data,
    });
  } else {
    this.logger.error('Network Error:', error.message);
  }
  throw error;
}
```

## Benefits of the Modern SDK

1. **Native Promises**: No need for Bluebird or manual promisification
2. **TypeScript Support**: Better type definitions and IDE support
3. **Modern JavaScript**: Uses ES6+ features and async/await
4. **Better Error Handling**: More detailed error responses
5. **Active Maintenance**: Officially maintained by WooCommerce/Automattic
6. **Smaller Bundle Size**: Fewer dependencies
7. **Automatic URL Handling**: No need to manually construct wp-json paths

## Testing the Migration

### 1. Test Connection

```typescript
// In your service or controller
async testConnection(): Promise<any> {
  try {
    const response = await this.wooCommerce.get('products', { per_page: 1 });
    return {
      success: true,
      message: 'Successfully connected to WooCommerce API',
      totalProducts: response.headers['x-wp-total'],
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}
```

### 2. Test CRUD Operations

```http
### Test Product Export
POST http://localhost:3000/integration/woocommerce/export/1
Authorization: Bearer {{token}}

### Test Product Update
PUT http://localhost:3000/integration/woocommerce/update/1
Authorization: Bearer {{token}}

### Test Product Pull
GET http://localhost:3000/integration/woocommerce/pull
Authorization: Bearer {{token}}

### Test Product Delete
DELETE http://localhost:3000/integration/woocommerce/products/1
Authorization: Bearer {{token}}
```

## Troubleshooting

### Issue: SSL Certificate Errors

**Old way:**
```typescript
verifySsl: false  // Not secure!
```

**New way:**
```typescript
// Use HTTPS with proper certificates, or HTTP for local dev
const isLocalDev = baseUrl.includes('localhost') || baseUrl.includes('.local');
const protocol = isLocalDev ? 'http://' : 'https://';
```

### Issue: Authentication Failures

**HTTPS sites:**
```typescript
queryStringAuth: false  // Uses OAuth1.0a (more secure)
```

**HTTP/Local development:**
```typescript
queryStringAuth: true  // Uses query string parameters
```

### Issue: Rate Limiting

The modern SDK respects WooCommerce rate limits. Handle 429 responses:

```typescript
try {
  const response = await this.wooCommerce.get('products');
  return response.data;
} catch (error) {
  if (error.response?.status === 429) {
    // Rate limited - wait and retry
    const retryAfter = error.response.headers['retry-after'] || 60;
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    // Retry the request
  }
  throw error;
}
```

## Performance Improvements

The modern SDK is more efficient:

- **Smaller payload**: No unnecessary data wrapping
- **Better connection pooling**: Leverages axios under the hood
- **Response streaming**: Better for large datasets
- **Automatic retries**: Can be configured for transient failures

## Migration Checklist

- [x] Update package.json dependencies
- [x] Replace import statements
- [x] Update WooCommerce initialization code
- [x] Replace callback-based API calls with async/await
- [x] Remove Bluebird promise wrappers (getAsync, postAsync, etc.)
- [x] Update error handling logic
- [x] Test all CRUD operations
- [x] Verify webhook functionality
- [x] Update environment variable documentation
- [x] Test with both HTTP (local) and HTTPS (production)

## Additional Resources

- [Official WooCommerce REST API Documentation](https://woocommerce.github.io/woocommerce-rest-api-docs/)
- [SDK GitHub Repository](https://github.com/woocommerce/woocommerce-rest-api-js-lib)
- [WooCommerce API Reference](https://woocommerce.com/document/woocommerce-rest-api/)
