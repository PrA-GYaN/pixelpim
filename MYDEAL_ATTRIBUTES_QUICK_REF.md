# MyDeal Attributes Quick Reference

## Core Product Fields (Direct)
```typescript
{
  sku: string,           // Required
  name: string,          // Required
  categoryId: number,    // Optional
  ImageUrl: string,      // Main image URL (alternative to assets)
  subImages: string[],   // Additional image URLs (alternative to assets)
  assets: Asset[],       // Asset objects with url/imageUrl properties
}
```

## Everything Else Goes in Attributes

### Product Information
| Attribute Name | Type | Default | MyDeal Field |
|---------------|------|---------|--------------|
| `description` | string | '' | Description |
| `specifications` | string | '' | Specifications |
| `brand` | string | '' | Brand |
| `tags` | string/array | '' | Tags |
| `condition` | string | 'new' | Condition |

### Dimensions & Weight
| Attribute Name | Type | Default | MyDeal Field |
|---------------|------|---------|--------------|
| `weight` | number | 1 | Weight |
| `weightUnit` | string | 'kg' | WeightUnit |
| `length` | number | 0.1 | Length |
| `height` | number | 0.1 | Height |
| `width` | number | 0.1 | Width |
| `dimensionUnit` | string | 'm' | DimensionUnit |

### Pricing & Inventory
| Attribute Name | Type | Default | MyDeal Field |
|---------------|------|---------|--------------|
| `price` | number | 0 | BuyableProducts[].Price |
| `compareAtPrice` or `rrp` | number | price | BuyableProducts[].RRP |
| `quantity` | number | 0 | BuyableProducts[].Quantity |
| `isActive` | boolean | true | BuyableProducts[].ListingStatus |

### Identifiers
| Attribute Name | Type | Default | MyDeal Field |
|---------------|------|---------|--------------|
| `gtin` or `barcode` | string | null | GTIN |
| `mpn` or `manufacturerPartNumber` | string | null | MPN |

### Shipping
| Attribute Name | Type | Default | MyDeal Field |
|---------------|------|---------|--------------|
| `requiresShipping` | boolean | true | RequiresShipping |
| `shippingCostStandard` | number | 10 | ShippingCostStandard |
| `shippingCostExpedited` | number | 15 | ShippingCostExpedited |
| `deliveryTime` | string | '5-10 business days' | DeliveryTime |
| `maxDaysForDelivery` | number | 10 | MaxDaysForDelivery |
| `has48HoursDispatch` | boolean | false | Has48HoursDispatch |

### Category
| Attribute Name | Type | Default | MyDeal Field |
|---------------|------|---------|--------------|
| `categoryId` or `mydealCategoryId` | number | 135 | Categories[].CategoryId |

### Custom Attributes
Any other attributes automatically go to `ProductSpecifics` array.

## Example Product

### Input Product (Multiple Image Sources)
```typescript
{
  id: 123,
  sku: "PROD-001",
  name: "Premium Laptop Stand",
  categoryId: 135,
  ImageUrl: "https://cdn.example.com/main.jpg",        // Main image
  subImages: [                                         // Additional images
    "https://cdn.example.com/side.jpg",
    "https://cdn.example.com/back.jpg"
  ],
  assets: [                                             // Alternative asset format
    { asset: { url: "https://cdn.example.com/asset1.jpg" } },
    { asset: { url: "https://cdn.example.com/asset2.jpg" } }
  ],
  attributes: [
    { attribute: { name: "description" }, value: "Ergonomic laptop stand" },
    { attribute: { name: "brand" }, value: "TechCo" },
    { attribute: { name: "price" }, value: "79.99" },
    { attribute: { name: "quantity" }, value: "100" },
    { attribute: { name: "weight" }, value: "1.2" },
    { attribute: { name: "height" }, value: "0.2" },
    { attribute: { name: "color" }, value: "Silver" },      // → ProductSpecifics
    { attribute: { name: "material" }, value: "Aluminum" }  // → ProductSpecifics
  ]
}
```

### Output MyDeal Payload
```json
{
  "ExternalProductId": "PROD-001",
  "ProductSKU": "PROD-001",
  "Title": "Premium Laptop Stand",
  "Description": "Ergonomic laptop stand",
  "Brand": "TechCo",
  "Weight": 1.2,
  "Height": 0.2,
  "Categories": [{ "CategoryId": 135 }],
  "Images": [
    { "Src": "https://cdn.example.com/main.jpg", "Position": 0 },
    { "Src": "https://cdn.example.com/side.jpg", "Position": 1 },
    { "Src": "https://cdn.example.com/back.jpg", "Position": 2 }
  ],
  "BuyableProducts": [{
    "SKU": "PROD-001",
    "Price": 79.99,
    "Quantity": 100,
    "ListingStatus": 1
  }],
  "ProductSpecifics": [
    { "Name": "color", "Value": "Silver" },
    { "Name": "material", "Value": "Aluminum" }
  ]
}
```

## Data Mapping Example

```json
{
  "fieldMappings": {
    "description": "Description",
    "brand": "Brand",
    "price": "Price"
  },
  "selectedFields": [
    "name",
    "sku", 
    "description",
    "brand",
    "price",
    "weight"
  ]
}
```

## API Usage

### Export with Mapping
```bash
POST /api/integration/mydeal/export
{
  "productIds": [1, 2, 3],
  "connectionId": 5  # Optional - enables data mapping
}
```

### Create Export Mapping
```bash
POST /api/integration/mydeal/connections/:connectionId/export-mappings
{
  "fieldMappings": { ... },
  "selectedFields": [ ... ],
  "isActive": true
}
```

## Image Processing

### Relative URLs → Absolute URLs
All relative image URLs are automatically converted using `BASE_URL`:

```typescript
// Relative: "/uploads/image.jpg"
// Absolute: "http://localhost:3000/uploads/image.jpg"
```

### Image Sources
- **Main**: `imageUrl` field
- **Additional**: `subImages` array
- **Fallback**: `assets` array

### Example
```json
{
  "imageUrl": "/uploads/main.jpg",
  "subImages": ["/uploads/sub1.jpg"]
}
```
→
```json
"Images": [
  { "Src": "http://localhost:3000/uploads/main.jpg", "Position": 0 },
  { "Src": "http://localhost:3000/uploads/sub1.jpg", "Position": 1 }
]
```

## Tips

✅ **DO:**
- Store all extra data as attributes
- Use consistent attribute names
- Set up export mappings per connection
- Test with one product first

❌ **DON'T:**
- Store core fields (name, sku) in attributes
- Use case-sensitive attribute names inconsistently
- Forget to set isActive on mappings
- Export without testing mappings

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Field not exporting | Add to `selectedFields` in mapping |
| Wrong field value | Check attribute name (case-sensitive) |
| Missing attributes | Verify product has attributes array |
| No mapping applied | Pass `connectionId` in export request |
| Images not showing | Check BASE_URL environment variable |
| Relative URLs | Ensure BASE_URL is set correctly |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Field not exporting | Add to `selectedFields` in mapping |
| Wrong field value | Check attribute name (case-sensitive) |
| Missing attributes | Verify product has attributes array |
| No mapping applied | Pass `connectionId` in export request |
