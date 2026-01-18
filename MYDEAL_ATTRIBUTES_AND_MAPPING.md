# MyDeal Attributes and Data Mapping Guide

## Overview

The MyDeal integration has been enhanced to properly read product attributes and support export/import data mapping. This allows for flexible field mapping between your internal product structure and MyDeal's requirements.

## Product Structure

### Core Fields (Direct on Product)
- `ImageUrl` - Main product image URL (string)
- `subImages` - Additional product image URLs (string array)
- `assets` - Asset objects with nested URL properties (alternative format)
- `categoryId` - Product category
- `name` - Product title
- `sku` - Product SKU

### Attributes (Everything Else)
All other product data is stored in the `attributes` array. The transformation logic will:
1. First check if a field exists directly on the product
2. Then check in the product's attributes
3. Fall back to default values if not found

## Supported Attributes

### Basic Information
- `description` - Product description
- `specifications` - Detailed specifications
- `brand` - Product brand
- `tags` - Product tags (comma-separated or array)
- `condition` - Product condition (default: 'new')

### Dimensions & Weight
- `weight` - Product weight (default: 1)
- `weightUnit` - Weight unit (default: 'kg')
- `length` - Product length (default: 0.1)
- `height` - Product height (default: 0.1)
- `width` - Product width (default: 0.1)
- `dimensionUnit` - Dimension unit (default: 'm')

### Identifiers
- `gtin` - Global Trade Item Number (barcode)
- `barcode` - Alternative barcode field
- `mpn` - Manufacturer Part Number
- `manufacturerPartNumber` - Alternative MPN field

### Pricing & Inventory
- `price` - Product price
- `compareAtPrice` or `rrp` - Recommended retail price
- `quantity` - Stock quantity
- `isActive` - Product active status

### Shipping Information
- `requiresShipping` - Whether shipping is required (default: true)
- `shippingCostStandard` - Standard shipping cost (default: 10)
- `shippingCostExpedited` - Expedited shipping cost (default: 15)
- `deliveryTime` - Delivery time description (default: '5-10 business days')
- `maxDaysForDelivery` - Maximum delivery days (default: 10)
- `has48HoursDispatch` - 48-hour dispatch flag (default: false)

### Category Mapping
- `categoryId` - MyDeal category ID (from product.categoryId)
- `mydealCategoryId` - Alternative attribute for category ID

### Additional Attributes
Any attributes not in the above list will be automatically added to the `ProductSpecifics` array in the MyDeal payload.

## Data Mapping

### Export Mapping

When exporting products to MyDeal, you can configure field mappings that:
1. Map internal field names to MyDeal field names
2. Select which fields to include in the export
3. Transform field values as needed

#### Example Export Mapping
```json
{
  "connectionId": 1,
  "fieldMappings": {
    "description": "Description",
    "brand": "Brand",
    "weight": "Weight",
    "price": "Price"
  },
  "selectedFields": [
    "name",
    "sku",
    "description",
    "brand",
    "price",
    "weight",
    "specifications"
  ],
  "isActive": true
}
```

### Import Mapping

When importing products from MyDeal, you can configure:
1. Attribute mappings - Map MyDeal attributes to internal attributes
2. Field mappings - Map MyDeal fields to internal fields

#### Example Import Mapping
```json
{
  "connectionId": 1,
  "attributeMappings": {
    "Brand": "brand",
    "Specifications": "specifications",
    "GTIN": "gtin"
  },
  "fieldMappings": {
    "Title": "name",
    "Description": "description",
    "ProductSKU": "sku"
  },
  "isActive": true
}
```

## Image Processing

### Relative URLs
All image URLs are automatically converted to absolute URLs using the `BASE_URL` environment variable:

- **Relative URL**: `/uploads/image.jpg`
- **Absolute URL**: `http://localhost:3000/uploads/image.jpg` (based on BASE_URL)

### Image Sources (Priority Order)
1. **Main Image**: `product.imageUrl` → `product.assets[0].url` → `product.assets[0].imageUrl`
2. **Additional Images**: `product.subImages` → `product.assets.slice(1, 10)`

### Example
```typescript
// Input product with relative URLs
{
  imageUrl: "/uploads/main.jpg",
  subImages: ["/uploads/sub1.jpg", "/uploads/sub2.jpg"]
}

// Output with BASE_URL="http://localhost:3000"
{
  Images: [
    { Src: "http://localhost:3000/uploads/main.jpg", Position: 0 },
    { Src: "http://localhost:3000/uploads/sub1.jpg", Position: 1 },
    { Src: "http://localhost:3000/uploads/sub2.jpg", Position: 2 }
  ]
}
```

### Import Products with Mapping

```typescript
// Import with connection-specific mapping
await myDealService.pullUpdates(userId, connectionId);
```

