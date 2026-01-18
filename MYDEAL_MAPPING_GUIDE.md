# MyDeal Import/Export Field Mappings

## Overview

The MyDeal integration now supports flexible field mapping configurations, allowing you to customize how data is transformed between your internal system and MyDeal. This feature is similar to the WooCommerce mapping system and enables:

- **Custom field transformations** between internal and MyDeal fields
- **Selective field exports** - choose which fields to sync
- **Attribute mapping** for imports - map MyDeal attributes to internal attributes
- **Multiple mapping configurations** per connection (with one active at a time)

## Architecture

### Database Models

#### MyDealExportMapping
Controls how internal product data is transformed when exporting to MyDeal.

```prisma
model MyDealExportMapping {
  id              Int              @id @default(autoincrement())
  connectionId    Int
  fieldMappings   Json             // Maps internal fields to MyDeal fields
  selectedFields  String[]         // List of fields to export
  isActive        Boolean          @default(true)
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  connection      MyDealConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
}
```

#### MyDealImportMapping
Controls how MyDeal product data is transformed when importing to your system.

```prisma
model MyDealImportMapping {
  id                Int              @id @default(autoincrement())
  connectionId      Int
  attributeMappings Json             // Maps MyDeal attributes to internal attributes
  fieldMappings     Json             // Maps MyDeal fields to internal fields
  isActive          Boolean          @default(true)
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  connection        MyDealConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
}
```

## Export Mapping

### Field Mappings Structure

The `fieldMappings` object defines how internal fields map to MyDeal fields:

```json
{
  "name": "Title",
  "description": "Description",
  "specifications": "Specifications",
  "brand": "Brand",
  "sku": "ProductSKU",
  "price": "BuyableProducts[0].Price",
  "compareAtPrice": "BuyableProducts[0].RRP",
  "quantity": "BuyableProducts[0].Quantity",
  "weight": "Weight",
  "length": "Length",
  "width": "Width",
  "height": "Height",
  "gtin": "GTIN",
  "mpn": "MPN"
}
```

### Selected Fields

The `selectedFields` array determines which internal fields are included in exports:

```json
["name", "description", "sku", "price", "quantity", "weight", "brand"]
```

### API Endpoints

#### 1. Create Export Mapping

**Endpoint:** `POST /integration/mydeal/connection/connections/:connectionId/export-mappings`

**Request Body:**
```json
{
  "fieldMappings": {
    "name": "Title",
    "description": "Description",
    "sku": "ProductSKU",
    "price": "BuyableProducts[0].Price"
  },
  "selectedFields": ["name", "description", "sku", "price"],
  "isActive": true
}
```

**Response:**
```json
{
  "id": 1,
  "connectionId": 5,
  "fieldMappings": { ... },
  "selectedFields": [ ... ],
  "isActive": true,
  "createdAt": "2026-01-11T10:00:00Z",
  "updatedAt": "2026-01-11T10:00:00Z"
}
```

#### 2. Get Export Mappings

**Endpoint:** `GET /integration/mydeal/connection/connections/:connectionId/export-mappings`

**Response:**
```json
[
  {
    "id": 1,
    "connectionId": 5,
    "fieldMappings": { ... },
    "selectedFields": [ ... ],
    "isActive": true,
    "createdAt": "2026-01-11T10:00:00Z",
    "updatedAt": "2026-01-11T10:00:00Z"
  }
]
```

#### 3. Get Active Export Mapping

**Endpoint:** `GET /integration/mydeal/connection/connections/:connectionId/export-mappings/active`

Returns only the currently active export mapping.

#### 4. Update Export Mapping

**Endpoint:** `PUT /integration/mydeal/connection/export-mappings/:mappingId`

**Request Body:**
```json
{
  "fieldMappings": { ... },
  "selectedFields": [ ... ],
  "isActive": true
}
```

#### 5. Delete Export Mapping

