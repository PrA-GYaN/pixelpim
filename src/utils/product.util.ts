import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma';

export interface PopulatedProductData {
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
    parentCategory?: {
      id: number;
      name: string;
      description?: string;
    };
    subcategories?: Array<{
      id: number;
      name: string;
      description?: string;
    }>;
  };
  attributes?: Array<{
    id: number;
    name: string;
    type: string;
    defaultValue?: string;
  }>;
  attributeGroup?: {
    id: number;
    name: string;
    description?: string;
    attributes?: Array<{
      id: number;
      attributeId: number;
      required: boolean;
      defaultValue?: string;
      attribute: {
        id: number;
        name: string;
        type: string;
        defaultValue?: string;
      };
    }>;
  };
  family?: {
    id: number;
    name: string;
    familyAttributes?: Array<{
      id: number;
      familyId: number;
      attributeId: number;
      isRequired: boolean;
      additionalValue?: string;
      attribute: {
        id: number;
        name: string;
        type: string;
        defaultValue?: string;
      };
    }>;
  };
  variants?: Array<{
    id: number;
    name: string;
    sku: string;
    imageUrl?: string;
    status: string;
    categoryId?: number;
    attributeId?: number;
    attributeGroupId?: number;
    familyId?: number;
  }>;
  variantCount: number;
  relatedAssets?: Array<{
    id: number;
    name: string;
    fileName: string;
    filePath: string;
    mimeType: string;
    size: number;
    uploadDate: Date;
    assetGroup?: {
      id: number;
      groupName: string;
      totalSize: number;
    };
  }>;
}

export interface ProductUtilOptions {
  includeCategory?: boolean;
  includeCategoryHierarchy?: boolean;
  includeAttribute?: boolean;
  includeAttributeGroup?: boolean;
  includeAttributeGroupDetails?: boolean;
  includeFamily?: boolean;
  includeFamilyAttributes?: boolean;
  includeVariants?: boolean;
  includeRelatedAssets?: boolean;
  assetLimit?: number;
}

