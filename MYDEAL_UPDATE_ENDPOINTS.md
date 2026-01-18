# MyDeal Update Endpoints Implementation

## Overview

Two new API endpoints have been added for updating MyDeal products:

1. **POST /integration/mydeal/products/quantityprice** - Update price and quantity
2. **POST /integration/mydeal/products/listingstatus** - Update listing status

## Endpoint Details

### 1. Update Product Price and Quantity

**Endpoint:** `POST /integration/mydeal/products/quantityprice`

**Purpose:** Update price and quantity of existing products based on their availability.

**Request Headers:**
- `Authorization: Bearer <JWT_TOKEN>`
- Standard authentication headers (managed by guards)

**Request Body:**
```json
{
  "products": [
    {
      "ExternalProductID": "SKU123",
      "ProductSKU": "SKU123",
      "BuyableProducts": [
        {
          "ExternalBuyableProductID": "VAR001",
          "SKU": "VAR001",
          "Price": 99.99,
          "RRP": 149.99,
          "Quantity": 100,
          "ProductUnlimited": false
        }
      ]
    }
  ],
  "connectionId": 1  // Optional, uses default connection if not provided
}
```

**Field Details:**
- `ExternalProductID`: Required - External product identifier
- `ProductSKU`: Required - Product SKU
- `BuyableProducts`: Required - Array of product variants (min: 1)
  - `ExternalBuyableProductID`: Required - External variant identifier
  - `SKU`: Required - Variant SKU
  - `Price`: Optional - Selling price
  - `RRP`: Optional - Recommended retail price
  - `Quantity`: Optional - Stock quantity (ignored if ProductUnlimited=true)
  - `ProductUnlimited`: Optional - If true, product has unlimited stock

**Constraints:**
- Maximum 250 products per request
- All variants must be present in request; missing variants are treated as out-of-stock
- If `ProductUnlimited=true`, Quantity field is ignored

**Response:**
```json
{
  "ResponseStatus": "Complete",
  "ProductGroups": [
    {
      "ExternalProductID": "SKU123",
      "ProductSKU": "SKU123",
      "Success": true,
      "BuyableProductsProcessed": 1
    }
  ],
  "Errors": []
}
```

**HTTP Status:** 200

---

### 2. Update Product Listing Status

**Endpoint:** `POST /integration/mydeal/products/listingstatus`

**Purpose:** Discontinue or unpublish products (whole product or specific variants). Cannot relist discontinued products.

**Request Headers:**
- `Authorization: Bearer <JWT_TOKEN>`
- Standard authentication headers (managed by guards)

**Request Body:**
```json
{
  "products": [
    {
      "ExternalProductID": "SKU123",
      "ProductSKU": "SKU123",
      "BuyableProducts": [
        {
          "ExternalBuyableProductID": "VAR001",
          "SKU": "VAR001",
          "ListingStatus": "NotLive"
        }
      ]
    }
  ],
  "connectionId": 1  // Optional, uses default connection if not provided
}
```

**Field Details:**
- `ExternalProductID`: Required - External product identifier
- `ProductSKU`: Required - Product SKU
- `BuyableProducts`: Required - Array of product variants (min: 1)
  - `ExternalBuyableProductID`: Required - External variant identifier
  - `SKU`: Required - Variant SKU
  - `ListingStatus`: Required - Must be "NotLive" (to discontinue) or "Live"

**Constraints:**
- Maximum 100 products per request
- To discontinue entire product, all variants must be included
- Cannot relist discontinued products (use this endpoint only for unpublishing)

**Response:**
```json
{
  "ResponseStatus": "Complete",
  "ProductGroups": [
    {
      "ExternalProductID": "SKU123",
      "ProductSKU": "SKU123",
      "Success": true,
      "BuyableProductsProcessed": 1
    }
  ],
  "Errors": []
}
```

**HTTP Status:** 200

---

## Error Handling

### Batch Count Exceeded Error

If the request exceeds the maximum allowed products:

