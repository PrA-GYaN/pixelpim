# Family Attribute Management Guide

This guide explains how to manage attribute values for products, specifically focusing on family attributes and regular product attributes.

## Overview

In the PixelPim system, there are two types of attributes that can be associated with products:

1. **Regular Product Attributes**: Attributes directly assigned to a product
2. **Family Attributes**: Attributes that belong to a product's family

## Creating Products with Attribute Values

### Create Product with Regular Attributes

```typescript
const createProductDto = {
  name: "Sample Product",
  sku: "SAMPLE-001",
  attributesWithValues: [
    { attributeId: 1, value: "Red" },
    { attributeId: 2, value: "Large" }
  ]
};
```

### Create Product with Family Attributes

```typescript
const createProductDto = {
  name: "Sample Product",
  sku: "SAMPLE-001",
  familyId: 5,
  familyAttributesWithValues: [
    { attributeId: 10, value: "Cotton" },
    { attributeId: 11, value: "Medium" }
  ]
};
```

### Create Product with Both Types

```typescript
const createProductDto = {
  name: "Sample Product",
  sku: "SAMPLE-001",
  familyId: 5,
  attributesWithValues: [
    { attributeId: 1, value: "Red" },      // Regular attribute
    { attributeId: 2, value: "Large" }     // Regular attribute
  ],
  familyAttributesWithValues: [
    { attributeId: 10, value: "Cotton" },  // Family attribute
    { attributeId: 11, value: "Medium" }   // Family attribute
  ]
};
```

## Updating Products with Attribute Values

### Update Product with Family Attributes

```typescript
const updateProductDto = {
  familyAttributesWithValues: [
    { attributeId: 10, value: "Polyester" },
    { attributeId: 11, value: "Large" }
  ]
};
```

### Update Product with Regular Attributes

```typescript
const updateProductDto = {
  attributesWithValues: [
    { attributeId: 1, value: "Blue" },
    { attributeId: 2, value: "Small" }
  ]
};
```

## Database Schema

### ProductAttribute Table
```sql
model ProductAttribute {
  id               Int       @id @default(autoincrement())
  productId        Int
  attributeId      Int
  familyAttributeId Int?      -- References FamilyAttribute.id for family attributes
  value            String?
  createdAt        DateTime  @default(now())
  
  product          Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  attribute        Attribute @relation(fields: [attributeId], references: [id], onDelete: Cascade)
  familyAttribute  FamilyAttribute? @relation(fields: [familyAttributeId], references: [id], onDelete: Cascade)
  
  @@unique([productId, attributeId])
}
```

## API Methods

### 1. Update Regular Product Attribute Values

For attributes that are directly assigned to a product (not from a family):

```typescript
await productService.updateProductAttributeValues(
  productId: number,
  attributeValues: { attributeId: number; value?: string }[],
  userId: number
): Promise<ProductResponseDto>
```

**Example:**
```typescript
await productService.updateProductAttributeValues(123, [
  { attributeId: 1, value: "Red" },
  { attributeId: 2, value: "Large" }
], userId);
```

### 2. Update Family Attribute Values

For attributes that belong to a product's family:

```typescript
await productService.updateProductFamilyAttributeValues(
  productId: number,
  familyAttributeValues: { attributeId: number; value?: string }[],
  userId: number
): Promise<ProductResponseDto>
```

**Example:**
```typescript
await productService.updateProductFamilyAttributeValues(123, [
  { attributeId: 10, value: "Cotton" },
  { attributeId: 11, value: "Medium" }
], userId);
```

**Important Notes:**
- The `attributeId` should be the ID of the actual attribute
- The method automatically finds the corresponding `familyAttributeId`
- Only attributes that belong to the product's family can be updated
- The product must have a family assigned

### 3. Get Regular Product Attribute Values

```typescript
await productService.getProductAttributeValues(
  productId: number,
  userId: number
): Promise<{
  attributeId: number;
  attributeName: string;
  attributeType: string;
  value: string | null;
  defaultValue: string | null;
}[]>
```

### 4. Get Family Attribute Values

```typescript
await productService.getProductFamilyAttributeValues(
  productId: number,
  userId: number
): Promise<{
  familyAttributeId: number;
  attributeId: number;
  attributeName: string;
  attributeType: string;
  isRequired: boolean;
  value: string | null;
  defaultValue: string | null;
}[]>
```

## How It Works Internally

### During Product Creation/Update:

#### For Regular Product Attributes:
1. Uses `attributesWithValues` field in the DTO
2. Creates/updates `ProductAttribute` records with:
   - `productId`: The product ID
   - `attributeId`: The attribute ID
   - `value`: The attribute value
   - `familyAttributeId`: `NULL`

