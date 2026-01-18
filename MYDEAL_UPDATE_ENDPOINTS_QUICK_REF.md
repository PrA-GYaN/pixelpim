# MyDeal Update Endpoints - Quick Reference

## Endpoints Summary

| Endpoint | Method | Purpose | Max Batch Size |
|----------|--------|---------|----------------|
| `/integration/mydeal/products/quantityprice` | POST | Update price & quantity | 250 products |
| `/integration/mydeal/products/listingstatus` | POST | Update listing status | 100 products |

## Quick Usage

### Update Price & Quantity

```json
POST /integration/mydeal/products/quantityprice

{
  "products": [{
    "ExternalProductID": "SKU",
    "ProductSKU": "SKU",
    "BuyableProducts": [{
      "ExternalBuyableProductID": "VAR-SKU",
      "SKU": "VAR-SKU",
      "Price": 99.99,
      "RRP": 149.99,
      "Quantity": 100,
      "ProductUnlimited": false
    }]
  }],
  "connectionId": 1
}
```

### Discontinue Product

```json
POST /integration/mydeal/products/listingstatus

{
  "products": [{
    "ExternalProductID": "SKU",
    "ProductSKU": "SKU",
    "BuyableProducts": [{
      "ExternalBuyableProductID": "VAR-SKU",
      "SKU": "VAR-SKU",
      "ListingStatus": "NotLive"
    }]
  }],
  "connectionId": 1
}
```

## Response Format

```json
{
  "ResponseStatus": "Complete|AsyncResponsePending|Failed",
  "ProductGroups": [{
    "ExternalProductID": "SKU",
    "ProductSKU": "SKU",
    "Success": true,
    "BuyableProductsProcessed": 1
  }],
  "Errors": [{
    "ID": "SKU",
    "Code": "ErrorCode",
    "Message": "Error description"
  }]
}
```

## Key Rules

1. **Quantity/Price Endpoint:**
   - Max 250 products per request
   - All variants must be included (missing = out-of-stock)
   - If `ProductUnlimited=true`, ignore `Quantity`

2. **Listing Status Endpoint:**
   - Max 100 products per request
   - To discontinue entire product, include all variants
   - Cannot relist discontinued products

## Authentication

Required headers:
- `Authorization: Bearer <JWT_TOKEN>`

Required permissions:
- `integration:update`

## Bug Fixed

✅ **Category Default Issue**: Fixed bug where matched MyDeal category ID (default 135) was being overridden by internal category ID. Now correctly uses the matched MyDeal category.

## See Also

- [Full Documentation](./MYDEAL_UPDATE_ENDPOINTS.md)
- [MyDeal Integration Guide](./MYDEAL_INTEGRATION_COMPLETE.md)
