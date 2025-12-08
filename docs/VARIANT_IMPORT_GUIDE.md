# Product Variant Import Guide

This guide explains how to use the Excel/CSV import feature and direct API calls to create product variants using the `parentSku` field.

## Overview

Product variants allow you to create multiple variations of a base product (e.g., different sizes, colors, or configurations). The system now supports automatic variant creation through the use of a `parentSku` field in:
- Excel/CSV imports
- Direct API calls to create/update products

## How It Works

1. **Parent Product**: A product without a `parentSku` value is treated as a standalone or parent product
2. **Variant Product**: A product with a `parentSku` value is treated as a variant of the product matching that SKU
3. **Automatic SKU Resolution**: The backend automatically looks up the parent product by SKU and converts it to `parentProductId`
4. **Parent Not Found Error**: If the parent SKU doesn't exist, the API will return a 400 error
5. **Inheritance**: Variants can inherit family and category from their parent
6. **Attribute Handling**: Variants can have unique attributes or inherit from the parent

## API Usage

### Create Variant Product

You can create a variant directly using the products API:

```http
POST /products
Content-Type: application/json
Authorization: Bearer <your-token>

{
  "name": "T-Shirt - Red Small",
  "sku": "TSH-001",
  "parentSku": "TSH-PARENT",
  "familyId": 5,
  "attributesWithValues": [
    { "attributeId": 10, "value": "Red" },
    { "attributeId": 11, "value": "Small" }
  ]
}
```

### Update Product to Make it a Variant

```http
PATCH /products/123
Content-Type: application/json
Authorization: Bearer <your-token>

{
  "parentSku": "TSH-PARENT"
}
```

### Remove Parent (Convert Variant to Standalone)

```http
PATCH /products/123
Content-Type: application/json
Authorization: Bearer <your-token>

{
  "parentSku": null
}
```

## CSV Structure

### Column Mapping

The following column names are recognized for the `parentSku` field (case-insensitive):
- `parentSku`
- `parent_sku`
- `parent sku`
- `parent`

### Required Columns

- `name` - Product name
- `sku` - Product SKU (must be unique per user)

### Optional Columns

- `parentSku` - Parent product SKU (creates variant if present)
- `categoryName` - Category name
- `familyName` - Family name
- `productLink` - Product URL
- `imageUrl` - Main product image URL
- `subImages` - Additional images (comma-separated)
- Custom attribute columns (any other columns become product attributes)

## Examples

### Example 1: Basic T-Shirt with Size Variants

```csv
name,sku,parentSku,categoryName,familyName,size,color,price,inStock
"Basic T-Shirt",TSH-BASE,,Clothing,Apparel,,Red,29.99,
"Basic T-Shirt - Small",TSH-S,TSH-BASE,,,Small,,29.99,true
"Basic T-Shirt - Medium",TSH-M,TSH-BASE,,,Medium,,29.99,true
"Basic T-Shirt - Large",TSH-L,TSH-BASE,,,Large,,29.99,false
"Basic T-Shirt - XL",TSH-XL,TSH-BASE,,,XL,,31.99,true
```

**Result**:
- 1 parent product (`TSH-BASE`)
- 4 variant products (Small, Medium, Large, XL)
- All variants inherit the category "Clothing" and family "Apparel"
- Each variant has its own size and availability

### Example 2: Shoes with Size and Color Variants

```csv
name,sku,parentSku,categoryName,familyName,color,size,price,inStock,imageUrl
"Running Shoe",SHOE-RUN,,Footwear,Athletic,,,89.99,,https://example.com/shoe-base.jpg
"Running Shoe - Black 8",SHOE-BLK-8,SHOE-RUN,,,Black,8,89.99,true,https://example.com/shoe-black-8.jpg
"Running Shoe - Black 9",SHOE-BLK-9,SHOE-RUN,,,Black,9,89.99,true,https://example.com/shoe-black-9.jpg
"Running Shoe - Black 10",SHOE-BLK-10,SHOE-RUN,,,Black,10,89.99,false,https://example.com/shoe-black-10.jpg
"Running Shoe - White 8",SHOE-WHT-8,SHOE-RUN,,,White,8,89.99,true,https://example.com/shoe-white-8.jpg
"Running Shoe - White 9",SHOE-WHT-9,SHOE-RUN,,,White,9,89.99,true,https://example.com/shoe-white-9.jpg
```

**Result**:
- 1 parent product (`SHOE-RUN`)
- 5 variant products (different color and size combinations)
- Each variant has unique image URLs

### Example 3: Parent Created Automatically

```csv
name,sku,parentSku,size,color
"Laptop Case - Small",CASE-S,CASE-BASE,13 inch,Black
"Laptop Case - Medium",CASE-M,CASE-BASE,15 inch,Black
"Laptop Case - Large",CASE-L,CASE-BASE,17 inch,Black
```

**Result**:
- 1 parent product automatically created (`CASE-BASE`) with name "Parent Product - CASE-BASE"
- 3 variant products
- The parent can be updated later with complete information

### Example 4: Mixed Products and Variants

```csv
name,sku,parentSku,categoryName,price
"Standalone Product",PROD-001,,Electronics,199.99
"Parent Product",PROD-002,,Electronics,299.99
"Variant 1",PROD-002-A,PROD-002,,289.99
"Variant 2",PROD-002-B,PROD-002,,309.99
"Another Standalone",PROD-003,,Electronics,149.99
```

