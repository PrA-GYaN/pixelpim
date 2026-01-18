# MyDeal API Integration Examples

## Setup Instructions

### 1. Install Dependencies

The integration uses these packages (already in package.json):
- `axios` - HTTP client for API requests
- `@nestjs/common` - NestJS framework
- `@prisma/client` - Database ORM

### 2. Environment Variables (Optional)

While MyDeal uses per-user credentials, you can add default values in `.env`:

```env
# MyDeal API Configuration (Optional - per-user credentials take precedence)
MYDEAL_BASE_URL=https://api-integrations-sandbox.mydeal.com.au
```

## Usage Examples

### Example 1: Configure MyDeal Connection

```typescript
// POST /integration/mydeal/connection

const response = await fetch('http://localhost:3000/integration/mydeal/connection', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  },
  body: JSON.stringify({
    baseApiUrl: 'https://api-integrations-sandbox.mydeal.com.au',
    clientId: 'MyDealApiClient',
    clientSecret: 'your-secret-here',
    sellerId: '12345',
    sellerToken: 'your-seller-token-here'
  })
});

const result = await response.json();
console.log(result);
// {
//   "success": true,
//   "connection": {
//     "id": 1,
//     "integrationType": "mydeal",
//     "isActive": true,
//     "hasCredentials": true,
//     "createdAt": "2025-12-30T...",
//     "updatedAt": "2025-12-30T..."
//   }
// }
```

### Example 2: Test Connection

```typescript
// POST /integration/mydeal/connection/test

const response = await fetch('http://localhost:3000/integration/mydeal/connection/test', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  },
  body: JSON.stringify({
    // Optional: test with new credentials before saving
    baseApiUrl: 'https://api-integrations-sandbox.mydeal.com.au',
    clientId: 'MyDealApiClient',
    clientSecret: 'your-secret-here',
    sellerId: '12345',
    sellerToken: 'your-seller-token-here'
  })
});

const result = await response.json();
console.log(result);
// {
//   "success": true,
//   "message": "MyDeal connection successful",
//   "status": "connected"
// }
```

### Example 3: Export Single Product

```typescript
// POST /integration/mydeal/export

const response = await fetch('http://localhost:3000/integration/mydeal/export', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  },
  body: JSON.stringify({
    productIds: [123]
  })
});

const result = await response.json();
console.log(result);
// {
//   "success": true,
//   "syncedCount": 1,
//   "failedCount": 0,
//   "mydealTotal": 0,
//   "results": [
//     {
//       "productId": 123,
//       "status": "success",
//       "mydealProductId": "SKU-ABC-123",
//       "message": "Product export pending. Work Item ID: https://api.../pending-responses?workItemID=10979"
//     }
//   ]
// }
```

### Example 4: Bulk Export Products

```typescript
// POST /integration/mydeal/export

const productIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const response = await fetch('http://localhost:3000/integration/mydeal/export', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  },
  body: JSON.stringify({
    productIds
  })
});

const result = await response.json();
console.log(result);
// {
//   "success": true,
//   "syncedCount": 9,
//   "failedCount": 1,
//   "mydealTotal": 0,
//   "results": [
//     {
//       "productId": 1,
//       "status": "success",
//       "mydealProductId": "SKU-001",
//       "message": "Product export pending..."
//     },
//     // ... more results
//     {
//       "productId": 5,
//       "status": "error",
//       "message": "Product 5 is missing SKU"
//     }
//   ]
// }
```

### Example 5: Update Product

```typescript
// POST /integration/mydeal/update/:productId

const response = await fetch('http://localhost:3000/integration/mydeal/update/123', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  }
});

const result = await response.json();
console.log(result);
// {
//   "productId": 123,
//   "status": "success",
//   "externalProductId": "SKU-ABC-123",
//   "message": "Product export pending..."
// }
```

### Example 6: Delete/Deactivate Product

```typescript
// DELETE /integration/mydeal/:productId

const response = await fetch('http://localhost:3000/integration/mydeal/123', {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  }
});

const result = await response.json();
console.log(result);
// {
//   "productId": 123,
//   "status": "success",
//   "message": "Product deactivated on MyDeal"
// }
```

