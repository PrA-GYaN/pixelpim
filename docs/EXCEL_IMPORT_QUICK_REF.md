# Excel Import - Quick Reference

## Overview
Comprehensive Excel import pipeline with automatic type inference, family-level attribute management, and detailed validation.

## Key Features
✅ Header type inference (explicit or automatic)  
✅ Family-based attribute requirements  
✅ Row-level validation with detailed errors  
✅ Transactional persistence with upsert  
✅ Progress tracking for large imports  
✅ Comprehensive error reporting  

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         IMPORT PIPELINE                           │
└──────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │  1. HEADER PROCESSING     │
                    │  - Extract explicit types │
                    │  - Infer from first row   │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │  2. FAMILY DEFINITIONS    │
                    │  - Identify families      │
                    │  - First row = reference  │
                    │  - Mark required/optional │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │  3. ROW VALIDATION        │
                    │  - Required fields        │
                    │  - Type checking          │
                    │  - Family requirements    │
                    │  - URL validation         │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │  4. DOMAIN MAPPING        │
                    │  - CreateProductDto       │
                    │  - Type conversion        │
                    │  - Attribute linking      │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │  5. PERSISTENCE           │
                    │  - Batch processing       │
                    │  - Upsert by SKU          │
                    │  - Transaction per row    │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │  6. REPORTING             │
                    │  - Success count          │
                    │  - Error details          │
                    │  - Family definitions     │
                    └───────────────────────────┘
```

## Type Annotations

### Explicit Types in Headers
```
Price [Decimal]          → DECIMAL
Stock Count [Number]     → INTEGER
Description [Long Text]  → TEXT
Is Active [Boolean]      → BOOLEAN
Launch Date [Date]       → DATE
Product Name [Short Text]→ STRING
```

### Automatic Type Inference
| Value Example | Inferred Type |
|---------------|---------------|
| `"true"`, `"yes"`, `1` | BOOLEAN |
| `44927` (Excel date) | DATE |
| `"2024-01-15"` | DATE |
| `42`, `100` | NUMBER |
| `3.14`, `99.99` | DECIMAL |
| `"Short text"` | SHORT_TEXT |
| `"Very long text..."` (>255) | LONG_TEXT |

## Family Attribute Rules

### First Row Determines Requirements

**Excel Data:**
```
| SKU      | Family   | Color | Size | Material |
|----------|----------|-------|------|----------|
| SHIRT-01 | Clothing | Red   | M    |          | ← First row
| SHIRT-02 | Clothing | Blue  | L    | Cotton   |
```

**Result:**
- **Clothing Family:**
  - Color: REQUIRED (has "Red")
  - Size: REQUIRED (has "M")
  - Material: OPTIONAL (empty)

**Note:** "Required" designation is for tracking only - all attributes can be empty without validation errors.

### Validation
- Row 2: ✅ Color ✓, Size ✓, Material optional
- Row 3: ✅ All attributes can be empty (no validation errors)

## Validation Rules

### Required Fields
| Field | Rules |
|-------|-------|
| SKU | Required, 4-40 chars, unique |
| Name | Required, 1-100 chars |
| Family | Optional, can be empty or omitted |
| Product Link | Optional, valid URL |
| Image URL | Optional, valid URL |

### Type Validation
| Type | Valid Examples | Invalid Examples |
|------|----------------|------------------|
| Boolean | `true`, `false`, `yes`, `no`, `1`, `0` | `"maybe"`, `"N/A"` |
| Number | `42`, `100`, `-5` | `"3.14"`, `"text"` |
| Decimal | `3.14`, `99.99`, `0.5` | `"text"` |
| Date | `"2024-01-15"`, `44927` | `"invalid"` |
| Text | Any string | - |

### Family Validation
- All REQUIRED attributes must have values
- OPTIONAL attributes can be empty
- Type validation applies to all values

## Mapping Format

```json
{
  "sku": "Product SKU",
  "name": "Product Name",
  "family": "Product Family",
  "productLink": "URL",
  "imageUrl": "Image",
  "price": "Price [Decimal]",
  "stock": "Stock [Number]",
  "active": "Is Active [Boolean]",
  "description": "Description [Long Text]"
}
```

**Standard fields:** sku, name, family, productLink, imageUrl, subImages, category, parentSku  
**Custom attributes:** Everything else

## Response Format

### Success
```json
{
  "totalRows": 100,
  "successCount": 95,
  "failedRows": [
    { "row": 5, "error": "SKU: Required field is missing" },
    { "row": 23, "error": "Color: Required family attribute is missing" }
  ],
  "familyDefinitions": [
    {
      "familyId": 5,
      "familyName": "Clothing",
      "attributes": [
        { "attributeName": "Color", "isRequired": true, "referenceRow": 2 },
        { "attributeName": "Size", "isRequired": true, "referenceRow": 2 }
      ]
    }
  ]
}
```

### Progress Stream (SSE)
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

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid type for DECIMAL" | Non-numeric value | Fix data or type |
| "SKU must be 4-40 characters" | SKU too short/long | Adjust SKU |
| "Invalid URL" | Malformed URL | Add protocol (http://) |

## Code Files

### Core Implementation
- **excel-parser.ts** - Header processing, type inference
- **excel-import.service.ts** - Family definitions, validation, transformation
- **product.service.ts** - Persistence, integration

### Key Functions
```typescript
// Type inference
inferTypeFromValue(value: any): AttributeDataType