@Injectable()
export class ProductUtilService {
  private readonly logger = new Logger(ProductUtilService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get a product by ID with populated related data
   * @param productId - The ID of the product to retrieve
   * @param userId - The ID of the user (for ownership verification)
   * @param options - Configuration for what data to populate
   * @returns Promise<PopulatedProductData>
   */
  async getProductById(
    productId: number,
    userId: number,
    options: ProductUtilOptions = {}
  ): Promise<PopulatedProductData> {
    try {
      this.logger.log(`Fetching product ${productId} for user ${userId} with options:`, options);

      // Set default options
      const opts: Required<ProductUtilOptions> = {
        includeCategory: options.includeCategory ?? true,
        includeCategoryHierarchy: options.includeCategoryHierarchy ?? false,
        includeAttribute: options.includeAttribute ?? true,
        includeAttributeGroup: options.includeAttributeGroup ?? true,
        includeAttributeGroupDetails: options.includeAttributeGroupDetails ?? false,
        includeFamily: options.includeFamily ?? true,
        includeFamilyAttributes: options.includeFamilyAttributes ?? false,
        includeVariants: options.includeVariants ?? true,
        includeRelatedAssets: options.includeRelatedAssets ?? false,
        assetLimit: options.assetLimit ?? 10,
      };

      // Build the include object dynamically
      const includeObject: Prisma.ProductInclude = {};

      if (opts.includeCategory) {
        if (opts.includeCategoryHierarchy) {
          includeObject.category = {
            include: {
              parentCategory: true,
              subcategories: true,
            },
          };
        } else {
          includeObject.category = true;
        }
      }

      if (opts.includeAttribute) {
  includeObject.attributes = true;
      }

      if (opts.includeAttributeGroup) {
        if (opts.includeAttributeGroupDetails) {
          includeObject.attributeGroup = {
            include: {
              attributes: {
                include: {
                  attribute: true,
                },
              },
            },
          };
        } else {
          includeObject.attributeGroup = true;
        }
      }

      if (opts.includeFamily) {
        if (opts.includeFamilyAttributes) {
          includeObject.family = {
            include: {
              familyAttributes: {
                include: {
                  attribute: true,
                },
              },
            },
          };
        } else {
          includeObject.family = true;
        }
      }

      if (opts.includeVariants) {
        includeObject.variantLinksA = {
          include: {
            productB: true,
          },
        };
        includeObject.variantLinksB = {
          include: {
            productA: true,
          },
        };
      }

      // Fetch the product with all specified relations
      const product = await this.prisma.product.findFirst({
        where: {
          id: productId,
          userId,
        },
        include: includeObject,
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found or access denied`);
      }

      // Get related assets if requested
      let relatedAssets: any[] = [];
      if (opts.includeRelatedAssets) {
        relatedAssets = await this.getProductRelatedAssets(productId, userId, opts.assetLimit);
      }

      // Transform and build the response
      const populatedProduct: PopulatedProductData = {
        id: product.id,
        name: product.name,
        sku: product.sku,
        productLink: product.productLink || undefined,
        imageUrl: product.imageUrl || undefined,
        status: product.status,
        categoryId: product.categoryId || undefined,
        attributeGroupId: product.attributeGroupId || undefined,
        familyId: product.familyId || undefined,
        userId: product.userId,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        variantCount: 0,
      };

      // Add category data if included
      if (opts.includeCategory && product.category) {
        populatedProduct.category = {
          id: product.category.id,
          name: product.category.name,
          description: product.category.description || undefined,
        };

        // Add hierarchy data if requested and available
        if (opts.includeCategoryHierarchy) {
          // Type assertion for parentCategory
          const categoryWithHierarchy = product.category as any;
          if (categoryWithHierarchy.parentCategory) {
            populatedProduct.category.parentCategory = {
              id: categoryWithHierarchy.parentCategory.id,
              name: categoryWithHierarchy.parentCategory.name,
              description: categoryWithHierarchy.parentCategory.description || undefined,
            };
          }

          if (categoryWithHierarchy.subcategories && Array.isArray(categoryWithHierarchy.subcategories)) {
            populatedProduct.category.subcategories = categoryWithHierarchy.subcategories.map((sub: any) => ({
              id: sub.id,
              name: sub.name,
              description: sub.description || undefined,
            }));
          }
        }
      }

      // Add attribute data if included
      if (opts.includeAttribute && product.attributes && Array.isArray(product.attributes)) {
        populatedProduct.attributes = product.attributes.map((attr: any) => ({
          id: attr.id,
          name: attr.name,
          type: attr.type,
          defaultValue: attr.defaultValue || undefined,
        }));
      }

      // Add attribute group data if included
      if (opts.includeAttributeGroup && product.attributeGroup) {
        populatedProduct.attributeGroup = {
          id: product.attributeGroup.id,
          name: product.attributeGroup.name,
          description: product.attributeGroup.description || undefined,
        };

        // Add detailed attributes if requested and available
        if (opts.includeAttributeGroupDetails) {
          const attributeGroupWithDetails = product.attributeGroup as any;
          if (attributeGroupWithDetails.attributes && Array.isArray(attributeGroupWithDetails.attributes)) {
            populatedProduct.attributeGroup.attributes = attributeGroupWithDetails.attributes.map((attr: any) => ({
              id: attr.id,
              attributeId: attr.attributeId,
              required: attr.required,
              defaultValue: attr.defaultValue || undefined,
              attribute: {
                id: attr.attribute.id,
                name: attr.attribute.name,
                type: attr.attribute.type,
                defaultValue: attr.attribute.defaultValue || undefined,
              },
            }));
          }
        }
      }

      // Add family data if included
      if (opts.includeFamily && product.family) {
        populatedProduct.family = {
          id: product.family.id,
          name: product.family.name,
        };

        // Add family attributes if requested and available
        if (opts.includeFamilyAttributes) {
          const familyWithAttributes = product.family as any;
          if (familyWithAttributes.familyAttributes && Array.isArray(familyWithAttributes.familyAttributes)) {
            populatedProduct.family.familyAttributes = familyWithAttributes.familyAttributes.map((famAttr: any) => ({
              id: famAttr.id,
              familyId: famAttr.familyId,
              attributeId: famAttr.attributeId,
              isRequired: famAttr.isRequired,
              additionalValue: famAttr.additionalValue || undefined,
              attribute: {
                id: famAttr.attribute.id,
                name: famAttr.attribute.name,
                type: famAttr.attribute.type,
                defaultValue: famAttr.attribute.defaultValue || undefined,
              },
            }));
          }
        }
      }

      // Add variants data if included
      if (opts.includeVariants) {
        const variants: any[] = [];

        // Collect variants from both directions
        if (product.variantLinksA) {
          variants.push(...product.variantLinksA.map((link: any) => link.productB));
        }
        if (product.variantLinksB) {
          variants.push(...product.variantLinksB.map((link: any) => link.productA));
        }

        populatedProduct.variants = variants.map(variant => ({
          id: variant.id,
          name: variant.name,
          sku: variant.sku,
          imageUrl: variant.imageUrl || undefined,
          status: variant.status,
          categoryId: variant.categoryId || undefined,
          attributeId: variant.attributeId || undefined,
          attributeGroupId: variant.attributeGroupId || undefined,
          familyId: variant.familyId || undefined,
        }));

        populatedProduct.variantCount = variants.length;
      }

      // Add related assets if included
      if (opts.includeRelatedAssets && relatedAssets.length > 0) {
        populatedProduct.relatedAssets = relatedAssets;
      }

      this.logger.log(`Successfully retrieved product ${productId} with populated data`);
      return populatedProduct;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to fetch product ${productId}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch product with populated data');
    }
  }

  /**
   * Get multiple products by IDs with populated data
   * @param productIds - Array of product IDs to retrieve
   * @param userId - The ID of the user (for ownership verification)
   * @param options - Configuration for what data to populate
   * @returns Promise<PopulatedProductData[]>
   */
  async getProductsByIds(
    productIds: number[],
    userId: number,
    options: ProductUtilOptions = {}
  ): Promise<PopulatedProductData[]> {
    try {
      this.logger.log(`Fetching ${productIds.length} products for user ${userId}`);

      const results = await Promise.allSettled(
        productIds.map(id => this.getProductById(id, userId, options))
      );

      const products: PopulatedProductData[] = [];
      const failures: number[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          products.push(result.value);
        } else {
          failures.push(productIds[index]);
          this.logger.warn(`Failed to fetch product ${productIds[index]}: ${result.reason.message}`);
        }
      });

      if (failures.length > 0) {
        this.logger.warn(`Failed to fetch ${failures.length} products: ${failures.join(', ')}`);
      }

      return products;
    } catch (error) {
      this.logger.error(`Failed to fetch products by IDs: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch products with populated data');
    }
  }

  /**
   * Get related assets for a product (assets that might be related by naming convention or manual association)
   * This is a helper method that can be extended based on business logic
   */
  private async getProductRelatedAssets(
    productId: number,
    userId: number,
    limit: number = 10
  ): Promise<any[]> {
    try {
      // This is a basic implementation - you might want to extend this
      // based on your business logic for relating assets to products
      const assets = await this.prisma.asset.findMany({
        where: {
          userId,
          // You could add more sophisticated logic here
          // For example, searching by product name, SKU, etc.
        },
        include: {
          assetGroup: {
            select: {
              id: true,
              groupName: true,
              totalSize: true,
            },
          },
        },
        take: limit,
        orderBy: {
          uploadDate: 'desc',
        },
      });

      return assets.map(asset => ({
        id: asset.id,
        name: asset.name,
        fileName: asset.fileName,
        filePath: asset.filePath,
        mimeType: asset.mimeType,
        size: Number(asset.size), // Convert BigInt to number
        uploadDate: asset.uploadDate,
        assetGroup: asset.assetGroup ? {
          id: asset.assetGroup.id,
          groupName: asset.assetGroup.groupName,
          totalSize: Number(asset.assetGroup.totalSize),
        } : undefined,
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch related assets for product ${productId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Check if a product exists and belongs to the user
   * @param productId - The ID of the product to check
   * @param userId - The ID of the user
   * @returns Promise<boolean>
   */
  async productExists(productId: number, userId: number): Promise<boolean> {
    try {
      const product = await this.prisma.product.findFirst({
        where: {
          id: productId,
          userId,
        },
        select: { id: true },
      });

      return !!product;
    } catch (error) {
      this.logger.error(`Failed to check product existence ${productId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get a lightweight version of product data (minimal fields)
   * @param productId - The ID of the product to retrieve
   * @param userId - The ID of the user
   * @returns Promise with basic product info
   */
  async getProductBasicInfo(productId: number, userId: number) {
    try {
      const product = await this.prisma.product.findFirst({
        where: {
          id: productId,
          userId,
        },
        select: {
          id: true,
          name: true,
          sku: true,
          status: true,
          imageUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found or access denied`);
      }

      return {
        ...product,
        imageUrl: product.imageUrl || undefined,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to fetch basic product info ${productId}: ${error.message}`);
      throw new BadRequestException('Failed to fetch product basic info');
    }
  }
}