### Example 7: Fetch Orders

```typescript
// GET /integration/mydeal/orders?page=1&limit=100&status=ReadytoFulfill

const response = await fetch(
  'http://localhost:3000/integration/mydeal/orders?page=1&limit=100&status=ReadytoFulfill',
  {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer YOUR_JWT_TOKEN'
    }
  }
);

const result = await response.json();
console.log(result);
// {
//   "success": true,
//   "orders": [
//     {
//       "OrderId": 136549247,
//       "PurchaseDate": "2022-06-16T01:12:26Z",
//       "OrderStatus": "ReadytoFulfill",
//       "SubTotalPrice": 421.98,
//       "TotalPrice": 431.98,
//       "TotalShippingPrice": 10,
//       "CustomerEmail": "customer@example.com",
//       "ShippingAddress": {
//         "FirstName": "John",
//         "LastName": "Doe",
//         "Phone": "0412345678",
//         "Address1": "123 Main St",
//         "Suburb": "Sydney",
//         "State": "NSW",
//         "Postcode": "2000",
//         "Country": "AU"
//       },
//       "OrderLines": [...]
//     }
//   ],
//   "count": 1
// }
```

### Example 8: Check Async Work Item Status

```typescript
// GET /integration/mydeal/work-item/:workItemId

const workItemId = '10979';
const response = await fetch(
  `http://localhost:3000/integration/mydeal/work-item/${workItemId}`,
  {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer YOUR_JWT_TOKEN'
    }
  }
);

const result = await response.json();
console.log(result);
// {
//   "ResponseStatus": "Complete",
//   "Data": {
//     "ProductsCreated": 1,
//     "ProductsUpdated": 0,
//     "ProductsFailed": 0
//   }
// }
```

### Example 9: Pull Products from MyDeal

```typescript
// GET /integration/mydeal/products

const response = await fetch('http://localhost:3000/integration/mydeal/products', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  }
});

const result = await response.json();
console.log(result);
// {
//   "success": true,
//   "products": [
//     {
//       "ExternalProductId": "SKU-001",
//       "ProductSKU": "SKU-001",
//       "Title": "Product Name",
//       "Description": "Product description...",
//       "Brand": "Brand Name",
//       "Categories": [{ "CategoryId": 135 }],
//       "Images": [...],
//       "BuyableProducts": [...]
//     }
//   ],
//   "count": 10
// }
```

### Example 10: Get Connection Info

```typescript
// GET /integration/mydeal/connection

const response = await fetch('http://localhost:3000/integration/mydeal/connection', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  }
});

const result = await response.json();
console.log(result);
// {
//   "success": true,
//   "connection": {
//     "id": 1,
//     "integrationType": "mydeal",
//     "isActive": true,
//     "hasCredentials": true,
//     "baseApiUrl": "https://api-integrations-sandbox.mydeal.com.au",
//     "sellerId": "12345",
//     "createdAt": "2025-12-30T...",
//     "updatedAt": "2025-12-30T..."
//   }
// }
```

## TypeScript Service Usage

### Direct Service Usage (in backend)

```typescript
import { MyDealService } from './integration/mydeal';

// Inject in constructor
constructor(private mydealService: MyDealService) {}

// Export products
async exportToMyDeal(productIds: number[], userId: number) {
  const result = await this.mydealService.exportProducts(productIds, userId);
  return result;
}

// Fetch orders
async getMyDealOrders(userId: number) {
  const orders = await this.mydealService.getOrders(userId, {
    page: 1,
    limit: 100,
    status: 'ReadytoFulfill'
  });
  return orders;
}

// Check work item status
async checkStatus(workItemId: string, userId: number) {
  const status = await this.mydealService.checkWorkItemStatus(workItemId, userId);
  return status;
}
```

### Auto-Sync Service Usage

```typescript
import { MyDealAutoSyncService } from './integration/mydeal';

// Inject in constructor
constructor(private autoSyncService: MyDealAutoSyncService) {}