// Family definitions
buildFamilyAttributeDefinitions(rows, context): Promise<void>

// Row validation
validateAndTransformRow(row, rowNumber, context): Promise<{dto, errors}>

// Type conversion
convertValueToType(value: any, dataType: AttributeDataType): any
```

## Testing Checklist

### Valid Scenarios
- ✅ All required fields present
- ✅ Explicit type annotations work
- ✅ Auto type inference correct
- ✅ Family attributes satisfied
- ✅ URLs properly formatted
- ✅ Large files (1000+ rows)

### Invalid Scenarios
- ❌ Missing SKU/Name
- ❌ Wrong type values
- ❌ Missing required family attrs
- ❌ Invalid URLs
- ❌ SKU length violations

### Edge Cases
- Empty optional fields
- Multiple families
- No family assigned
- Custom attributes only
- Very long text (>255)

## API Usage

### Import with Progress
```bash
curl -X POST http://localhost:3000/api/products/import/excel/progress \
  -H "Authorization: Bearer <token>" \
  -F "file=@products.xlsx" \
  -F 'mapping={"sku":"SKU","name":"Name","family":"Family"}'
```

**Response:** `{ "sessionId": "abc123..." }`

**Stream:** `GET /api/products/import/excel/progress/:sessionId`

### Import without Progress
```bash
curl -X POST http://localhost:3000/api/products/import/excel \
  -H "Authorization: Bearer <token>" \
  -F "file=@products.xlsx" \
  -F 'mapping={"sku":"SKU","name":"Name"}'
```

## Best Practices

1. ✅ Test with 10-20 rows first
2. ✅ Use explicit type annotations for clarity
3. ✅ Family is optional - products can be created without it
4. ✅ Review family definitions after first row (if using families)
5. ✅ Use consistent date/boolean formats
6. ✅ Validate URLs before import
7. ✅ Keep SKUs unique
8. ✅ Monitor import logs
9. ✅ Handle errors incrementally
10. ✅ Document your mapping

## Security Features

- ✅ File type validation (.xlsx, .xls only)
- ✅ File size limits (10MB default)
- ✅ User permission checks
- ✅ SQL injection prevention (Prisma ORM)
- ✅ XSS prevention (string sanitization)
- ✅ URL validation
- ✅ Rate limiting

## Performance

- Batch processing: 50 products per batch
- Progress updates after each batch
- Partial failure allowed
- Transaction per product
- Efficient database queries
- Family attribute caching (5 min TTL)

## Module Structure

```
PixelPim_backend/src/
├── utils/
│   └── excel-parser.ts          # Header parsing, type inference
├── product/
│   ├── services/
│   │   └── excel-import.service.ts  # Validation, transformation
│   ├── product.service.ts       # Persistence integration
│   ├── product.module.ts        # Module registration
│   └── dto/
│       └── create-product.dto.ts    # Domain models
└── docs/
    ├── EXCEL_IMPORT_GUIDE.md    # Comprehensive guide
    └── EXCEL_IMPORT_QUICK_REF.md # This document
```

## Example Excel File

```
┌───────────┬──────────┬──────────┬─────────────┬───────────────┬──────────────┐
│ SKU       │ Name     │ Family   │ Color       │ Size [Number] │ Active [Bool]│
├───────────┼──────────┼──────────┼─────────────┼───────────────┼──────────────┤
│ SHIRT-001 │ T-Shirt  │ Clothing │ Red         │ 42            │ true         │ ← First row
│ SHIRT-002 │ T-Shirt  │ Clothing │ Blue        │ 44            │ yes          │
│ SHOE-001  │ Sneakers │ Footwear │ Black       │ 42            │ 1            │ ← First row
└───────────┴──────────┴──────────┴─────────────┴───────────────┴──────────────┘

Results:
- Clothing: Color REQUIRED, Size REQUIRED, Active REQUIRED
- Footwear: Color REQUIRED, Size REQUIRED, Active REQUIRED
- All 3 rows: ✅ Valid
```

## Quick Debug

### Enable Debug Logging
```typescript
// In product.service.ts constructor
this.logger = new Logger(ProductService.name);
```

### Check Logs For
- Parsed headers with types
- Family definitions
- Validation errors per row
- Persistence results

### Common Log Messages
```
✅ "Parsed 100 rows with 8 columns"
✅ "Family 'Clothing' (ID: 5): 3 attributes (2 required, 1 optional)"
✅ "Excel validation complete: 95 valid rows, 5 validation failures"
❌ "Failed to persist row 23: Required attribute Color is missing"
```

---

**For detailed documentation, see:** [EXCEL_IMPORT_GUIDE.md](./EXCEL_IMPORT_GUIDE.md)

**Version:** 1.0.0  
**Last Updated:** November 19, 2025