**Endpoint:** `DELETE /integration/mydeal/connection/export-mappings/:mappingId`

## Import Mapping

### Field Mappings Structure

The `fieldMappings` object defines how MyDeal fields map to internal fields:

```json
{
  "Title": "name",
  "Description": "description",
  "Specifications": "specifications",
  "Brand": "brand",
  "ProductSKU": "sku",
  "ExternalProductId": "externalId",
  "Weight": "weight",
  "Length": "length",
  "Width": "width",
  "Height": "height"
}
```

### Attribute Mappings Structure

The `attributeMappings` object maps MyDeal product specifics to internal attributes:

```json
{
  "Color": "color",
  "Size": "size",
  "Material": "material",
  "Warranty": "warranty"
}
```

### API Endpoints

#### 1. Create Import Mapping

**Endpoint:** `POST /integration/mydeal/connection/connections/:connectionId/import-mappings`

**Request Body:**
```json
{
  "fieldMappings": {
    "Title": "name",
    "Description": "description",
    "ProductSKU": "sku"
  },
  "attributeMappings": {
    "Color": "color",
    "Size": "size"
  },
  "isActive": true
}
```

**Response:**
```json
{
  "id": 1,
  "connectionId": 5,
  "fieldMappings": { ... },
  "attributeMappings": { ... },
  "isActive": true,
  "createdAt": "2026-01-11T10:00:00Z",
  "updatedAt": "2026-01-11T10:00:00Z"
}
```

#### 2. Get Import Mappings

**Endpoint:** `GET /integration/mydeal/connection/connections/:connectionId/import-mappings`

#### 3. Get Active Import Mapping

**Endpoint:** `GET /integration/mydeal/connection/connections/:connectionId/import-mappings/active`

#### 4. Update Import Mapping

**Endpoint:** `PUT /integration/mydeal/connection/import-mappings/:mappingId`

#### 5. Delete Import Mapping

**Endpoint:** `DELETE /integration/mydeal/connection/import-mappings/:mappingId`

## Common Field Mappings

### Standard MyDeal Fields

| MyDeal Field | Type | Description | Typical Internal Field |
|-------------|------|-------------|----------------------|
| `ExternalProductId` | String | Your unique product ID | `sku` or `id` |
| `ProductSKU` | String | Product SKU | `sku` |
| `Title` | String | Product name | `name` |
| `Description` | String | Product description | `description` |
| `Specifications` | String | Technical specs | `specifications` |
| `Brand` | String | Product brand | `brand` |
| `Tags` | String | Product tags (comma-separated) | `tags` |
| `Condition` | String | Product condition (e.g., "new") | `condition` |
| `Weight` | Number | Product weight | `weight` |
| `WeightUnit` | String | Weight unit (e.g., "kg") | - |
| `Length` | Number | Product length | `length` |
| `Height` | Number | Product height | `height` |
| `Width` | Number | Product width | `width` |
| `DimensionUnit` | String | Dimension unit (e.g., "m") | - |
| `GTIN` | String | Global Trade Item Number | `gtin` |
| `MPN` | String | Manufacturer Part Number | `mpn` |

### BuyableProduct Fields (Variants)

| MyDeal Field | Type | Description | Typical Internal Field |
|-------------|------|-------------|----------------------|
| `ExternalBuyableProductID` | String | Variant unique ID | `variant.sku` or `variant.id` |
| `SKU` | String | Variant SKU | `variant.sku` |
| `Price` | Number | Variant price | `variant.price` |
| `RRP` | Number | Recommended retail price | `variant.compareAtPrice` |
| `Quantity` | Number | Stock quantity | `variant.quantity` |
| `ListingStatus` | Number | 0=Inactive, 1=Active | `variant.isActive` |

## Use Cases

### Use Case 1: Custom Field Names

Your internal system uses different field names:

