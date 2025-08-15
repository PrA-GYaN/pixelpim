# Product Utility Service

A comprehensive utility service for fetching product data with populated relationships in the PixelPim backend.

## Overview

The `ProductUtilService` provides a flexible and efficient way to retrieve product data with various levels of population for related entities such as categories, attributes, families, variants, and assets.

## Features

- **Flexible Population Options**: Choose which relationships to include in queries
- **Performance Optimized**: Only fetch the data you need
- **User Ownership Validation**: Ensures users can only access their own products
- **Bulk Operations**: Fetch multiple products efficiently
- **Error Handling**: Comprehensive error handling with meaningful messages
- **TypeScript Support**: Fully typed interfaces and responses

## Installation

1. Import the `UtilsModule` in your module:

```typescript
import { Module } from '@nestjs/common';
import { UtilsModule } from '../utils/utils.module';

@Module({
  imports: [UtilsModule],
  // ... other module configuration
})
export class YourModule {}
```

2. Inject the service in your controller or service:

```typescript
import { ProductUtilService } from '../utils/product.util';

@Injectable()
export class YourService {
  constructor(private readonly productUtil: ProductUtilService) {}
}
```

## Usage

### Basic Usage

```typescript
// Get product with default relationships
const product = await this.productUtil.getProductById(productId, userId);
```

### Advanced Usage with Options

```typescript
const options = {
  includeCategory: true,
  includeCategoryHierarchy: true, // Include parent/child categories
  includeAttribute: true,
  includeAttributeGroup: true,
  includeAttributeGroupDetails: true, // Include all attributes in group
  includeFamily: true,
  includeFamilyAttributes: true, // Include all family attributes
  includeVariants: true,
  includeRelatedAssets: true,
  assetLimit: 10,
};

const product = await this.productUtil.getProductById(productId, userId, options);
```

## API Reference

### ProductUtilService Methods

#### `getProductById(productId, userId, options?)`

Retrieves a single product with populated relationships.

**Parameters:**
- `productId: number` - The ID of the product to retrieve
- `userId: number` - The ID of the user (for ownership verification)
- `options?: ProductUtilOptions` - Configuration for data population

**Returns:** `Promise<PopulatedProductData>`

#### `getProductsByIds(productIds, userId, options?)`

Retrieves multiple products with populated relationships.

**Parameters:**
- `productIds: number[]` - Array of product IDs to retrieve
- `userId: number` - The ID of the user
- `options?: ProductUtilOptions` - Configuration for data population

**Returns:** `Promise<PopulatedProductData[]>`

#### `productExists(productId, userId)`

Checks if a product exists and belongs to the user.

**Parameters:**
- `productId: number` - The ID of the product to check
- `userId: number` - The ID of the user

**Returns:** `Promise<boolean>`

#### `getProductBasicInfo(productId, userId)`

Retrieves minimal product information for performance-critical operations.

**Parameters:**
- `productId: number` - The ID of the product
- `userId: number` - The ID of the user

**Returns:** Promise with basic product info (id, name, sku, status, imageUrl, dates)

### ProductUtilOptions Interface

```typescript
interface ProductUtilOptions {
  includeCategory?: boolean;           // Include category data
  includeCategoryHierarchy?: boolean;  // Include parent/child categories
  includeAttribute?: boolean;          // Include primary attribute
  includeAttributeGroup?: boolean;     // Include attribute group
  includeAttributeGroupDetails?: boolean; // Include all group attributes
  includeFamily?: boolean;             // Include product family
  includeFamilyAttributes?: boolean;   // Include all family attributes
  includeVariants?: boolean;           // Include product variants
  includeRelatedAssets?: boolean;      // Include related assets
  assetLimit?: number;                 // Limit number of assets (default: 10)
}
```

### PopulatedProductData Interface

The complete interface includes all product fields plus optional populated relationships:

```typescript
interface PopulatedProductData {
  id: number;
  name: string;
  sku: string;
  productLink?: string;
  imageUrl?: string;
  status: string;
  categoryId?: number;
  attributeId?: number;
  attributeGroupId?: number;
  familyId?: number;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
  category?: {
    id: number;
    name: string;
    description?: string;
    parentCategory?: CategoryInfo;
    subcategories?: CategoryInfo[];
  };
  attribute?: AttributeInfo;
  attributeGroup?: {
    id: number;
    name: string;
    description?: string;
    attributes?: AttributeGroupAttributeInfo[];
  };
  family?: {
    id: number;
    name: string;
    familyAttributes?: FamilyAttributeInfo[];
  };
  variants?: VariantInfo[];
  variantCount: number;
  relatedAssets?: AssetInfo[];
}
```