```json
{
  "ResponseStatus": "Failed",
  "ProductGroups": [],
  "Errors": [
    {
      "ID": "BATCH_COUNT_EXCEEDED",
      "Code": "BatchCountExceeded",
      "Message": "Maximum 250 products allowed per request"
    }
  ]
}
```

### Validation Errors

For invalid requests:

```json
{
  "ResponseStatus": "Failed",
  "ProductGroups": [],
  "Errors": [
    {
      "ID": "SKU123",
      "Code": "InvalidRequest",
      "Message": "ExternalProductID and ProductSKU are required"
    }
  ]
}
```

### Individual Product Errors

When some products fail:

```json
{
  "ResponseStatus": "Failed",
  "ProductGroups": [
    {
      "ExternalProductID": "SKU123",
      "ProductSKU": "SKU123",
      "Success": false,
      "Message": "Product not found"
    }
  ],
  "Errors": [
    {
      "ID": "SKU123",
      "Code": "UpdateFailed",
      "Message": "Product not found"
    }
  ]
}
```

---

## Implementation Details

### Files Modified

1. **DTO Layer** - `src/integration/mydeal/dto/mydeal.dto.ts`
   - Added `BuyableProductUpdateDto`
   - Added `ProductGroupDto`
   - Added `UpdateProductQuantityPriceDto`
   - Added `BuyableProductListingDto`
   - Added `ProductGroupListingDto`
   - Added `UpdateProductListingStatusDto`
   - Added `ProductGroupResponse`
   - Added `ErrorResponse`
   - Added `ActionResponse`

2. **Controller Layer** - `src/integration/mydeal/mydeal.controller.ts`
   - Added `updateProductQuantityPrice()` endpoint with batch validation
   - Added `updateProductListingStatus()` endpoint with batch validation
   - Both protected by JWT, Ownership, and Permissions guards

3. **Service Layer** - `src/integration/mydeal/mydeal.service.ts`
   - Added `updateProductQuantityPrice()` method
   - Added `updateProductListingStatus()` method
   - Both methods handle:
     - Connection with user credentials
     - Field validation
     - MyDeal API calls
     - Async work item tracking
     - Error handling and response formatting

### Security & Permissions

Both endpoints require:
- Valid JWT authentication (`JwtAuthGuard`)
- Resource ownership verification (`OwnershipGuard`)
- Permission: `integration:update` (`PermissionsGuard`)

### Async Processing

Both endpoints support MyDeal's async processing:
- When MyDeal returns `AsyncResponsePending`, a work item is created
- Work items can be tracked via the existing `/integration/mydeal/work-item/:workItemId` endpoint
- Status can be monitored via `/integration/mydeal/work-items` endpoint

---

## Category Bug Fix

### Issue
The system was logging that it's using the default category (135), but actually sending a different category ID (like 2) to MyDeal.

### Root Cause
In `transformProductToMyDeal()`, the matched category ID was correctly set initially, but then got overridden by `product.categoryId` (internal category ID) later in the code.

### Solution
Modified the category handling logic to:
1. Use the matched MyDeal category ID by default
2. Only override if there's an explicit `mydealCategoryId` attribute
3. Preserve the matched category ID otherwise

**Changes in** `src/integration/mydeal/mydeal.service.ts`:
- Line ~906: Category ID is matched and set in payload initialization
- Line ~963-970: Updated category handling to prevent unwanted override

---

## Testing

### Test Update Price and Quantity

```bash
curl -X POST http://localhost:3000/integration/mydeal/products/quantityprice \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "products": [
      {
        "ExternalProductID": "TEST001",
        "ProductSKU": "TEST001",
        "BuyableProducts": [
          {
            "ExternalBuyableProductID": "TEST001-VAR1",
            "SKU": "TEST001-VAR1",
            "Price": 49.99,
            "RRP": 79.99,
            "Quantity": 50,
            "ProductUnlimited": false
          }
        ]
      }
    ]
  }'
```

### Test Update Listing Status