// Enable auto-sync
async enableAutoSync(productId: number, userId: number) {
  await this.autoSyncService.enableAutoSync(productId, userId);
}

// Check if auto-sync is enabled
async checkAutoSync(productId: number, userId: number) {
  const isEnabled = await this.autoSyncService.isAutoSyncEnabled(productId, userId);
  return isEnabled;
}

// Bulk sync
async bulkSync(productIds: number[], userId: number) {
  await this.autoSyncService.bulkSyncProducts(productIds, userId);
}
```

## Error Handling

```typescript
try {
  const response = await fetch('http://localhost:3000/integration/mydeal/export', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_JWT_TOKEN'
    },
    body: JSON.stringify({
      productIds: [123]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('MyDeal export failed:', error);
    
    // Handle specific errors
    if (error.statusCode === 401) {
      console.error('Authentication failed. Check credentials.');
    } else if (error.statusCode === 400) {
      console.error('Bad request:', error.message);
    }
    
    return;
  }

  const result = await response.json();
  
  // Check individual product results
  result.results.forEach(item => {
    if (item.status === 'error') {
      console.error(`Product ${item.productId} failed:`, item.message);
    } else {
      console.log(`Product ${item.productId} exported successfully`);
    }
  });
  
} catch (error) {
  console.error('Network error:', error);
}
```

## Integration with Product Updates

```typescript
// In your product update handler
async updateProduct(productId: number, data: any, userId: number) {
  // Update product in database
  const product = await this.productService.update(productId, data);
  
  // Check if auto-sync is enabled
  const isAutoSyncEnabled = await this.mydealAutoSyncService.isAutoSyncEnabled(
    productId,
    userId
  );
  
  if (isAutoSyncEnabled) {
    // Trigger auto-sync to MyDeal
    await this.mydealAutoSyncService.autoSyncProductUpdate(productId, userId);
  }
  
  return product;
}
```

## Webhook Integration (Future Enhancement)

```typescript
// POST /integration/mydeal/webhook
// This is a placeholder for future webhook support

@Post('webhook')
async handleWebhook(@Body() data: any, @Headers() headers: any) {
  // Validate webhook signature
  const isValid = await this.mydealService.validateWebhookSignature(
    headers,
    data
  );
  
  if (!isValid) {
    throw new UnauthorizedException('Invalid webhook signature');
  }
  
  // Process webhook
  const result = await this.mydealService.handleWebhook(data);
  
  return result;
}
```

## Best Practices

1. **Always handle async operations**: MyDeal API returns pending status for most operations
2. **Batch operations**: Export products in batches of 50-100 for better performance
3. **Error handling**: Always check both HTTP status and individual result status
4. **Credential security**: Never log or expose credentials
5. **Rate limiting**: Be mindful of MyDeal API rate limits
6. **Auto-sync**: Use auto-sync for frequently updated products
7. **Logging**: Check integration logs for debugging

## Troubleshooting

### Common Issues and Solutions

1. **Authentication Failed**
   ```typescript
   // Solution: Test credentials first
   const test = await fetch('/integration/mydeal/connection/test', {
     method: 'POST',
     body: JSON.stringify(credentials)
   });
   ```

2. **Product Export Pending**
   ```typescript
   // Solution: Check work item status after a delay
   setTimeout(async () => {
     const status = await fetch(`/integration/mydeal/work-item/${workItemId}`);
     console.log(await status.json());
   }, 5000);
   ```

3. **Missing SKU Error**
   ```typescript
   // Solution: Ensure product has SKU before exporting
   if (!product.sku) {
     throw new Error('Product must have SKU for MyDeal export');
   }
   ```

## Performance Tips

1. **Parallel Exports**: Export multiple products in one request
2. **Cache Tokens**: Tokens are cached automatically per user
3. **Batch Updates**: Update multiple products together
4. **Async Processing**: Use work item status checking for large operations

## Security Notes

1. All endpoints require JWT authentication
2. Credentials are stored per user
3. RBAC permissions control access
4. Sensitive data is not returned in GET requests
5. Audit trail via IntegrationLog
