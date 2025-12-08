# Excel Import Guide - Comprehensive Documentation

## Table of Contents
1. [Overview](#overview)
2. [File Upload & Mapping](#file-upload--mapping)
3. [Header Processing and Type Inference](#header-processing-and-type-inference)
4. [Family-Level Attribute Handling](#family-level-attribute-handling)
5. [Row-Level Validation](#row-level-validation)
6. [Mapping to Domain Model](#mapping-to-domain-model)
7. [Persistence and Transactions](#persistence-and-transactions)
8. [Error Handling and Reporting](#error-handling-and-reporting)
9. [Security Checks](#security-checks)
10. [Testing Guidelines](#testing-guidelines)
11. [Examples](#examples)

---

## Overview

The Excel import pipeline provides a robust, enterprise-grade solution for bulk product imports with comprehensive validation, type inference, and family-level attribute management.

**Key Features:**
- ✅ Automatic type inference from data
- ✅ Explicit type annotations in headers
- ✅ Family-level attribute definitions
- ✅ Row-level validation with detailed errors
- ✅ Transactional persistence
- ✅ Comprehensive error reporting
- ✅ Progress tracking for large imports

**Architecture:**
```
Frontend → Backend API → ExcelImportService → ProductService → Database
                              ↓
                         ParseExcel (with type inference)
                              ↓
                         Family Attribute Definitions
                              ↓
                         Row Validation
                              ↓
                         Domain Model Transformation
                              ↓
                         Transactional Persistence
```

---

## File Upload & Mapping

### File Requirements
- **Format:** `.xlsx` or `.xls`
- **Size Limit:** Configurable (default: 10MB)
- **Structure:** First row must be headers, data starts from row 2

### Mapping Structure
The frontend provides a JSON mapping of internal field names to Excel column headers:

```json
{
  "sku": "Product SKU",
  "name": "Product Name",
  "family": "Product Family",
  "price": "Price [Decimal]",
  "description": "Long Description",
  "inStock": "In Stock [Boolean]"
}
```

**Standard Fields:**
- `sku` - Product SKU (required)
- `name` - Product name (required)
- `productLink` - Product URL (optional)
- `imageUrl` - Product image URL (optional)
- `subImages` - Additional images (optional)
- `category` - Category name (optional)
- `family` - Family name (optional, can be empty)
- `parentSku` - Parent product SKU for variants (optional)

**Custom Attributes:**
Any field not in the standard list is treated as a custom attribute.

---

## Header Processing and Type Inference

### Explicit Type Annotations

Headers can include explicit data types in brackets:

```
Price [Decimal]
Stock Count [Number]
Description [Long Text]
Is Active [Boolean]
Launch Date [Date]
Product Name [Short Text]
```

**Supported Types:**
- `[Short Text]` - Text up to 255 characters → `STRING`
- `[Long Text]` - Text over 255 characters → `TEXT`
- `[Number]` - Integer values → `INTEGER`
- `[Decimal]` - Decimal values → `DECIMAL`
- `[Date]` - Date values → `DATE`
- `[Boolean]` - True/false values → `BOOLEAN`

### Automatic Type Inference

If no type is specified, the system infers the type from the **first data row**:

**Inference Rules:**

1. **Boolean Detection:**
   - `true`, `false` (case-insensitive)
   - `yes`, `no`
   - `1`, `0` (as strings)

2. **Date Detection:**
   - Excel date serial numbers (25569-73050)
   - ISO format: `2024-01-15`
   - Common formats: `01/15/2024`, `15-01-2024`

3. **Number Detection:**
   - Integer: `42`, `100`, `-5`
   - Decimal: `3.14`, `99.99`, `0.5`

4. **Text Detection:**
   - Long Text: Strings > 255 characters
   - Short Text: All other strings (default)

**Example:**

| Column Header | First Row Value | Inferred Type |
|--------------|----------------|---------------|
| SKU | "PROD-001" | Short Text |
| Price | 29.99 | Decimal |
| Stock | 100 | Number |
| Active | true | Boolean |
| Launch Date | 44927 | Date |
| Description | "A very long description..." | Long Text |

---

## Family-Level Attribute Handling

### Concept

When a **Family** column is mapped and has values, the system:
1. Identifies all distinct families in the import
2. For each family, uses the **first row** with that family as a reference
3. Determines required vs optional attributes based on that first row

**Important:** Family is completely optional. Products can be created without a family assignment.

### Rules

**For each family:**
- **Attribute with value in first row** → Marked as REQUIRED (for reference tracking)
- **Attribute without value in first row** → Marked as OPTIONAL
- Only attributes present in the user's mapping are considered
- **Important:** Even "required" attributes can be empty in any row - no validation errors
- The required/optional marking is for organizational purposes and family structure tracking

### Example

**Excel Data:**
```
| SKU      | Name      | Family    | Color | Size | Material |
|----------|-----------|-----------|-------|------|----------|
| SHIRT-01 | T-Shirt   | Clothing  | Red   | M    |          |
| SHIRT-02 | T-Shirt   | Clothing  | Blue  |      | Cotton   |
| SHOE-01  | Sneakers  | Footwear  | White | 42   | Leather  |
```

**Family Definitions Created:**

**Clothing Family (reference: row 2):**
- Color: **REQUIRED** (has value "Red" in first row)
- Size: **REQUIRED** (has value "M" in first row)
- Material: **OPTIONAL** (empty in first row)

**Footwear Family (reference: row 4):**
- Color: **REQUIRED** (has value "White" in first row)
- Size: **REQUIRED** (has value "42" in first row)
- Material: **REQUIRED** (has value "Leather" in first row)

**Validation Results:**
- Row 2: ✅ Valid (all required attributes present)
- Row 3: ✅ Valid (Size can be empty - required attributes are not enforced)
- Row 4: ✅ Valid (all required attributes present)

**Note:** The "required" designation is for tracking family structure, not for validation enforcement.

### Database Impact

Family attribute definitions are **automatically synchronized** to the database:
- Creates `FamilyAttribute` records with `isRequired` flag
- Updates existing family definitions
- Maintains referential integrity

---

## Row-Level Validation

Each row is validated against comprehensive rules:

### Required Field Validation

**SKU:**
- Must be present
- Length: 4-40 characters
- Unique within user's products (upsert handles conflicts)

**Name:**
- Must be present
- Length: 1-100 characters

**Family (Optional):**
- Can be empty or omitted
- If provided and not found in database, product will be created without family
- No validation errors for empty or missing family

### Type Validation

Values are validated and converted according to their inferred/explicit type:

**Boolean:**
- Valid: `true`, `false`, `yes`, `no`, `1`, `0`
- Invalid: Any other string

**Number:**
- Valid: Integer values
- Invalid: Decimals, non-numeric strings

**Decimal:**
- Valid: Numeric values with or without decimal point
- Invalid: Non-numeric strings

**Date:**
- Valid: Excel serial numbers, ISO dates, common date formats
- Invalid: Non-parseable strings

**Text:**
- Valid: Any string
- Length check for Short Text (≤255 chars)

### URL Validation

For `productLink` and `imageUrl` fields:
- Must be valid URLs with protocol
- Examples: `https://example.com`, `http://cdn.example.com/image.jpg`

### Family Attribute Validation

If a family is assigned:
- Family attributes are tracked based on first row definitions
- **Required** and **Optional** designations are for organizational purposes only
- All family attributes (required or optional) can be empty without validation errors
- Type validation applies only to non-empty attribute values

### Error Collection

All validation errors are collected with:
- **Row number** (Excel row, 1-indexed including header)
- **Field name**
- **Error message**
- **Actual value** (for debugging)

---

## Mapping to Domain Model

Valid rows are transformed into `CreateProductDto` objects:

### Type Conversions

**Date Conversion:**
```typescript
// Excel serial number
44927 → "2023-01-15T00:00:00.000Z"

// String date
"2023-01-15" → "2023-01-15T00:00:00.000Z"
```

**Number Conversion:**
```typescript
// Integer
"100" → 100

// Decimal
"29.99" → 29.99
```

**Boolean Conversion:**
```typescript
"true" → true
"yes" → true
"1" → true
"false" → false
"no" → false
"0" → false
```

### DTO Structure

```typescript
{
  sku: "PROD-001",
  name: "Product Name",
  productLink: "https://example.com",
  imageUrl: "https://cdn.example.com/image.jpg",
  familyId: 5,
  
  // Family attributes (linked to family)
  familyAttributesWithValues: [
    { attributeId: 10, value: "Red" },
    { attributeId: 11, value: "M" }
  ],
  
  // Custom attributes (not in family)
  attributesWithValues: [
    { attributeId: 20, value: "Premium" },
    { attributeId: 21, value: "100" }
  ],
  
  updateExisting: true // Enables upsert behavior
}
```

### Attribute Auto-Creation

If a custom attribute doesn't exist:
- System automatically creates it
- Uses inferred/explicit type from header
- Assigns to current user

---

## Persistence and Transactions

### Upsert Logic

The system uses **upsert** (update or insert) based on SKU:
- If SKU exists: **Update** existing product
- If SKU doesn't exist: **Create** new product

### Batch Processing

Products are persisted in batches for performance:
- **Batch size:** 50 products (configurable)
- **Progress updates** after each batch
- **Failure isolation:** One row failure doesn't affect others

### Transaction Handling

**Per-Product Transactions:**
- Each product upsert is wrapped in a transaction
- Rollback on error (constraint violations, database errors)
- Maintains data integrity

**No Cross-Product Transactions:**
- Products are independent
- Partial success is allowed
- Failed products are reported in error list

### Soft Delete Handling

If a product with same SKU is soft-deleted:
- Product is **restored** (isDeleted = false)
- All fields are updated with new values
- Maintains historical data (audit trail)

---

## Error Handling and Reporting

### Error Types

**1. Parse Errors:**
```json
{
  "message": "Failed to parse Excel file",
  "status": "error"
}
```

**2. Validation Errors:**
```json
{
  "row": 5,
  "error": "name: Required field \"name\" is missing; price: Invalid value for type DECIMAL"
}
```

**3. Persistence Errors:**
```json
{
  "row": 10,
  "error": "Family \"NonExistent\" not found"
}
```

**4. Database Errors:**
```json
{
  "row": 15,
  "error": "Foreign key constraint failed"
}
```

### Response Format

**Success Response:**
```json
{
  "totalRows": 100,
  "successCount": 95,
  "failedRows": [
    { "row": 5, "error": "Missing required field: SKU" },
    { "row": 10, "error": "Invalid URL format for productLink" },
    { "row": 23, "error": "Required attribute Color is missing" },
    { "row": 45, "error": "Invalid date format" },
    { "row": 78, "error": "Family \"Invalid\" not found" }
  ],
  "familyDefinitions": [
    {
      "familyId": 5,
      "familyName": "Clothing",
      "attributes": [
        { "attributeName": "Color", "isRequired": true, "referenceRow": 2 },
        { "attributeName": "Size", "isRequired": true, "referenceRow": 2 },
        { "attributeName": "Material", "isRequired": false, "referenceRow": 2 }
      ]
    }
  ]
}
```

### Progress Tracking (SSE)

For large imports with progress tracking:

```json
{
  "processed": 50,
  "total": 100,
  "successCount": 48,
  "failedCount": 2,
  "percentage": 50,
  "status": "processing",
  "message": "Persisting products: 48/50 successful..."
}
```

**Status Values:**
- `processing` - Import in progress
- `completed` - Import finished successfully
- `error` - Critical error occurred

---

## Security Checks

### File Validation

**Type Check:**
```typescript
const allowedMimeTypes = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel'
];
```

**Size Check:**
```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
```

### Input Sanitization

**String Fields:**
- Trim whitespace
- Remove control characters
- Escape special characters for database

**URL Validation:**
- Protocol required (http/https)
- Valid domain format
- No script injection

### User Permissions

**Product Access:**
- All products must belong to current user
- Family validation against user's families
- Attribute validation against user's attributes

**Rate Limiting:**
- Maximum imports per user per hour
- Concurrent import limit per user

### SQL Injection Prevention

- Parameterized queries (Prisma)
- No raw SQL with user input
- ORM-level protection

---

## Testing Guidelines

### Unit Tests

**Type Inference Tests:**
```typescript
describe('Type Inference', () => {
  it('should infer boolean from "true"', () => {
    expect(inferTypeFromValue('true')).toBe(AttributeDataType.BOOLEAN);
  });
  
  it('should infer decimal from 3.14', () => {
    expect(inferTypeFromValue(3.14)).toBe(AttributeDataType.DECIMAL);
  });
  
  it('should infer number from 42', () => {
    expect(inferTypeFromValue(42)).toBe(AttributeDataType.NUMBER);
  });
  
  it('should infer date from Excel serial', () => {
    expect(inferTypeFromValue(44927)).toBe(AttributeDataType.DATE);
  });
});
```

**Validation Tests:**
```typescript
describe('Row Validation', () => {
  it('should reject missing SKU', async () => {
    const result = await validateRow({ name: 'Product' }, 2, context);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'sku', message: expect.stringContaining('required') })
    );
  });
  
  it('should reject invalid URL', async () => {
    const result = await validateRow({ 
      sku: 'PROD-001', 
      name: 'Product', 
      productLink: 'invalid-url' 
    }, 2, context);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'productLink' })
    );
  });
});
```

### Integration Tests

**Full Import Pipeline:**
```typescript
describe('Excel Import Integration', () => {
  it('should import valid products successfully', async () => {
    const result = await excelImportService.processExcelImport(
      validExcelBuffer,
      validMapping,
      testUserId
    );
    
    expect(result.successCount).toBe(5);
    expect(result.failedRows).toHaveLength(0);
  });
  
  it('should handle family attribute requirements', async () => {
    const result = await excelImportService.processExcelImport(
      familyExcelBuffer,
      familyMapping,
      testUserId
    );
    
    expect(result.familyDefinitions).toHaveLength(2);
    expect(result.familyDefinitions[0].attributes.filter(a => a.isRequired)).toHaveLength(3);
  });
});
```

### Test Cases

**Valid Import Scenarios:**
- ✅ All required fields present
- ✅ All types valid
- ✅ Family attributes satisfied
- ✅ URLs properly formatted
- ✅ Large file (1000+ rows)

**Invalid Data Scenarios:**
- ❌ Missing SKU
- ❌ Missing Name
- ❌ Invalid type values
- ❌ Invalid URLs
- ❌ Duplicate SKUs (should upsert)

**Edge Cases:**
- Empty optional fields
- Very long text (>255 chars)
- Special characters in text
- Multiple families in same import
- Products without family
- Custom attributes only

**Error Recovery:**
- Partial row failures
- Database constraint violations
- Network interruptions
- Concurrent imports

### Mock Database

Use Prisma mock for isolated tests:
```typescript
const mockPrisma = {
  product: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  family: {
    findFirst: jest.fn(),
  },
  attribute: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
};
```

---

## Examples

### Example 1: Basic Product Import

**Excel File:**
```
| SKU      | Name        | Price [Decimal] | Stock [Number] |
|----------|-------------|-----------------|----------------|
| PROD-001 | Widget A    | 19.99           | 100            |
| PROD-002 | Widget B    | 29.99           | 50             |
| PROD-003 | Widget C    | 39.99           | 25             |
```

**Mapping:**
```json
{
  "sku": "SKU",
  "name": "Name",
  "price": "Price [Decimal]",
  "stock": "Stock [Number]"
}
```

**Result:**
- 3 products created
- `price` and `stock` created as custom attributes
- Types: `price` = DECIMAL, `stock` = NUMBER

### Example 2: Family-Based Import

**Excel File:**
```
| SKU      | Name      | Family   | Color | Size | Material |
|----------|-----------|----------|-------|------|----------|
| SHIRT-01 | T-Shirt   | Clothing | Red   | M    |          |
| SHIRT-02 | T-Shirt   | Clothing | Blue  | L    | Cotton   |
| SHOE-01  | Sneakers  | Footwear | Black | 42   | Leather  |
```

**Mapping:**
```json
{
  "sku": "SKU",
  "name": "Name",
  "family": "Family",
  "Color": "Color",
  "Size": "Size",
  "Material": "Material"
}
```

**Family Definitions:**
```
Clothing (based on SHIRT-01):
  - Color: REQUIRED (has value)
  - Size: REQUIRED (has value)
  - Material: OPTIONAL (empty)

Footwear (based on SHOE-01):
  - Color: REQUIRED (has value)
  - Size: REQUIRED (has value)
  - Material: REQUIRED (has value)
```

**Result:**
- SHIRT-01: ✅ Valid
- SHIRT-02: ✅ Valid (Size empty is allowed even though marked as required)
- SHOE-01: ✅ Valid

**Note:** All products are valid because required attributes can be empty.

### Example 3: Type Inference

**Excel File:**
```
| SKU      | Name    | Launch Date | Active | Weight | Description            |
|----------|---------|-------------|--------|--------|------------------------|
| PROD-001 | Product | 2024-01-15  | true   | 2.5    | Short description      |
| PROD-002 | Product | 44927       | yes    | 3      | A very long description that exceeds 255 characters... |
```

**Inferred Types:**
- Launch Date: **DATE** (ISO format detected)
- Active: **BOOLEAN** (true/yes detected)
- Weight: **DECIMAL** (2.5 has decimal point)
- Description: **LONG_TEXT** (row 3 exceeds 255 chars)

### Example 4: Error Handling

**Excel File:**
```
| SKU      | Name    | Price [Decimal] | Product Link         |
|----------|---------|-----------------|----------------------|
| PROD-001 | Product | 19.99           | https://example.com  |
|          | Product | invalid-price   | not-a-url            |
| PROD-003 |         | 39.99           | https://example.com  |
```

**Errors:**
```json
[
  {
    "row": 3,
    "error": "sku: Required field \"sku\" is missing; price: Invalid value for type DECIMAL; productLink: Product link must be a valid URL"
  },
  {
    "row": 4,
    "error": "name: Required field \"name\" is missing"
  }
]
```

**Result:**
- Row 2: ✅ Created
- Row 3: ❌ Multiple validation errors
- Row 4: ❌ Missing required field

---

## API Endpoints

### Import Excel (with Progress)

**Endpoint:** `POST /api/products/import/excel/progress`

**Request:**
```http
POST /api/products/import/excel/progress
Content-Type: multipart/form-data

file: [Excel file]
mapping: {
  "sku": "SKU",
  "name": "Product Name",
  "family": "Family",
  "price": "Price [Decimal]"
}
```

**Response:**
```json
{
  "sessionId": "abc123..."
}
```

**Progress Stream:** `GET /api/products/import/excel/progress/:sessionId`

Returns SSE stream with progress updates.

### Import Excel (without Progress)

**Endpoint:** `POST /api/products/import/excel`

**Request:** Same as above

**Response:**
```json
{
  "totalRows": 100,
  "successCount": 95,
  "failedRows": [
    { "row": 5, "error": "..." }
  ]
}
```

---

## Troubleshooting

### Common Issues

**Issue:** "Invalid type for DECIMAL"
- **Cause:** Non-numeric value in decimal column
- **Solution:** Fix data or change type annotation

**Issue:** "SKU must be between 4 and 40 characters"
- **Cause:** SKU too short or too long
- **Solution:** Adjust SKU format

### Debug Mode

Enable detailed logging:
```typescript
// In product.service.ts
this.logger.setLogLevel('debug');
```

Logs include:
- Parsed headers with types
- Family definitions
- Validation errors per row
- Persistence results

---

## Best Practices

1. **Always test with small sample first** (10-20 rows)
2. **Use explicit type annotations** for clarity
3. **Define families in database before import**
4. **Review family definitions** after first row
5. **Handle errors incrementally** - fix and re-import failed rows
6. **Use consistent data formats** (dates, booleans)
7. **Validate URLs** before import
8. **Keep SKUs unique and consistent**
9. **Document your mapping** for team members
10. **Monitor import logs** for issues

---

## Future Enhancements

- [ ] Template download for Excel format
- [ ] Dry-run mode (validate without persisting)
- [ ] Column auto-mapping (intelligent suggestions)
- [ ] Multi-sheet support
- [ ] Import history and rollback
- [ ] Scheduled imports
- [ ] CSV support with same features
- [ ] Custom validation rules
- [ ] Duplicate detection strategies
- [ ] Import from URLs

---

## Support

For issues or questions:
- Check error messages in response
- Review validation logs
- Consult this guide
- Contact development team

**Version:** 1.0.0  
**Last Updated:** November 19, 2025