```bash
curl -X POST http://localhost:3000/integration/mydeal/products/listingstatus \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "products": [
      {
        "ExternalProductID": "TEST001",
        "ProductSKU": "TEST001",
        "BuyableProducts": [
          {
            "ExternalBuyableProductID": "TEST001-VAR1",
            "SKU": "TEST001-VAR1",
            "ListingStatus": "NotLive"
          }
        ]
      }
    ]
  }'
```

### Test Batch Limit

Test with 251 products for quantityprice (should fail):
- Should return `BatchCountExceeded` error

Test with 101 products for listingstatus (should fail):
- Should return `BatchCountExceeded` error

---

## Usage Examples

### Scenario 1: Update Price for Multiple Variants

```typescript
const updateRequest = {
  products: [
    {
      ExternalProductID: "SHIRT001",
      ProductSKU: "SHIRT001",
      BuyableProducts: [
        {
          ExternalBuyableProductID: "SHIRT001-S",
          SKU: "SHIRT001-S",
          Price: 29.99,
          RRP: 49.99,
          Quantity: 100
        },
        {
          ExternalBuyableProductID: "SHIRT001-M",
          SKU: "SHIRT001-M",
          Price: 29.99,
          RRP: 49.99,
          Quantity: 150
        },
        {
          ExternalBuyableProductID: "SHIRT001-L",
          SKU: "SHIRT001-L",
          Price: 29.99,
          RRP: 49.99,
          Quantity: 75
        }
      ]
    }
  ]
};
```

### Scenario 2: Mark Product as Out of Stock

```typescript
const updateRequest = {
  products: [
    {
      ExternalProductID: "SHIRT001",
      ProductSKU: "SHIRT001",
      BuyableProducts: [
        {
          ExternalBuyableProductID: "SHIRT001-S",
          SKU: "SHIRT001-S",
          Quantity: 0
        }
      ]
    }
  ]
};
```

### Scenario 3: Discontinue Product

```typescript
const discontinueRequest = {
  products: [
    {
      ExternalProductID: "OLD001",
      ProductSKU: "OLD001",
      BuyableProducts: [
        {
          ExternalBuyableProductID: "OLD001-VAR1",
          SKU: "OLD001-VAR1",
          ListingStatus: "NotLive"
        },
        {
          ExternalBuyableProductID: "OLD001-VAR2",
          SKU: "OLD001-VAR2",
          ListingStatus: "NotLive"
        }
      ]
    }
  ]
};
```

### Scenario 4: Set Unlimited Quantity

```typescript
const updateRequest = {
  products: [
    {
      ExternalProductID: "DIGITAL001",
      ProductSKU: "DIGITAL001",
      BuyableProducts: [
        {
          ExternalBuyableProductID: "DIGITAL001-MAIN",
          SKU: "DIGITAL001-MAIN",
          Price: 9.99,
          ProductUnlimited: true
          // Quantity is ignored when ProductUnlimited is true
        }
      ]
    }
  ]
};
```

---

## Notes

1. **Idempotency**: Both endpoints are idempotent - calling them multiple times with the same data produces the same result.

2. **Missing Variants**: For quantity/price updates, if not all variants are included, missing ones are treated as out-of-stock by MyDeal.

3. **Required Fields Only**: Only the specified required fields are processed. Other fields in the request are ignored.

4. **Connection Management**: If `connectionId` is not provided, the default or first active connection for the user is used.

5. **Work Item Tracking**: For async responses, use the work item endpoints to monitor status:
   - GET `/integration/mydeal/work-item/:workItemId`
   - GET `/integration/mydeal/work-items?status=pending&limit=50`

6. **Category Fix**: The category bug has been fixed to ensure the matched MyDeal category ID (or default 135) is properly sent to MyDeal instead of the internal category ID.

---

## API Response Status Meanings

- **Complete**: Request was processed successfully
- **AsyncResponsePending**: Request accepted but processing asynchronously (check work item status)
- **Failed**: Request failed with errors (see Errors array for details)
