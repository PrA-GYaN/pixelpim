# Import Mapping Update - Migration Guide

## Summary
Updated MyDeal import mappings to include `selectedFields` similar to export mappings, allowing users to select which fields should be imported from MyDeal.

## Changes Made

### 1. Database Schema (Prisma)
**File**: `prisma/schema.prisma`

Added `selectedFields` field to `MyDealImportMapping` model:
```prisma
model MyDealImportMapping {
  id                Int              @id @default(autoincrement())
  connectionId      Int
  attributeMappings Json             // Maps MyDeal attributes to internal attributes
  fieldMappings     Json             // Maps MyDeal fields to internal fields
  selectedFields    String[]         // List of fields to import (NEW)
  isActive          Boolean          @default(true)
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  connection        MyDealConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)

  @@index([connectionId, isActive])
}
```

### 2. DTOs Updated
**File**: `src/integration/mydeal/dto/mydeal-mapping.dto.ts`

- Added `selectedFields: string[]` to `CreateMyDealImportMappingDto`
- Added `selectedFields?: string[]` to `UpdateMyDealImportMappingDto`
- Added `selectedFields: string[]` to `MyDealImportMappingResponseDto`

### 3. Connection Service Updated
**File**: `src/integration/mydeal/mydeal-connection.service.ts`

- Updated `createImportMapping()` to handle `selectedFields`
- Updated `toImportMappingDto()` to include `selectedFields` in response

### 4. Import Service Updated
**File**: `src/integration/mydeal/mydeal.service.ts`

Updated the following methods to use `selectedFields` for filtering which fields to import:

- `importProducts()` - Now passes selectedFields to import functions
- `importSimpleProduct()` - Accepts and uses selectedFields
- `importVariantProduct()` - Accepts and uses selectedFields
- `buildProductAttributes()` - Added selectedFields parameter with filtering logic
- `buildVariantAttributes()` - Added selectedFields parameter with filtering logic
- `transformMyDealToProduct()` - Added selectedFields parameter with filtering logic
- `pullUpdates()` - Updated to pass selectedFields from import mapping

### 5. Field Filtering Logic
Added `shouldIncludeField()` helper function in import methods that:
- Returns `true` for all fields if `selectedFields` is null or empty
- Returns `true` only if the field is in the `selectedFields` array when specified

This allows granular control over which MyDeal fields are imported into the system.

## Migration Steps

### 1. Generate Prisma Client
```bash
cd PixelPim_backend
npx prisma generate
```

### 2. Create and Run Database Migration
```bash
npx prisma migrate dev --name add_selected_fields_to_import_mapping
```

Or for production:
```bash
npx prisma migrate deploy
```

### 3. Update Existing Import Mappings (Optional)
If you have existing import mappings, you may want to populate the `selectedFields` with default values:

```sql
-- Set all fields as selected for existing mappings
UPDATE "MyDealImportMapping" 
SET "selectedFields" = ARRAY[
  'Description', 'Brand', 'Tags', 'Condition',
  'Weight', 'WeightUnit', 'Length', 'Height', 'Width', 'DimensionUnit',
  'GTIN', 'MPN', 'ShippingCostCategory',
  'Price', 'RRP', 'Quantity', 'ListingStatus'
]
WHERE "selectedFields" = ARRAY[]::text[] OR "selectedFields" IS NULL;
```

## API Usage

### Create Import Mapping with Selected Fields
```json
POST /mydeal/:connectionId/import-mappings

{
  "connectionId": 1,
  "attributeMappings": {
    "Brand": "brand",
    "GTIN": "barcode"
  },
  "fieldMappings": {
    "Description": "description",
    "Price": "price"
  },
  "selectedFields": [
    "Description",
    "Brand",
    "Price",
    "Quantity",
    "GTIN"
  ],
  "isActive": true
}
```

### Update Import Mapping
```json
PUT /mydeal/import-mappings/:mappingId

{
  "selectedFields": [
    "Brand",
    "Price",
    "Quantity"
  ]
}
```

## Available Fields for Selection

### Product Fields
- `Description`
- `Brand`
- `Tags`
- `Condition`

### Dimensions & Weight
- `Weight`
- `WeightUnit`
- `Length`
- `Height`
- `Width`
- `DimensionUnit`

### Identifiers
- `GTIN`
- `MPN`

### Shipping
- `ShippingCostCategory`

### Pricing & Inventory
- `Price`
- `RRP`
- `Quantity`
- `ListingStatus`

### Variant Options
- Any custom option names (e.g., `Color`, `Size`, etc.)

## Backward Compatibility

The changes are backward compatible:
- If `selectedFields` is empty or null, all fields are imported (default behavior)
- Existing code will continue to work without modification
- New functionality only activates when `selectedFields` is explicitly set

## Testing

After migration, test the following scenarios:

1. **Create new import mapping with selectedFields**
2. **Import products with field filtering active**
3. **Import variant products with field filtering**
4. **Verify only selected fields are imported**
5. **Test with empty selectedFields (should import all fields)**
6. **Update existing import mapping to add/remove fields**

## Notes

- The `selectedFields` array works similarly to export mappings for consistency
- Empty or null `selectedFields` means "import all fields"
- Field filtering applies to both simple and variant products
- Parent and variant products both respect the selectedFields setting