**Result**:
- 3 standalone/parent products
- 2 variants of `PROD-002`

## Important Rules and Limitations

### 1. No Nested Variants
Variants **cannot** have their own variants. If you try to use a variant's SKU as a `parentSku`, the import will fail with an error.

```csv
# ❌ This will FAIL
name,sku,parentSku
"Parent",P-001,
"Variant",V-001,P-001
"Sub-Variant",SV-001,V-001  # ERROR: Cannot create variant of a variant
```

### 2. SKU Uniqueness
Each SKU must be unique within your account. Importing a product with an existing SKU will **update** that product.

### 3. Inheritance Behavior

**Inherited from Parent:**
- Family
- Category (if not explicitly specified in variant)
- Attributes (only if variant has no custom attributes)

**NOT Inherited:**
- Name (must be unique per variant)
- SKU (must be unique per variant)
- Product images
- Product link

### 4. Attribute Override

If a variant specifies custom attributes, it will use those instead of inheriting from the parent.

```csv
name,sku,parentSku,color,material
"Base Product",BASE-001,,Red,Cotton
"Variant 1",VAR-001,BASE-001,,,  # Inherits Red and Cotton
"Variant 2",VAR-002,BASE-001,Blue,Polyester  # Uses Blue and Polyester
```

### 5. Updating Variants

Re-importing with the same SKU updates the existing product/variant:

```csv
# First Import
name,sku,parentSku,price
"Variant",V-001,P-001,29.99

# Second Import (updates price)
name,sku,parentSku,price
"Variant - Updated",V-001,P-001,34.99
```

## API Usage

### Import Products with Variants

```http
POST /products/import
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "csvUrl": "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/export?format=csv"
}
```

### Get Product with Variants

```http
GET /products/{parentProductId}
Authorization: Bearer YOUR_TOKEN
```

Response includes a `variants` array with all child products.

### List Product Variants

```http
GET /products/{parentProductId}/variants?page=1&limit=10
Authorization: Bearer YOUR_TOKEN
```

## Best Practices

### 1. Plan Your SKU Structure

Use a consistent SKU naming pattern for variants:
```
PARENT-001      # Parent
PARENT-001-S    # Small variant
PARENT-001-M    # Medium variant
PARENT-001-L    # Large variant
```

### 2. Import Parents First (Optional)

While not required, you may want to import parent products with complete information before importing variants:

**Import 1 - Parents:**
```csv
name,sku,parentSku,categoryName,familyName,description
"Premium T-Shirt",TSH-001,,Clothing,Apparel,"High-quality cotton t-shirt"
```

**Import 2 - Variants:**
```csv
name,sku,parentSku,size,color
"Premium T-Shirt - Red Small",TSH-001-RS,TSH-001,Small,Red
"Premium T-Shirt - Red Medium",TSH-001-RM,TSH-001,Medium,Red
```

### 3. Use Descriptive Variant Names

Include variant-specific information in the name:
- ✅ "Running Shoe - Black Size 9"
- ❌ "Running Shoe"

### 4. Keep Attributes Consistent

Use the same attribute columns for all variants of a product:
```csv
name,sku,parentSku,size,color,material
"Product",P-001,,,Red,Cotton
"Variant 1",V-001,P-001,Small,Red,Cotton
"Variant 2",V-002,P-001,Medium,Red,Cotton
```

### 5. Test with Small Batches

Test your CSV structure with a few products before importing large datasets.

## Troubleshooting

### Error: "Cannot add variant to X because it is itself a variant"

**Cause**: You're trying to create a variant of a variant.

**Solution**: Use the original parent's SKU as the `parentSku`.

### Error: "Missing required fields: name and sku are mandatory"

**Cause**: One or more rows are missing the `name` or `sku` column.

**Solution**: Ensure all rows have both `name` and `sku` values.

### Variants Not Showing Up

**Cause**: The parent SKU might not match exactly.

**Solution**: 
- Check for extra spaces in the `parentSku` column
- Ensure SKU case matches (though matching is case-sensitive)
- Verify the parent product was created successfully

### Parent Product Has Incomplete Information

**Cause**: The parent was auto-created from a variant row.

**Solution**: Re-import with a row for the parent product containing complete information.

## Performance Considerations

- Large imports with many variants are processed sequentially
- Progress is logged every 50 products
- Consider breaking very large imports (>1000 products) into multiple batches
- Each variant creation triggers attribute inheritance and status calculation

## Migration from Existing Products

To convert existing standalone products into parent-variant relationships:

1. Export existing products
2. Add `parentSku` column
3. Fill in parent SKUs for products that should become variants
4. Re-import the CSV

The system will update existing products and establish the parent-child relationships.

## Related Documentation

- [CSV Import Guide](./CSV_IMPORT_GUIDE.md) - General CSV import documentation
- [Product Variant API](./API_REFERENCE.md#product-variants) - API endpoints for managing variants
- [Family Attribute Guide](./FAMILY_ATTRIBUTE_GUIDE.md) - Understanding family inheritance

## Support

If you encounter issues with variant imports:
1. Check the import response for specific error messages
2. Review the import logs for detailed error information
3. Verify your CSV structure matches the examples
4. Ensure all parent SKUs reference valid products
