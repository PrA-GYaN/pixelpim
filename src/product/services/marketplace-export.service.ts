import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MarketplaceExportDto, MarketplaceExportResponseDto, FieldMappingDto, MarketplaceType, EcommerceFieldType } from '../dto/marketplace-export.dto';
import { MarketplaceTemplateService } from './marketplace-template.service';
import * as ExcelJS from 'exceljs';
import { Builder } from 'xml2js';

@Injectable()
export class MarketplaceExportService {
  private readonly logger = new Logger(MarketplaceExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templateService: MarketplaceTemplateService,
  ) {}

  /**
   * Export products for a specific marketplace
   */
  async exportToMarketplace(exportDto: MarketplaceExportDto, userId: number): Promise<MarketplaceExportResponseDto> {
    try {
      this.logger.log(`Exporting ${exportDto.productIds.length} products to ${exportDto.marketplaceType} for user: ${userId}`);

      // Get template and field mappings
      const template = this.templateService.getMarketplaceTemplate(exportDto.marketplaceType);
      const fieldMappings = exportDto.customFieldMappings || template.fieldMappings;
      
      // Validate field mappings
      this.templateService.validateFieldMappings(exportDto.marketplaceType, fieldMappings);

      // Fetch products with all necessary relations
      const products = await this.fetchProductsWithRelations(exportDto.productIds, userId);

      if (products.length === 0) {
        throw new NotFoundException('No products found with the provided IDs or access denied');
      }

      // Transform products based on field mappings
      const transformedData = await this.transformProductsForMarketplace(products, fieldMappings);

      // Generate filename
      const fileFormat = exportDto.fileFormat || template.fileFormat || 'csv';
      const filename = exportDto.filename || 
        `${exportDto.marketplaceType}_export_${new Date().toISOString().split('T')[0]}.${fileFormat}`;

      this.logger.log(`Successfully transformed ${transformedData.length} products for ${exportDto.marketplaceType}`);

      return {
        data: transformedData,
        marketplaceType: exportDto.marketplaceType,
        templateUsed: template.templateName,
        fileFormat,
        filename,
        totalRecords: transformedData.length,
        fieldMappings,
        exportedAt: new Date(),
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to export products to ${exportDto.marketplaceType}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to export products to ${exportDto.marketplaceType}`);
    }
  }

  /**
   * Fetch products with all necessary relations for export
   */
  private async fetchProductsWithRelations(productIds: number[], userId: number) {
    return this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        userId,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        family: {
          select: {
            id: true,
            name: true,
          },
        },
        attributeGroup: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        attributes: {
          include: {
            attribute: {
              select: {
                id: true,
                name: true,
                type: true,
                defaultValue: true,
              },
            },
          },
        },
        assets: {
          include: {
            asset: {
              select: {
                id: true,
                name: true,
                filePath: true,
                mimeType: true,
                size: true,
                // Add Cloudinary URL if available
              },
            },
          },
        },
        // Add variant information if needed
        variants: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  /**
   * Transform products based on marketplace field mappings
   */
  private async transformProductsForMarketplace(
    products: any[],
    fieldMappings: FieldMappingDto[]
  ): Promise<any[]> {
    return products.map(product => {
      const transformedProduct: any = {};

      fieldMappings.forEach(mapping => {
        const { ecommerceField, sourceField, defaultValue, transformation } = mapping;
        
        let value = this.extractFieldValue(product, sourceField) || defaultValue || '';
        
        // Apply transformation if specified
        if (transformation) {
          value = this.templateService.applyTransformation(value, transformation);
        }
        
        // Use the ecommerce field name as the key
        const fieldKey = this.getFieldKey(ecommerceField);
        transformedProduct[fieldKey] = value;
      });

      return transformedProduct;
    });
  }

  /**
   * Extract field value from product data
   */
  private extractFieldValue(product: any, sourceField: string): string {
    // Handle nested fields and attributes
    switch (sourceField) {
      // Basic product fields
      case 'id':
        return product.id?.toString() || '';
      case 'name':
        return product.name || '';
      case 'sku':
        return product.sku || '';
      case 'status':
        return product.status || '';
      case 'productLink':
        return product.productLink || '';
      case 'imageUrl':
        return product.imageUrl || this.getFirstAssetUrl(product);
      case 'createdAt':
        return product.createdAt ? new Date(product.createdAt).toISOString() : '';
      case 'updatedAt':
        return product.updatedAt ? new Date(product.updatedAt).toISOString() : '';
      
      // Category fields
      case 'categoryName':
        return product.category?.name || '';
      case 'categoryDescription':
        return product.category?.description || '';
      
      // Family fields
      case 'familyName':
        return product.family?.name || '';
      
      // Attribute group fields
      case 'attributeGroupName':
        return product.attributeGroup?.name || '';
      
      // Handle custom attributes by name
      default:
        return this.getAttributeValue(product, sourceField) || 
               this.getCustomFieldValue(product, sourceField) || '';
    }
  }

  /**
   * Get attribute value by attribute name
   */
  private getAttributeValue(product: any, attributeName: string): string {
    const productAttribute = product.attributes?.find(
      (pa: any) => pa.attribute.name.toLowerCase() === attributeName.toLowerCase()
    );
    
    return productAttribute?.value || productAttribute?.attribute?.defaultValue || '';
  }

  /**
   * Get custom field value (for marketplace-specific fields)
   */
  private getCustomFieldValue(product: any, fieldName: string): string {
    // This method can be extended to handle marketplace-specific field extractions
    // For now, check if it's a computed field
    switch (fieldName) {
      case 'handle':
        return this.generateHandle(product.name);
      case 'inventory':
        return '0'; // Default inventory, could be enhanced to use actual inventory data
      case 'price':
        return this.getAttributeValue(product, 'price') || '0.00';
      case 'weight':
        return this.getAttributeValue(product, 'weight') || '1';
      case 'brand':
        return this.getAttributeValue(product, 'brand') || '';
      case 'description':
        return this.getAttributeValue(product, 'description') || product.name || '';
      case 'tags':
        return this.generateTags(product);
      case 'materials':
        return this.getAttributeValue(product, 'materials') || '';
      case 'occasion':
        return this.getAttributeValue(product, 'occasion') || '';
      case 'condition':
        return this.getAttributeValue(product, 'condition') || 'New';
      case 'gtin':
        return this.getAttributeValue(product, 'gtin') || this.getAttributeValue(product, 'upc') || '';
      case 'mpn':
        return this.getAttributeValue(product, 'mpn') || product.sku || '';
      default:
        return '';
    }
  }

  /**
   * Generate Shopify handle from product name
   */
  private generateHandle(name: string): string {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Generate tags from product data
   */
  private generateTags(product: any): string {
    const tags: string[] = [];
    
    if (product.category?.name) {
      tags.push(product.category.name);
    }
    
    if (product.family?.name) {
      tags.push(product.family.name);
    }
    
    // Add attribute values as tags
    product.attributes?.forEach((pa: any) => {
      if (pa.value && pa.attribute.name !== 'description') {
        tags.push(pa.value);
      }
    });
    
    return tags.join(', ');
  }

  /**
   * Get first asset URL from product
   */
  private getFirstAssetUrl(product: any): string {
    if (product.assets && product.assets.length > 0) {
      const firstAsset = product.assets[0].asset;
      // Return Cloudinary URL or construct URL based on file path
      return firstAsset.filePath || '';
    }
    return '';
  }

  /**
   * Get field key for export based on marketplace requirements
   */
  private getFieldKey(ecommerceField: EcommerceFieldType): string {
    // Map ecommerce fields to actual export column names
    const fieldKeyMap: Record<EcommerceFieldType, string> = {
      // Universal fields
      [EcommerceFieldType.PRODUCT_NAME]: 'title',
      [EcommerceFieldType.PRODUCT_DESCRIPTION]: 'description',
      [EcommerceFieldType.SKU]: 'sku',
      [EcommerceFieldType.PRICE]: 'price',
      [EcommerceFieldType.BRAND]: 'brand',
      [EcommerceFieldType.CATEGORY]: 'category',
      [EcommerceFieldType.PRODUCT_IMAGE]: 'image_url',
      [EcommerceFieldType.ADDITIONAL_IMAGES]: 'additional_images',
      [EcommerceFieldType.WEIGHT]: 'weight',
      [EcommerceFieldType.DIMENSIONS]: 'dimensions',
      [EcommerceFieldType.INVENTORY_QUANTITY]: 'quantity',
      [EcommerceFieldType.SHIPPING_WEIGHT]: 'shipping_weight',
      [EcommerceFieldType.SHIPPING_CLASS]: 'shipping_class',
      [EcommerceFieldType.TAX_CLASS]: 'tax_class',
      [EcommerceFieldType.STATUS]: 'status',
      [EcommerceFieldType.VISIBILITY]: 'visibility',
      
      // Amazon specific
      [EcommerceFieldType.AMAZON_ASIN]: 'asin',
      [EcommerceFieldType.AMAZON_BULLET_POINTS]: 'bullet_points',
      [EcommerceFieldType.AMAZON_KEYWORDS]: 'keywords',
      [EcommerceFieldType.AMAZON_PARENT_SKU]: 'parent_sku',
      [EcommerceFieldType.AMAZON_VARIATION_THEME]: 'variation_theme',
      
      // AliExpress specific
      [EcommerceFieldType.ALIEXPRESS_SHIPPING_TEMPLATE]: 'shipping_template',
      [EcommerceFieldType.ALIEXPRESS_CATEGORY_ID]: 'category_id',
      [EcommerceFieldType.ALIEXPRESS_LOGISTICS]: 'logistics',
      
      // eBay specific
      [EcommerceFieldType.EBAY_CATEGORY_ID]: 'category_id',
      [EcommerceFieldType.EBAY_CONDITION]: 'condition',
      [EcommerceFieldType.EBAY_LISTING_DURATION]: 'listing_duration',
      
      // Etsy specific
      [EcommerceFieldType.ETSY_TAGS]: 'tags',
      [EcommerceFieldType.ETSY_MATERIALS]: 'materials',
      [EcommerceFieldType.ETSY_OCCASION]: 'occasion',
      
      // Shopify specific
      [EcommerceFieldType.SHOPIFY_PRODUCT_TYPE]: 'product_type',
      [EcommerceFieldType.SHOPIFY_VENDOR]: 'vendor',
      [EcommerceFieldType.SHOPIFY_HANDLE]: 'handle',
      
      // Walmart specific
      [EcommerceFieldType.WALMART_CATEGORY]: 'category',
      [EcommerceFieldType.WALMART_SUBCATEGORY]: 'subcategory',
      [EcommerceFieldType.WALMART_GTIN]: 'gtin',
      
      // Google Shopping specific
      [EcommerceFieldType.GOOGLE_PRODUCT_CATEGORY]: 'google_product_category',
      [EcommerceFieldType.GOOGLE_GTIN]: 'gtin',
      [EcommerceFieldType.GOOGLE_MPN]: 'mpn',
      [EcommerceFieldType.GOOGLE_CONDITION]: 'condition',
    };
    
    return fieldKeyMap[ecommerceField] || ecommerceField.toString();
  }

  /**
   * Generate CSV content from data
   */
  generateCSV(data: any[], delimiter: string = ',', quote: string = '"'): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    let csv = headers.map(header => `${quote}${header}${quote}`).join(delimiter) + '\n';

    data.forEach(row => {
      const values = headers.map(header => {
        const value = (row[header] || '').toString().replace(/"/g, '""');
        return `${quote}${value}${quote}`;
      });
      csv += values.join(delimiter) + '\n';
    });

    return csv;
  }

  /**
   * Generate Excel file buffer
   */
  async generateExcel(data: any[], filename: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Products');

    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      worksheet.addRow(headers);
      
      data.forEach(row => {
        const values = headers.map(header => row[header] || '');
        worksheet.addRow(values);
      });

      // Auto-fit columns
      headers.forEach((header, index) => {
        const column = worksheet.getColumn(index + 1);
        const maxLength = Math.max(
          header.length,
          ...data.map(row => (row[header] || '').toString().length)
        );
        column.width = Math.min(maxLength + 2, 50);
      });
    }

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  /**
   * Generate XML content for feeds like Google Shopping
   */
  generateXML(data: any[], rootElement: string = 'products'): string {
    const builder = new Builder({
      rootName: rootElement,
      xmldec: { version: '1.0', encoding: 'UTF-8' }
    });

    const xmlData = {
      product: data.map(item => {
        const product: any = {};
        Object.keys(item).forEach(key => {
          product[key] = item[key];
        });
        return product;
      })
    };

    return builder.buildObject(xmlData);
  }
}