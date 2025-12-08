# CSV Import Guide

This guide explains how to format CSV files for import into the PixelPim system.

## Required Fields

The following fields are **mandatory** and must be present in your CSV:

- `name` (or `Name`, `product_name`) - The product name
- `sku` (or `SKU`, `product_sku`) - The product SKU (Stock Keeping Unit)

## Optional Standard Fields

These fields are recognized and will be mapped to product properties:

- `parentSku` (or `parent_sku`, `parent sku`, `parent`) - Parent product SKU for creating variants
- `productLink` (or `product_link`, `url`) - Link to the product
- `imageUrl` (or `image_url`, `image`) - Main product image URL  
- `subImages` (or `sub_images`) - Additional product images (comma-separated URLs or JSON array)
- `categoryName` (or `category_name`, `category`) - Category name (will be created if doesn't exist)
- `familyName` (or `family_name`, `family`) - Family name (will be created if doesn't exist)

## Product Variants

You can create product variants by including a `parentSku` column in your CSV:

- If a row contains a `parentSku` value, the product will be created as a variant of the parent product
- The parent product will be automatically created if it doesn't exist
- Variants inherit the family and category from their parent (unless explicitly specified)
- Variants can have their own unique attributes and attribute values
- If no custom attributes are provided for a variant, it will inherit the parent's attributes

## Custom Attributes

Any additional columns in your CSV will be treated as custom attributes:

- **Attribute Creation**: If an attribute with the given name doesn't exist, it will be created automatically
- **Type Inference**: The system will automatically infer the attribute type based on the data:
  - `BOOLEAN` - for values like true/false, yes/no, 1/0
  - `INTEGER` - for whole numbers (e.g., 123, -456)
  - `NUMBER` - for decimal numbers (e.g., 12.34, -56.78)
  - `DATE` - for date formats (YYYY-MM-DD, MM/DD/YYYY, M/D/YYYY)
  - `URL` - for URLs starting with http:// or https://
  - `EMAIL` - for email addresses
  - `ARRAY` - for comma-separated values
  - `TEXT` - for long text (over 255 characters)
  - `STRING` - for everything else (default)

## CSV Format Example

### Basic Products

```csv
name,sku,categoryName,familyName,color,size,weight,price,inStock,description,productLink
"Red T-Shirt",TSH-001,Clothing,Apparel,Red,Large,0.3,29.99,true,"Comfortable cotton t-shirt",https://example.com/tshirt
"Blue Jeans",JNS-002,Clothing,Apparel,Blue,"32x34",1.2,79.99,false,"Classic denim jeans",https://example.com/jeans
"Laptop",LAP-001,Electronics,Computers,Silver,15.6 inch,2.1,1299.99,true,"High-performance laptop",https://example.com/laptop
```

### Products with Variants

```csv
name,sku,parentSku,categoryName,familyName,color,size,price,inStock
"T-Shirt",TSH-PARENT,,Clothing,Apparel,,,29.99,
"T-Shirt - Red Small",TSH-001,TSH-PARENT,,,Red,Small,29.99,true
"T-Shirt - Red Medium",TSH-002,TSH-PARENT,,,Red,Medium,29.99,true
"T-Shirt - Red Large",TSH-003,TSH-PARENT,,,Red,Large,29.99,false
"T-Shirt - Blue Small",TSH-004,TSH-PARENT,,,Blue,Small,29.99,true
"T-Shirt - Blue Medium",TSH-005,TSH-PARENT,,,Blue,Medium,29.99,true
```

In this example:
- `TSH-PARENT` is the parent product
- All products with `parentSku=TSH-PARENT` become variants of that parent
- Variants inherit the `categoryName` and `familyName` from the parent if not specified
- Each variant can have its own unique attribute values (color, size, inStock)

In this example:
- `name` and `sku` are required fields
- `categoryName` and `familyName` will create/find categories and families
- `color`, `size`, `weight`, `price`, `inStock`, `description` will become custom attributes
- The system will infer: 
  - `color` → STRING
  - `size` → STRING  
  - `weight` → NUMBER
  - `price` → NUMBER
  - `inStock` → BOOLEAN
  - `description` → STRING (or TEXT if long)
  - `productLink` → URL

## Important Notes

1. **No IDs Required**: Don't include category IDs, family IDs, or attribute IDs in your CSV. Use names instead.

2. **Automatic Creation**: Categories, families, and attributes will be created automatically if they don't exist.

3. **Type Validation**: If an attribute already exists, the system will validate that new data is compatible with the existing type.

4. **Error Handling**: If a product fails to import, the system will log the error and continue with the next product.

5. **Case Sensitivity**: Column names are case-insensitive and support multiple formats (underscore, camelCase, etc.).

6. **Empty Values**: Empty or null values will be ignored for optional fields.

7. **Product Variants**: 
   - Use `parentSku` column to create product variants
   - Parent products are automatically created if they don't exist
   - Variants cannot have their own variants (no nested variants)
   - Variants inherit parent's family and category unless explicitly specified

8. **Parent Product Placeholder**: If you reference a parent SKU that doesn't exist, a placeholder parent product will be created automatically. You can update it later with complete information.

## Attribute Type Compatibility

When importing data for existing attributes, the system checks type compatibility:

- **STRING** accepts: TEXT, EMAIL, URL, PHONE, COLOR
- **TEXT** accepts: STRING, HTML
- **NUMBER** accepts: INTEGER, FLOAT, CURRENCY, PERCENTAGE  
- **INTEGER** accepts: NUMBER
- **ARRAY** can accept: STRING (comma-separated values)

## Best Practices

1. **Consistent Naming**: Use consistent column names across your CSV files.

2. **Data Quality**: Ensure data quality for type inference to work correctly.

3. **Test Import**: Test with a small subset first to verify the mapping.

4. **Backup**: Always backup your data before performing large imports.

5. **Monitor Logs**: Check the import logs for any warnings or errors.

## Error Messages

Common error messages and their meanings:

- `Missing required fields: name and sku are mandatory` - Ensure both name and sku columns exist with values
- `Attribute [name] type mismatch` - The data doesn't match the existing attribute type
- `Failed to import product '[name]'` - General import error, check logs for details

## Performance Notes

- The system processes products sequentially to maintain data integrity
- Large imports may take time as categories, families, and attributes are created on-demand  
- Progress is logged every 50 products for monitoring
