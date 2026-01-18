# MyDeal Product Transformation Update - Summary

## Changes Made

### 1. Updated MyDealService (`mydeal.service.ts`)

#### Added Dependencies
- Injected `MyDealConnectionService` to access export/import data mappings
- Used `forwardRef` to handle circular dependency between services

#### Updated Export Methods
- `exportProduct()` - Now accepts optional `connectionId` parameter
- `exportProducts()` - Now accepts optional `connectionId` parameter  
- `updateProduct()` - Now accepts optional `connectionId` parameter
- `pullUpdates()` - Now accepts optional `connectionId` parameter for import mapping

#### Added Import Transformation
New method `transformMyDealToProduct()` that:
- Transforms MyDeal product format to internal format
- Applies import attribute mappings
- Applies import field mappings
- Maps MyDeal fields to internal attributes
- Handles variants, images, pricing, and dimensions

#### Completely Refactored `transformProductToMyDeal()`
The transformation method now:

**Reads from Attributes:**
- Product structure: Only core fields (imageUrl, subImages, categoryId, name, sku) are direct properties
- All other data (description, brand, price, weight, dimensions, etc.) is read from `product.attributes`
- Implements fallback chain: Direct field → Attributes → Default value

**Applies Data Mapping:**
- Fetches active export mapping from `MyDealConnectionService`
- Applies field mappings to transform internal field names to MyDeal field names
- Respects `selectedFields` to filter which fields to export
- Supports selective field export based on mapping configuration

**Handles All Attribute Types:**
- **Basic Info**: description, specifications, brand, tags, condition
- **Dimensions**: weight, height, length, width with units
- **Identifiers**: GTIN, MPN, barcode
- **Pricing**: price, compareAtPrice, RRP, quantity
- **Shipping**: requiresShipping, shippingCosts, deliveryTime
- **Category**: categoryId, mydealCategoryId
- **Custom**: Any unmapped attributes → ProductSpecifics array

**Key Features:**
```typescript
const getFieldValue = (internalField: string, defaultValue: any) => {
  // 1. Check if field should be exported (selectedFields)
  // 2. Apply field mapping transformation
  // 3. Get value from product direct field OR attributes
  // 4. Return default if not found
}
```

### 2. Updated DTOs (`mydeal.dto.ts`)

Added optional `connectionId` to `MyDealIntegrationDto`:
```typescript
export class MyDealIntegrationDto {
  productIds: number[];
  connectionId?: number;  // NEW
}
```

### 3. Updated Controller (`mydeal.controller.ts`)

Modified `exportProducts()` endpoint to pass connectionId to service:
```typescript
const result = await this.mydealService.exportProducts(
  integrationDto.productIds,
  effectiveUserId,
  integrationDto.connectionId,  // NEW
);
```

### 4. Created Documentation

**`MYDEAL_ATTRIBUTES_AND_MAPPING.md`** - Comprehensive guide covering:
- Product structure explanation
- List of all supported attributes
- Data mapping configuration
- Export/Import mapping examples
- API usage examples
- Transformation flow diagrams
- Best practices
- Troubleshooting guide

## How It Works

### Export Flow with Data Mapping

1. **Client sends export request** with optional connectionId:
   ```json
   {
     "productIds": [1, 2, 3],
     "connectionId": 5
   }
   ```

2. **Service fetches export mapping**:
   ```typescript
   const exportMapping = await this.connectionService.getActiveExportMapping(
     userId, 
     connectionId
   );
   ```

3. **Transformation reads from attributes**:
   ```typescript
   // Product structure
   {
     id: 123,
     sku: "PROD-001",
     name: "Sample Product",
     categoryId: 135,
     assets: [...],
     attributes: [
       { attribute: { name: "brand" }, value: "Acme" },
       { attribute: { name: "price" }, value: "99.99" },
       { attribute: { name: "weight" }, value: "2.5" }
     ]
   }
   ```

4. **Applies field mappings**:
   ```typescript
   fieldMappings = { "price": "Price", "brand": "Brand" }
   selectedFields = ["name", "sku", "price", "brand"]
   ```

5. **Generates MyDeal payload**:
   ```json
   {
     "Title": "Sample Product",
     "ProductSKU": "PROD-001",
     "Brand": "Acme",
     "BuyableProducts": [{
       "Price": 99.99
     }]
   }
   ```

### Import Flow with Data Mapping