### Create Export Mapping

```http
POST /api/integration/mydeal/connections/:connectionId/export-mappings
Authorization: Bearer <token>

{
  "fieldMappings": {
    "description": "Description",
    "brand": "Brand"
  },
  "selectedFields": ["name", "sku", "description", "brand"],
  "isActive": true
}
```

### Get Active Export Mapping

```http
GET /api/integration/mydeal/connections/:connectionId/export-mappings/active
Authorization: Bearer <token>
```

### Create Import Mapping

```http
POST /api/integration/mydeal/connections/:connectionId/import-mappings
Authorization: Bearer <token>

{
  "attributeMappings": {
    "Brand": "brand",
    "Weight": "weight",
    "GTIN": "gtin"
  },
  "fieldMappings": {
    "Title": "name",
    "Description": "description",
    "ProductSKU": "sku"
  },
  "isActive": true
}
```

### Get Active Import Mapping

```http
GET /api/integration/mydeal/connections/:connectionId/import-mappings/active
Authorization: Bearer <token>
```

## Transformation Flow

### Export Flow
1. Fetch product with relations (attributes, assets, variants)
2. Load export mapping (if connectionId provided)
3. For each field:
   - Check if field is in selectedFields (if mapping exists)
   - Apply field mapping transformation
   - Get value from product direct field OR attributes
   - Use default value if not found
4. Build ProductSpecifics from remaining attributes
5. Generate MyDeal payload
6. Send to MyDeal API

### Import Flow
1. Receive product data from MyDeal
2. Load import mapping
3. Apply attribute mappings to convert MyDeal attributes to internal
4. Apply field mappings to convert MyDeal fields to internal
5. Store product in database

## Example Product Transformation

### Input Product
```typescript
{
  id: 123,
  sku: "PROD-001",
  name: "Sample Product",
  categoryId: 135,
  assets: [
    { asset: { url: "https://example.com/image1.jpg" } },
    { asset: { url: "https://example.com/image2.jpg" } }
  ],
  attributes: [
    { attribute: { name: "brand" }, value: "Acme Corp" },
    { attribute: { name: "weight" }, value: "2.5" },
    { attribute: { name: "height" }, value: "0.3" },
    { attribute: { name: "price" }, value: "99.99" },
    { attribute: { name: "quantity" }, value: "50" },
    { attribute: { name: "color" }, value: "Blue" },
    { attribute: { name: "material" }, value: "Cotton" }
  ]
}
```

### Output MyDeal Payload
```json
{
  "ExternalProductId": "PROD-001",
  "ProductSKU": "PROD-001",
  "Title": "Sample Product",
  "Description": "",
  "Brand": "Acme Corp",
  "Categories": [{ "CategoryId": 135 }],
  "Images": [
    { "Src": "https://example.com/image1.jpg", "Position": 0 },
    { "Src": "https://example.com/image2.jpg", "Position": 1 }
  ],
  "Weight": 2.5,
  "Height": 0.3,
  "BuyableProducts": [{
    "SKU": "PROD-001",
    "Price": 99.99,
    "Quantity": 50,
    "ListingStatus": 1
  }],
  "ProductSpecifics": [
    { "Name": "color", "Value": "Blue" },
    { "Name": "material", "Value": "Cotton" }
  ]
}
```

## Benefits

1. **Flexible Data Structure** - Store any product data as attributes
2. **Field Mapping** - Map internal fields to MyDeal fields
3. **Selective Export** - Choose which fields to export
4. **Default Values** - Automatic fallbacks for missing data
5. **ProductSpecifics** - Unused attributes become product specifics
6. **Multi-Source Data** - Read from direct fields OR attributes

## Best Practices

1. **Store Everything as Attributes** - Except core fields (name, sku, categoryId, images)
2. **Use Consistent Naming** - Keep attribute names consistent with MyDeal fields
3. **Configure Mappings** - Set up export/import mappings per connection
4. **Test Mappings** - Test with a single product before bulk export
5. **Check Logs** - Review integration logs for transformation details

## Troubleshooting

### Product Not Exporting
- Check if product has SKU
- Verify product has required attributes
- Check export mapping configuration
- Review integration logs

### Missing Fields in MyDeal
- Ensure attributes are properly set
- Check if field is in selectedFields
- Verify field mapping is correct
- Check default values

### Incorrect Data Transformation
- Review fieldMappings configuration
- Check attribute names (case-sensitive)
- Verify data types (string, number, boolean)
- Check ProductSpecifics in payload

## Related Files

- `mydeal.service.ts` - Core transformation logic
- `mydeal-connection.service.ts` - Mapping management
- `mydeal-mapping.dto.ts` - Mapping DTOs
- `schema.prisma` - Database schema for mappings
