// Example usage of ProductUtilService

import { Injectable } from '@nestjs/common';
import { ProductUtilService, PopulatedProductData, ProductUtilOptions } from '../utils/product.util';

@Injectable()
export class ProductExampleService {
  constructor(private readonly productUtil: ProductUtilService) {}

  // Example 1: Get product with all basic relationships
  async getFullProductData(productId: number, userId: number): Promise<PopulatedProductData> {
    const options: ProductUtilOptions = {
      includeCategory: true,
      includeAttribute: true,
      includeAttributeGroup: true,
      includeFamily: true,
      includeVariants: true,
    };

    return this.productUtil.getProductById(productId, userId, options);
  }

  // Example 2: Get product with detailed hierarchy and relationships
  async getProductWithFullHierarchy(productId: number, userId: number): Promise<PopulatedProductData> {
    const options: ProductUtilOptions = {
      includeCategory: true,
      includeCategoryHierarchy: true, // Include parent and subcategories
      includeAttribute: true,
      includeAttributeGroup: true,
      includeAttributeGroupDetails: true, // Include all attributes in the group
      includeFamily: true,
      includeFamilyAttributes: true, // Include all family attributes
      includeVariants: true,
      includeRelatedAssets: true, // Include related assets
      assetLimit: 20, // Limit to 20 assets
    };

    return this.productUtil.getProductById(productId, userId, options);
  }

  // Example 3: Get minimal product data (for performance)
  async getMinimalProductData(productId: number, userId: number): Promise<PopulatedProductData> {
    const options: ProductUtilOptions = {
      includeCategory: false,
      includeAttribute: false,
      includeAttributeGroup: false,
      includeFamily: false,
      includeVariants: false,
      includeRelatedAssets: false,
    };

    return this.productUtil.getProductById(productId, userId, options);
  }

  // Example 4: Get product for display purposes (common UI needs)
  async getProductForDisplay(productId: number, userId: number): Promise<PopulatedProductData> {
    const options: ProductUtilOptions = {
      includeCategory: true,
      includeCategoryHierarchy: false,
      includeAttribute: true,
      includeAttributeGroup: true,
      includeAttributeGroupDetails: false,
      includeFamily: true,
      includeFamilyAttributes: false,
      includeVariants: true,
      includeRelatedAssets: true,
      assetLimit: 5,
    };

    return this.productUtil.getProductById(productId, userId, options);
  }

  // Example 5: Get multiple products with consistent options
  async getMultipleProducts(productIds: number[], userId: number): Promise<PopulatedProductData[]> {
    const options: ProductUtilOptions = {
      includeCategory: true,
      includeAttribute: true,
      includeAttributeGroup: true,
      includeFamily: true,
      includeVariants: true,
    };

    return this.productUtil.getProductsByIds(productIds, userId, options);
  }

  // Example 6: Check if product exists before processing
  async processProductIfExists(productId: number, userId: number): Promise<string> {
    const exists = await this.productUtil.productExists(productId, userId);
    
    if (!exists) {
      return 'Product not found or access denied';
    }

    const product = await this.productUtil.getProductById(productId, userId);
    return `Processing product: ${product.name} (${product.sku})`;
  }

  // Example 7: Get basic product info for quick operations
  async getQuickProductInfo(productId: number, userId: number) {
    return this.productUtil.getProductBasicInfo(productId, userId);
  }

  // Example 8: API endpoint example using the utility
  async getProductApiResponse(productId: number, userId: number, detailed: boolean = false) {
    try {
      if (detailed) {
        // Return detailed product data for admin/detailed views
        const product = await this.getProductWithFullHierarchy(productId, userId);
        
        return {
          success: true,
          data: product,
          meta: {
            variantCount: product.variantCount,
            hasCategory: !!product.category,
            hasFamily: !!product.family,
            hasAttributes: !!product.attribute || !!product.attributeGroup,
            assetCount: product.relatedAssets?.length || 0,
          },
        };
      } else {
        // Return basic product data for list views
        const product = await this.getProductForDisplay(productId, userId);
        
        return {
          success: true,
          data: {
            id: product.id,
            name: product.name,
            sku: product.sku,
            status: product.status,
            imageUrl: product.imageUrl,
            category: product.category?.name,
            variantCount: product.variantCount,
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Example 9: Get products by category with populated data
  async getProductsByCategoryWithDetails(categoryId: number, userId: number): Promise<PopulatedProductData[]> {
    // First get all products in the category (you'd need to implement this in ProductService)
    // This is just an example of how you might use the utility for bulk operations
    
    // Simulated product IDs from category
    const productIds = [1, 2, 3, 4, 5]; // This would come from your category query
    
    const options: ProductUtilOptions = {
      includeCategory: true,
      includeVariants: true,
      includeAttribute: true,
    };

    return this.productUtil.getProductsByIds(productIds, userId, options);
  }

  // Example 10: Export/report generation using populated data
  async generateProductReport(productIds: number[], userId: number) {
    const options: ProductUtilOptions = {
      includeCategory: true,
      includeCategoryHierarchy: true,
      includeAttribute: true,
      includeAttributeGroup: true,
      includeAttributeGroupDetails: true,
      includeFamily: true,
      includeFamilyAttributes: true,
      includeVariants: true,
    };

    const products = await this.productUtil.getProductsByIds(productIds, userId, options);
    
    // Transform for report
    return products.map(product => ({
      'Product ID': product.id,
      'Product Name': product.name,
      'SKU': product.sku,
      'Status': product.status,
      'Category': product.category?.name || 'Uncategorized',
      'Parent Category': product.category?.parentCategory?.name || 'None',
      'Family': product.family?.name || 'No Family',
      'Primary Attribute': product.attribute?.name || 'None',
      'Attribute Group': product.attributeGroup?.name || 'None',
      'Variant Count': product.variantCount,
      'Created Date': product.createdAt.toLocaleDateString(),
      'Last Updated': product.updatedAt.toLocaleDateString(),
    }));
  }
}