```json
{
  "fieldMappings": {
    "productName": "Title",
    "productDescription": "Description",
    "productCode": "ProductSKU",
    "sellingPrice": "BuyableProducts[0].Price",
    "stockLevel": "BuyableProducts[0].Quantity"
  },
  "selectedFields": [
    "productName",
    "productDescription",
    "productCode",
    "sellingPrice",
    "stockLevel"
  ]
}
```

### Use Case 2: Selective Export

Only export specific fields to MyDeal:

```json
{
  "fieldMappings": {
    "name": "Title",
    "sku": "ProductSKU",
    "price": "BuyableProducts[0].Price",
    "quantity": "BuyableProducts[0].Quantity"
  },
  "selectedFields": ["name", "sku", "price", "quantity"]
}
```

### Use Case 3: Custom Attribute Mapping

Map MyDeal product specifics to internal attributes:

```json
{
  "attributeMappings": {
    "Color": "product_color",
    "Size": "product_size",
    "Material": "fabric_type",
    "Warranty Period": "warranty_months"
  }
}
```

### Use Case 4: Multiple Environments

Create different mappings for testing and production:

```typescript
// Test mapping - limited fields
const testMapping = {
  fieldMappings: {
    name: "Title",
    sku: "ProductSKU"
  },
  selectedFields: ["name", "sku"],
  isActive: false
};

// Production mapping - all fields
const prodMapping = {
  fieldMappings: {
    name: "Title",
    description: "Description",
    sku: "ProductSKU",
    price: "BuyableProducts[0].Price",
    // ... more fields
  },
  selectedFields: ["name", "description", "sku", "price", /* ... */],
  isActive: true
};
```

## Managing Multiple Mappings

You can create multiple mappings per connection, but only one can be active at a time:

```bash
# Create mapping 1 (becomes active)
POST /connections/1/export-mappings
{ "isActive": true, ... }

# Create mapping 2 (automatically deactivates mapping 1)
POST /connections/1/export-mappings
{ "isActive": true, ... }

# Switch back to mapping 1
PUT /export-mappings/1
{ "isActive": true }
```

## Configuration Import/Export

Mappings are included when exporting/importing MyDeal configurations:

```json
{
  "version": "1.0",
  "integrationType": "mydeal",
  "connection": { ... },
  "exportMappings": [
    {
      "fieldMappings": { ... },
      "selectedFields": [ ... ],
      "isActive": true
    }
  ],
  "importMappings": [
    {
      "fieldMappings": { ... },
      "attributeMappings": { ... },
      "isActive": true
    }
  ]
}
```

## Best Practices

1. **Test Before Production**: Create test mappings with `isActive: false` first
2. **Document Custom Mappings**: Keep a record of custom field mapping decisions
3. **Version Control**: Export and store mapping configurations in version control
4. **Validate Field Names**: Ensure mapped field names match your internal schema
5. **Selective Exports**: Only include necessary fields to reduce API payload size
6. **Regular Reviews**: Review mappings when internal schema changes

## Troubleshooting

### Mapping Not Applied

- Check that the mapping is set to `isActive: true`
- Verify only one mapping per connection is active
- Ensure connection ID is correct

### Fields Not Syncing

- Verify field names in `selectedFields` match internal field names
- Check `fieldMappings` has correct MyDeal field names
- Ensure internal fields contain data

### Import Failures

- Validate `attributeMappings` point to existing internal attributes
- Check `fieldMappings` use correct MyDeal API field names
- Verify data types match between systems

## Migration

Apply the database changes:

```bash
npx prisma generate
npx prisma migrate dev --name add_mydeal_mappings
```

## Summary

The MyDeal mapping system provides:
- ✅ Flexible field transformations
- ✅ Selective field exports
- ✅ Attribute mapping for imports
- ✅ Multiple mapping configurations
- ✅ Easy configuration management
- ✅ Integration with configuration import/export

This enables full customization of data flow between your system and MyDeal.