1. **Client requests product pull** with optional connectionId:
   ```typescript
   await myDealService.pullUpdates(userId, connectionId);
   ```

2. **Service fetches import mapping**:
   ```typescript
   const importMapping = await this.connectionService.getActiveImportMapping(
     userId, 
     connectionId
   );
   ```

3. **Receives MyDeal products**:
   ```json
   {
     "ProductSKU": "PROD-001",
     "Title": "Sample Product",
     "Brand": "Acme",
     "Weight": 2.5,
     "BuyableProducts": [{
       "Price": 99.99,
       "Quantity": 50
     }]
   }
   ```

4. **Applies import mappings**:
   ```typescript
   attributeMappings = { "Brand": "brand", "Weight": "weight" }
   fieldMappings = { "Title": "name", "ProductSKU": "sku" }
   ```

5. **Generates internal product structure**:
   ```json
   {
     "sku": "PROD-001",
     "name": "Sample Product",
     "attributes": [
       { "name": "brand", "value": "Acme" },
       { "name": "weight", "value": 2.5 },
       { "name": "price", "value": 99.99 },
       { "name": "quantity", "value": 50 }
     ]
   }
   ```

## Benefits

✅ **Flexible Data Structure** - Store any product data as attributes  
✅ **Field Mapping Support** - Map internal fields to MyDeal fields (export & import)  
✅ **Selective Export** - Choose which fields to export per connection  
✅ **Default Values** - Automatic fallbacks for missing data  
✅ **ProductSpecifics** - Unused attributes become product specifics  
✅ **Multi-Source Data** - Read from direct fields OR attributes  
✅ **Per-Connection Config** - Different mappings for different connections  
✅ **Bidirectional Mapping** - Both export (to MyDeal) and import (from MyDeal) support  
✅ **Attribute Preservation** - Import converts MyDeal fields to attributes

## Breaking Changes

⚠️ **None** - Changes are backward compatible:
- `connectionId` is optional in all methods
- If no connectionId provided, works without mappings
- Existing code will continue to work unchanged

## Testing Recommendations

1. **Test without connectionId** - Ensure backward compatibility
2. **Test with connectionId but no mapping** - Should work with defaults
3. **Test with active export mapping** - Verify field mapping works
4. **Test selectedFields filtering** - Ensure only selected fields exported
5. **Test attribute reading** - Verify attributes are properly read
6. **Test ProductSpecifics** - Check unmapped attributes appear there

## API Examples

### Export with Data Mapping
```http
POST /api/integration/mydeal/export
Authorization: Bearer <token>

{
  "productIds": [1, 2, 3],
  "connectionId": 5
}
```

### Import with Data Mapping
```http
GET /api/integration/mydeal/products?connectionId=5
Authorization: Bearer <token>
```

### Create Export Mapping
```http
POST /api/integration/mydeal/connections/5/export-mappings

{
  "fieldMappings": {
    "description": "Description",
    "brand": "Brand",
    "price": "Price"
  },
  "selectedFields": ["name", "sku", "description", "brand", "price"],
  "isActive": true
}
```

### Create Import Mapping
```http
POST /api/integration/mydeal/connections/5/import-mappings

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

## Files Modified

1. `src/integration/mydeal/mydeal.service.ts` - Core transformation logic
2. `src/integration/mydeal/mydeal.controller.ts` - Controller updates
3. `src/integration/mydeal/dto/mydeal.dto.ts` - DTO updates
4. `MYDEAL_ATTRIBUTES_AND_MAPPING.md` - New documentation (created)
5. `MYDEAL_TRANSFORMATION_UPDATE.md` - This summary (created)

## Next Steps

1. ✅ Code changes complete
2. ⏭️ Test with sample products
3. ⏭️ Configure export mappings
4. ⏭️ Test with real MyDeal connection
5. ⏭️ Monitor integration logs
6. ⏭️ Update frontend to support connectionId parameter

## Related Documentation

- [MYDEAL_ATTRIBUTES_AND_MAPPING.md](./MYDEAL_ATTRIBUTES_AND_MAPPING.md) - Full guide
- [MYDEAL_INTEGRATION_COMPLETE.md](./MYDEAL_INTEGRATION_COMPLETE.md) - Integration overview
- [MYDEAL_QUICK_REFERENCE.md](./MYDEAL_QUICK_REFERENCE.md) - API reference