## Usage Examples

### 1. Get Product for Display (Common UI Case)

```typescript
async getProductForDisplay(productId: number, userId: number) {
  const options = {
    includeCategory: true,
    includeAttribute: true,
    includeAttributeGroup: true,
    includeFamily: true,
    includeVariants: true,
    includeRelatedAssets: true,
    assetLimit: 5,
  };

  return this.productUtil.getProductById(productId, userId, options);
}
```

### 2. Get Minimal Product Data (Performance)

```typescript
async getMinimalProduct(productId: number, userId: number) {
  const options = {
    includeCategory: false,
    includeAttribute: false,
    includeAttributeGroup: false,
    includeFamily: false,
    includeVariants: false,
    includeRelatedAssets: false,
  };

  return this.productUtil.getProductById(productId, userId, options);
}
```

### 3. Get Product with Full Hierarchy (Admin/Detail View)

```typescript
async getProductWithFullDetails(productId: number, userId: number) {
  const options = {
    includeCategory: true,
    includeCategoryHierarchy: true,
    includeAttribute: true,
    includeAttributeGroup: true,
    includeAttributeGroupDetails: true,
    includeFamily: true,
    includeFamilyAttributes: true,
    includeVariants: true,
    includeRelatedAssets: true,
    assetLimit: 20,
  };

  return this.productUtil.getProductById(productId, userId, options);
}
```

### 4. Bulk Operations

```typescript
async getMultipleProductsForReport(productIds: number[], userId: number) {
  const options = {
    includeCategory: true,
    includeAttribute: true,
    includeFamily: true,
    includeVariants: true,
  };

  return this.productUtil.getProductsByIds(productIds, userId, options);
}
```

### 5. Check Existence Before Processing

```typescript
async processProduct(productId: number, userId: number) {
  const exists = await this.productUtil.productExists(productId, userId);
  
  if (!exists) {
    throw new NotFoundException('Product not found');
  }

  // Continue processing...
  const product = await this.productUtil.getProductById(productId, userId);
  return product;
}
```

## Controller Integration

Here's how to integrate the utility service in your controllers:

```typescript
@Controller('products')
export class ProductController {
  constructor(
    private readonly productUtil: ProductUtilService
  ) {}

  @Get(':id/detailed')
  async getProductDetailed(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User
  ) {
    const options = {
      includeCategory: true,
      includeAttribute: true,
      includeAttributeGroup: true,
      includeFamily: true,
      includeVariants: true,
    };
    return this.productUtil.getProductById(id, user.id, options);
  }

  @Get(':id/basic')
  async getProductBasic(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User
  ) {
    return this.productUtil.getProductBasicInfo(id, user.id);
  }

  @Post('bulk-detailed')
  async getBulkProducts(
    @Body() dto: { productIds: number[]; options?: ProductUtilOptions },
    @GetUser() user: User
  ) {
    return this.productUtil.getProductsByIds(dto.productIds, user.id, dto.options);
  }
}
```

## Performance Considerations

1. **Use Minimal Options**: Only include relationships you actually need
2. **Asset Limits**: Use reasonable asset limits to prevent memory issues
3. **Bulk Operations**: Use `getProductsByIds` for multiple products instead of multiple single calls
4. **Basic Info**: Use `getProductBasicInfo` for lightweight operations

## Error Handling

The service provides comprehensive error handling:

- `NotFoundException`: When product doesn't exist or user doesn't have access
- `BadRequestException`: For general operation failures
- Logging: All operations are logged for debugging

## Best Practices

1. **Choose Appropriate Options**: Match population options to your use case
2. **Handle Errors**: Always wrap calls in try-catch blocks
3. **Validate Input**: Ensure productId and userId are valid before calling
4. **Use TypeScript**: Leverage the full type safety provided by interfaces
5. **Performance**: Monitor query performance and adjust options as needed

## Related Files

- `src/utils/product.util.ts` - Main utility service
- `src/utils/product-util.examples.ts` - Usage examples
- `src/utils/utils.module.ts` - Module configuration
- `api-examples-product-utils.http` - HTTP API examples
