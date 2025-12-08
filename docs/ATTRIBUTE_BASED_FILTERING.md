# Attribute-Based Product Filtering

## Overview

This feature allows users to filter products based on attributes they have created. Products are returned if they contain **any** of the selected attributes, making it easy to find products with specific characteristics.

## Key Features

1. **Multiple Attribute Selection**: Users can select multiple attributes to filter by
2. **Inclusive Filtering**: Products are shown if they contain ANY of the selected attributes (OR logic)
3. **Dynamic Attribute Support**: Works with any user-created attributes
4. **Combined with Other Filters**: Can be used alongside search, category, family, and other filters

## Backend Implementation

### API Endpoint

```
GET /products?attributeIds=1,2,3
```

### Query Parameters

- `attributeIds` (string): Comma-separated list of attribute IDs to filter by

### Database Query

The backend uses Prisma's `some` operator to check if a product has any of the specified attributes:

```typescript
whereCondition.attributes = {
  some: {
    attributeId: {
      in: attributeIds,
    },
  },
};
```

This translates to: "Return products that have at least one ProductAttribute entry with an attributeId in the provided list."

### Example Requests

**Filter by single attribute:**
```
GET /products?attributeIds=5
```

**Filter by multiple attributes:**
```
GET /products?attributeIds=5,10,15
```

**Combine with other filters:**
```
GET /products?attributeIds=5,10&status=complete&familyId=2
```

## Frontend Implementation

### FilterContext

The `ProductFilters` interface includes:
```typescript
attributeIds?: number[];
```

### FilterData Component

A new "Attributes" filter panel has been added with:
- Multi-select dropdown for attribute selection
- Search functionality to find attributes by name
- Visual indication of selected attribute count
- Tooltip explaining the filter behavior

### Product Hook

The `useProductsWithAttributes` hook passes the `attributeIds` array directly to the API:
```typescript
if (filters.attributeIds && filters.attributeIds.length > 0) {
  apiParams.attributeIds = filters.attributeIds;
}
```

## How It Works

### Data Flow

1. **User selects attributes** in the FilterData component
2. **Filters are applied** via the FilterContext
3. **ProductsMain** component detects filter change
4. **useProductsWithAttributes** hook fetches products with the new filters
5. **Backend receives** comma-separated attributeIds
6. **Prisma query** finds products with matching attributes
7. **Results returned** to frontend and displayed

### Filter Logic

The filtering uses **OR logic** for attributes:
- Product A has attributes [1, 2, 3]
- Product B has attributes [2, 4, 5]
- Product C has attributes [6, 7, 8]

If user filters by attributes [2, 6]:
- Product A is returned (has attribute 2)
- Product B is returned (has attribute 2)
- Product C is returned (has attribute 6)

## Database Schema

The filtering relies on the `ProductAttribute` join table:

```prisma
model ProductAttribute {
  id               Int       @id @default(autoincrement())
  productId        Int
  attributeId      Int
  familyAttributeId Int?
  value            String?
  createdAt        DateTime  @default(now())

  product          Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  attribute        Attribute @relation(fields: [attributeId], references: [id], onDelete: Cascade)
  familyAttribute  FamilyAttribute? @relation(fields: [familyAttributeId], references: [id], onDelete: Cascade)

  @@unique([productId, attributeId])
}
```

## User Experience

### Selecting Attributes

1. Open the filter sidebar
2. Expand the "Attributes" panel
3. Click the dropdown to see all available attributes
4. Select one or more attributes
5. Click "Apply Filters"

### Viewing Results

- Products containing any of the selected attributes are displayed
- The filter count badge shows how many filters are active
- Active filter tags can be clicked to remove individual filters
- The "Clear all filters" button removes all filters at once

### Understanding Results

- Each product in the results has **at least one** of the selected attributes
- Products may have additional attributes beyond those selected
- Both custom attributes and family attributes are considered

## Benefits

1. **Flexible Product Discovery**: Find products by their characteristics
2. **User-Defined Criteria**: Works with any attributes the user creates
3. **Quick Filtering**: No need to navigate to individual attribute pages
4. **Combined Filtering**: Use with other filters for precise results

## Technical Details

### Performance Considerations

- Uses indexed database queries for fast filtering
- Pagination prevents loading too many results at once
- Debounced search prevents excessive API calls

### Compatibility

- Works with all attribute types (text, number, date, etc.)
- Compatible with family attributes and custom attributes
- Supports both required and optional attributes

## Example Use Cases

1. **Find products with specific features**: Filter by "Color" and "Size" attributes
2. **Inventory management**: Find products with "Stock Level" or "Warehouse Location" attributes
3. **Product categorization**: Filter by "Brand", "Material", or "Season" attributes
4. **Quality control**: Find products with "Inspected" or "Certified" attributes

## Future Enhancements

Potential improvements for future versions:

1. **AND logic option**: Filter for products that have ALL selected attributes
2. **Attribute value filtering**: Filter by specific attribute values
3. **Attribute type filtering**: Show only attributes of certain types
4. **Saved filter presets**: Save commonly used filter combinations
5. **Advanced attribute queries**: Range filtering for numeric attributes