#### For Family Attributes:
1. Uses `familyAttributesWithValues` field in the DTO
2. Validates that the product has a family
3. Validates that the provided attributes belong to the product's family
4. Creates/updates `ProductAttribute` records with:
   - `productId`: The product ID
   - `attributeId`: The attribute ID
   - `familyAttributeId`: The family attribute ID (from `FamilyAttribute` table)
   - `value`: The attribute value

## DTO Structure

### CreateProductDto / UpdateProductDto

```typescript
export class CreateProductDto {
  name: string;
  sku: string;
  familyId?: number;
  
  // Regular attributes with values
  attributesWithValues?: {
    attributeId: number;
    value?: string;
  }[];
  
  // Family attributes with values
  familyAttributesWithValues?: {
    attributeId: number;
    value?: string;
  }[];
  
  // ... other fields
}
```

## Database Operations

### Insert Family Attribute Value
```typescript
await this.prisma.productAttribute.upsert({
  where: {
    productId_attributeId: {
      productId: 123,
      attributeId: 456,
    },
  },
  update: {
    value: 'new value',
    familyAttributeId: 789, // The familyAttributeId
  },
  create: {
    productId: 123,
    attributeId: 456,
    familyAttributeId: 789,
    value: 'new value',
  },
});
```

### Insert Regular Attribute Value
```typescript
await this.prisma.productAttribute.upsert({
  where: {
    productId_attributeId: {
      productId: 123,
      attributeId: 456,
    },
  },
  update: {
    value: 'new value',
    // familyAttributeId remains NULL
  },
  create: {
    productId: 123,
    attributeId: 456,
    value: 'new value',
    // familyAttributeId is NULL by default
  },
});
```

## Error Handling

### Common Errors:

1. **Product not found**: Returns `NotFoundException`
2. **Product has no family** (for family attribute operations): Returns `BadRequestException`
3. **Attribute not in family** (for family attribute operations): Returns `BadRequestException`
4. **User doesn't own product**: Returns `NotFoundException`
5. **Setting family attributes without family**: Returns `BadRequestException`

## Best Practices

1. **Use the correct field**: Use `familyAttributesWithValues` for family attributes and `attributesWithValues` for regular attributes
2. **Validate ownership**: All methods automatically validate that the user owns the product
3. **Status recalculation**: All methods automatically recalculate the product status after updating attributes
4. **Error handling**: Always handle potential exceptions in your controllers
5. **Family assignment**: Ensure the product has a family assigned before setting family attribute values

## Example Usage in Controller

```typescript
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  async createProduct(
    @Body() createProductDto: CreateProductDto,
    @Request() req
  ) {
    return this.productService.create(createProductDto, req.user.id);
  }

  @Put(':id')
  async updateProduct(
    @Param('id') productId: number,
    @Body() updateProductDto: UpdateProductDto,
    @Request() req
  ) {
    return this.productService.update(productId, updateProductDto, req.user.id);
  }

  @Put(':id/family-attributes')
  async updateFamilyAttributes(
    @Param('id') productId: number,
    @Body() body: { attributeValues: { attributeId: number; value?: string }[] },
    @Request() req
  ) {
    return this.productService.updateProductFamilyAttributeValues(
      productId,
      body.attributeValues,
      req.user.id
    );
  }

  @Put(':id/attributes')
  async updateAttributes(
    @Param('id') productId: number,
    @Body() body: { attributeValues: { attributeId: number; value?: string }[] },
    @Request() req
  ) {
    return this.productService.updateProductAttributeValues(
      productId,
      body.attributeValues,
      req.user.id
    );
  }

  @Get(':id/family-attributes')
  async getFamilyAttributes(
    @Param('id') productId: number,
    @Request() req
  ) {
    return this.productService.getProductFamilyAttributeValues(
      productId,
      req.user.id
    );
  }

  @Get(':id/attributes')
  async getAttributes(
    @Param('id') productId: number,
    @Request() req
  ) {
    return this.productService.getProductAttributeValues(
      productId,
      req.user.id
    );
  }
}
```

## Complete Example: Creating a Product with Both Types of Attributes

```typescript
// Example API call
const response = await fetch('/api/products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    name: "Premium T-Shirt",
    sku: "TSHIRT-001",
    familyId: 3, // Clothing family
    categoryId: 1, // T-Shirts category
    attributesWithValues: [
      { attributeId: 1, value: "Red" },        // Color (regular attribute)
      { attributeId: 2, value: "Seasonal" }    // Collection (regular attribute)
    ],
    familyAttributesWithValues: [
      { attributeId: 10, value: "Cotton" },    // Material (family attribute)
      { attributeId: 11, value: "Medium" },    // Size (family attribute)
      { attributeId: 12, value: "Casual" }     // Style (family attribute)
    ]
  })
});
```
