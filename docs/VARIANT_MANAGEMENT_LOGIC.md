# Variant Management Logic Implementation

This document describes the enhanced variant management logic implemented in the ProductService to handle product-variant relationships, family inheritance, and attribute merging.

## Overview

The system now implements comprehensive logic for managing product variants with the following key features:

1. **Automatic Family Inheritance**: When a product becomes a variant, it inherits the parent's family
2. **Smart Attribute Merging**: Variant attributes are merged with parent attributes (variant takes priority)
3. **Automatic Variant Unlinking**: When a parent is deleted, variants are automatically unlinked

## Implementation Details

### 1. Family Inheritance (`inheritFamilyFromParent`)

**When**: Triggered during product creation or update when a `parentSku` or `parentProductId` is set.

**Logic**:
- When a product is converted to a variant (by setting parentSku/parentProductId):
  - The variant **always** inherits the parent's family, even if it had a different family before
  - This ensures all variants of a parent share the same family structure
  - If the parent has no family, no changes are made to the variant's family

**Validation**:
- Prevents variants from being used as parents (no nested variants)
- Validates parent product exists and belongs to the user

**Example**:
```typescript
// Parent Product: Has Family "Electronics"
// Variant Product: Previously had Family "Gadgets"
// After linking: Variant now has Family "Electronics"
```

### 2. Attribute Merging (`mergeCustomAttributes`)

**When**: Triggered during product creation or update when a `parentSku` or `parentProductId` is set.

**Logic**:
- Merges parent's attributes into the variant using priority-based logic:
  1. **Variant has attribute with value**: Keep variant's value (variant priority)
  2. **Variant has attribute without value**: Use parent's value
  3. **Variant doesn't have attribute**: Copy attribute from parent with parent's value

**Behavior**:
- Idempotent: Running multiple times produces the same result
- Preserves variant-specific customizations
- Automatically updates familyAttributeId references
- Recalculates product status after merging

**Example**:
```typescript
// Parent Attributes:
// - color: "Blue"
// - size: "Medium"
// - material: "Cotton"

// Variant Attributes (before merge):
// - color: "Red" (has value)
// - size: "" (no value)
// (doesn't have material)

// Variant Attributes (after merge):
// - color: "Red" (kept - variant priority)
// - size: "Medium" (inherited from parent)
// - material: "Cotton" (copied from parent)
```

### 3. Variant Unlinking (`unlinkVariantsOnDelete`)

**When**: Triggered automatically when a parent product is deleted.

**Logic**:
- Finds all variants of the deleted parent
- Sets their `parentProductId` to `null`
- Converts them to standalone products instead of leaving them orphaned
- Logs all unlinked variants for audit trail

**Example**:
```typescript
// Before deletion:
// Parent: SKU-PARENT (has 3 variants)
// Variant 1: SKU-VAR-1 (parentProductId: Parent.id)
// Variant 2: SKU-VAR-2 (parentProductId: Parent.id)
// Variant 3: SKU-VAR-3 (parentProductId: Parent.id)

// After parent deletion:
// Variant 1: SKU-VAR-1 (parentProductId: null) - Standalone
// Variant 2: SKU-VAR-2 (parentProductId: null) - Standalone
// Variant 3: SKU-VAR-3 (parentProductId: null) - Standalone
```

### 4. Bulk Variant Updates (`updateVariantsFamilyAndAttributes`)

**When**: Triggered when a parent product's family is updated.

**Logic**:
- Finds all variants of the parent
- Updates each variant's family to match the parent
- Re-merges attributes for each variant
- Ensures all variants stay synchronized with parent

**Example**:
```typescript
// Scenario: Parent's family changes from "Electronics" to "Smart Devices"
// Action: All variants automatically update to "Smart Devices" family
// Result: All variants inherit new family attributes and merge with existing
```

## Integration Points

### Product Creation (`create` method)
```typescript
// After product is created with parentSku
if (parentProductId) {
  await this.inheritFamilyFromParent(product.id, parentProductId, userId);
  await this.mergeCustomAttributes(product.id, parentProductId, userId);
}
```

### Product Update (`update` method)
```typescript
// When parentProductId is set
if (parentProductId !== null) {
  await this.inheritFamilyFromParent(id, parentProductId, userId);
  await this.mergeCustomAttributes(id, parentProductId, userId);
}

// When parent's family is updated
if (updateProductDto.familyId !== undefined) {
  await this.updateVariantsFamilyAndAttributes(id, userId);
}
```

### Product Deletion (`remove` method)
```typescript
// Before deleting the product
await this.unlinkVariantsOnDelete(id, userId);
await this.prisma.product.delete({ where: { id } });
```

## Error Handling

All helper methods include comprehensive error handling:
- **Database errors**: Logged with full stack trace
- **Validation errors**: Clear error messages for invalid operations
- **Missing entities**: Proper NotFound exceptions
- **Permission errors**: BadRequest exceptions for ownership violations

## Logging

Each operation is logged at multiple levels:
- **Info**: Start/completion of operations with key details
- **Debug**: Detailed attribute operations (merge, copy, keep)
- **Warn**: Potential issues or data anomalies
- **Error**: Failures with full context

Example log output:
```
[inheritFamilyFromParent] Variant 123 now has family 5 from parent
[mergeCustomAttributes] Completed for variant 123: 3 added, 2 merged, 5 kept (variant priority)
[unlinkVariantsOnDelete] Successfully unlinked 4 variants from parent 100
```

## API Usage Examples

### Creating a Variant with Excel Import
```json
POST /products
{
  "name": "T-Shirt - Red Small",
  "sku": "TSH-001",
  "parentSku": "TSH-PARENT",
  "attributesWithValues": [
    { "attributeId": 10, "value": "Red" },
    { "attributeId": 11, "value": "Small" }
  ]
}
```
Result: Variant inherits parent's family and merges attributes automatically.

### Converting Product to Variant
```json
PATCH /products/123
{
  "parentSku": "PARENT-SKU"
}
```
Result: Product 123 becomes a variant, inherits family, and merges attributes.

### Updating Parent Family
```json
PATCH /products/100
{
  "familyId": 5
}
```
Result: All variants of product 100 update to family 5 and re-merge attributes.

### Deleting Parent Product
```json
DELETE /products/100
```
Result: All variants are unlinked (parentProductId set to null) before parent is deleted.

## Benefits

1. **Data Consistency**: All variants stay synchronized with their parent
2. **Flexibility**: Variants can have custom values that override parent
3. **Safety**: Deleting parents doesn't orphan variants
4. **Idempotency**: Operations can be repeated safely
5. **Audit Trail**: Comprehensive logging of all operations
6. **Error Recovery**: Clear error messages and proper exception handling

## Future Enhancements

Potential improvements for future versions:
1. Batch variant operations for performance
2. Variant inheritance rules configuration
3. Attribute conflict resolution strategies
4. Undo/redo for variant operations
5. Variant comparison and diff views
