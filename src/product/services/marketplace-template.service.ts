import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { MarketplaceType, EcommerceFieldType, FieldMappingDto, MarketplaceTemplateDto } from '../dto/marketplace-export.dto';

@Injectable()
export class MarketplaceTemplateService {
  private readonly logger = new Logger(MarketplaceTemplateService.name);

  // Predefined templates for major marketplaces
  private readonly marketplaceTemplates: Record<MarketplaceType, MarketplaceTemplateDto> = {
    [MarketplaceType.AMAZON]: {
      marketplaceType: MarketplaceType.AMAZON,
      templateName: 'Amazon Standard Template',
      description: 'Standard Amazon marketplace export template with required fields',
      fileFormat: 'csv',
      csvDelimiter: ',',
      csvQuote: '"',
      fieldMappings: [
        {
          ecommerceField: EcommerceFieldType.PRODUCT_NAME,
          sourceField: 'name',
        },
        {
          ecommerceField: EcommerceFieldType.SKU,
          sourceField: 'sku',
        },
        {
          ecommerceField: EcommerceFieldType.PRODUCT_DESCRIPTION,
          sourceField: 'description',
          defaultValue: '',
        },
        {
          ecommerceField: EcommerceFieldType.PRICE,
          sourceField: 'price',
          defaultValue: '0.00',
        },
        {
          ecommerceField: EcommerceFieldType.BRAND,
          sourceField: 'brand',
          defaultValue: '',
        },
        {
          ecommerceField: EcommerceFieldType.CATEGORY,
          sourceField: 'categoryName',
        },
        {
          ecommerceField: EcommerceFieldType.PRODUCT_IMAGE,
          sourceField: 'imageUrl',
        },
        {
          ecommerceField: EcommerceFieldType.WEIGHT,
          sourceField: 'weight',
          defaultValue: '1',
        },
        {
          ecommerceField: EcommerceFieldType.AMAZON_BULLET_POINTS,
          sourceField: 'bullet_points',
          defaultValue: '',
        },
        {
          ecommerceField: EcommerceFieldType.AMAZON_KEYWORDS,
          sourceField: 'keywords',
          defaultValue: '',
        },
        {
          ecommerceField: EcommerceFieldType.INVENTORY_QUANTITY,
          sourceField: 'inventory',
          defaultValue: '0',
        },
        {
          ecommerceField: EcommerceFieldType.STATUS,
          sourceField: 'status',
          transformation: 'status_to_amazon',
        }
      ]
    },

    [MarketplaceType.ALIEXPRESS]: {
      marketplaceType: MarketplaceType.ALIEXPRESS,
      templateName: 'AliExpress Standard Template',
      description: 'Standard AliExpress marketplace export template',
      fileFormat: 'csv',
      csvDelimiter: ',',
      csvQuote: '"',
      fieldMappings: [
        {
          ecommerceField: EcommerceFieldType.PRODUCT_NAME,
          sourceField: 'name',
        },
        {
          ecommerceField: EcommerceFieldType.SKU,
          sourceField: 'sku',
        },
        {
          ecommerceField: EcommerceFieldType.PRODUCT_DESCRIPTION,
          sourceField: 'description',
          defaultValue: '',
        },
        {
          ecommerceField: EcommerceFieldType.PRICE,
          sourceField: 'price',
          defaultValue: '1.00',
        },
        {
          ecommerceField: EcommerceFieldType.CATEGORY,
          sourceField: 'categoryName',
        },
        {
          ecommerceField: EcommerceFieldType.PRODUCT_IMAGE,
          sourceField: 'imageUrl',
        },
        {
          ecommerceField: EcommerceFieldType.ALIEXPRESS_CATEGORY_ID,
          sourceField: 'aliexpress_category_id',
          defaultValue: '0',
        },
        {
          ecommerceField: EcommerceFieldType.ALIEXPRESS_SHIPPING_TEMPLATE,
          sourceField: 'shipping_template',
          defaultValue: 'standard',
        },
        {
          ecommerceField: EcommerceFieldType.WEIGHT,
          sourceField: 'weight',
          defaultValue: '0.1',
        },
        {
          ecommerceField: EcommerceFieldType.INVENTORY_QUANTITY,
          sourceField: 'inventory',
          defaultValue: '999',
        }
      ]
    },

    [MarketplaceType.EBAY]: {
      marketplaceType: MarketplaceType.EBAY,
      templateName: 'eBay Standard Template',
      description: 'Standard eBay marketplace export template',
      fileFormat: 'csv',
      csvDelimiter: ',',
      csvQuote: '"',
      fieldMappings: [
        {
          ecommerceField: EcommerceFieldType.PRODUCT_NAME,
          sourceField: 'name',
        },
        {
          ecommerceField: EcommerceFieldType.SKU,
          sourceField: 'sku',
        },
        {
          ecommerceField: EcommerceFieldType.PRODUCT_DESCRIPTION,
          sourceField: 'description',
          defaultValue: '',
        },
        {
          ecommerceField: EcommerceFieldType.PRICE,
          sourceField: 'price',
          defaultValue: '1.00',
        },
        {
          ecommerceField: EcommerceFieldType.CATEGORY,
          sourceField: 'categoryName',
        },
        {
          ecommerceField: EcommerceFieldType.PRODUCT_IMAGE,
          sourceField: 'imageUrl',
        },
        {
          ecommerceField: EcommerceFieldType.EBAY_CATEGORY_ID,
          sourceField: 'ebay_category_id',
          defaultValue: '0',
        },
        {
          ecommerceField: EcommerceFieldType.EBAY_CONDITION,
          sourceField: 'condition',
          defaultValue: 'New',
        },
        {
          ecommerceField: EcommerceFieldType.EBAY_LISTING_DURATION,
          sourceField: 'listing_duration',
          defaultValue: 'GTC',
        },
        {
          ecommerceField: EcommerceFieldType.INVENTORY_QUANTITY,
          sourceField: 'inventory',
          defaultValue: '1',
        }
      ]
    },

    [MarketplaceType.ETSY]: {
      marketplaceType: MarketplaceType.ETSY,
      templateName: 'Etsy Standard Template',
      description: 'Standard Etsy marketplace export template',
      fileFormat: 'csv',
      csvDelimiter: ',',
      csvQuote: '"',
      fieldMappings: [
        {
          ecommerceField: EcommerceFieldType.PRODUCT_NAME,
          sourceField: 'name',
        },
        {
          ecommerceField: EcommerceFieldType.SKU,
          sourceField: 'sku',
        },
        {
          ecommerceField: EcommerceFieldType.PRODUCT_DESCRIPTION,
          sourceField: 'description',
          defaultValue: '',
        },
        {
          ecommerceField: EcommerceFieldType.PRICE,
          sourceField: 'price',
          defaultValue: '1.00',
        },
        {
          ecommerceField: EcommerceFieldType.PRODUCT_IMAGE,
          sourceField: 'imageUrl',
        },
        {
          ecommerceField: EcommerceFieldType.ETSY_TAGS,
          sourceField: 'tags',
          defaultValue: '',
        },
        {
          ecommerceField: EcommerceFieldType.ETSY_MATERIALS,
          sourceField: 'materials',
          defaultValue: '',
        },
        {
          ecommerceField: EcommerceFieldType.ETSY_OCCASION,
          sourceField: 'occasion',
          defaultValue: '',
        },
        {
          ecommerceField: EcommerceFieldType.INVENTORY_QUANTITY,
          sourceField: 'inventory',
          defaultValue: '1',
        },
        {
          ecommerceField: EcommerceFieldType.WEIGHT,
          sourceField: 'weight',
          defaultValue: '1',
        }
      ]
    },

    [MarketplaceType.SHOPIFY]: {
      marketplaceType: MarketplaceType.SHOPIFY,
      templateName: 'Shopify Standard Template',
      description: 'Standard Shopify export template',
      fileFormat: 'csv',
      csvDelimiter: ',',
      csvQuote: '"',
      fieldMappings: [
        {
          ecommerceField: EcommerceFieldType.SHOPIFY_HANDLE,
          sourceField: 'handle',
          transformation: 'name_to_handle',
        },
        {
          ecommerceField: EcommerceFieldType.PRODUCT_NAME,
          sourceField: 'name',
        },
        {
          ecommerceField: EcommerceFieldType.PRODUCT_DESCRIPTION,
          sourceField: 'description',
          defaultValue: '',
        },
        {
          ecommerceField: EcommerceFieldType.SHOPIFY_VENDOR,
          sourceField: 'vendor',
          defaultValue: '',
        },
        {
          ecommerceField: EcommerceFieldType.SHOPIFY_PRODUCT_TYPE,
          sourceField: 'categoryName',
        },
        {
          ecommerceField: EcommerceFieldType.SKU,
          sourceField: 'sku',
        },
        {
          ecommerceField: EcommerceFieldType.PRICE,
          sourceField: 'price',
          defaultValue: '0.00',
        },
        {
          ecommerceField: EcommerceFieldType.INVENTORY_QUANTITY,
          sourceField: 'inventory',
          defaultValue: '0',
        },
        {
          ecommerceField: EcommerceFieldType.WEIGHT,
          sourceField: 'weight',
          defaultValue: '0',
        },
        {
          ecommerceField: EcommerceFieldType.PRODUCT_IMAGE,
          sourceField: 'imageUrl',
        }
      ]
    },

    [MarketplaceType.WALMART]: {
      marketplaceType: MarketplaceType.WALMART,
      templateName: 'Walmart Marketplace Template',
      description: 'Standard Walmart marketplace export template',
      fileFormat: 'xlsx',
      fieldMappings: [
        {
          ecommerceField: EcommerceFieldType.PRODUCT_NAME,
          sourceField: 'name',
        },
        {
          ecommerceField: EcommerceFieldType.SKU,
          sourceField: 'sku',
        },
        {
          ecommerceField: EcommerceFieldType.WALMART_GTIN,
          sourceField: 'gtin',
          defaultValue: '',
        },
        {
          ecommerceField: EcommerceFieldType.PRODUCT_DESCRIPTION,
          sourceField: 'description',
          defaultValue: '',
        },
        {
          ecommerceField: EcommerceFieldType.PRICE,
          sourceField: 'price',
          defaultValue: '1.00',
        },
        {
          ecommerceField: EcommerceFieldType.BRAND,
          sourceField: 'brand',
          defaultValue: '',
        },
        {
          ecommerceField: EcommerceFieldType.WALMART_CATEGORY,
          sourceField: 'walmart_category',
          defaultValue: '',
        },
        {
          ecommerceField: EcommerceFieldType.PRODUCT_IMAGE,
          sourceField: 'imageUrl',
        },
        {
          ecommerceField: EcommerceFieldType.INVENTORY_QUANTITY,
          sourceField: 'inventory',
          defaultValue: '0',
        }
      ]
    },

    [MarketplaceType.FACEBOOK_MARKETPLACE]: {
      marketplaceType: MarketplaceType.FACEBOOK_MARKETPLACE,
      templateName: 'Facebook Marketplace Template',
      description: 'Facebook Marketplace export template',
      fileFormat: 'csv',
      csvDelimiter: ',',
      csvQuote: '"',
      fieldMappings: [
        {
          ecommerceField: EcommerceFieldType.PRODUCT_NAME,
          sourceField: 'name',
        },
        {
          ecommerceField: EcommerceFieldType.PRODUCT_DESCRIPTION,
          sourceField: 'description',
          defaultValue: '',
        },
        {
          ecommerceField: EcommerceFieldType.PRICE,
          sourceField: 'price',
          defaultValue: '1.00',
        },
        {
          ecommerceField: EcommerceFieldType.CATEGORY,
          sourceField: 'categoryName',
        },
        {
          ecommerceField: EcommerceFieldType.PRODUCT_IMAGE,
          sourceField: 'imageUrl',
        },
        {
          ecommerceField: EcommerceFieldType.BRAND,
          sourceField: 'brand',
          defaultValue: '',
        },
        {
          ecommerceField: EcommerceFieldType.STATUS,
          sourceField: 'status',
          transformation: 'status_to_availability',
        }
      ]
    },

    [MarketplaceType.GOOGLE_SHOPPING]: {
      marketplaceType: MarketplaceType.GOOGLE_SHOPPING,
      templateName: 'Google Shopping Template',
      description: 'Google Shopping feed export template',
      fileFormat: 'xml',
      fieldMappings: [
        {
          ecommerceField: EcommerceFieldType.PRODUCT_NAME,
          sourceField: 'name',
        },
        {
          ecommerceField: EcommerceFieldType.SKU,
          sourceField: 'sku',
        },
        {
          ecommerceField: EcommerceFieldType.PRODUCT_DESCRIPTION,
          sourceField: 'description',
          defaultValue: '',
        },
        {
          ecommerceField: EcommerceFieldType.PRICE,
          sourceField: 'price',
          defaultValue: '1.00 USD',
        },
        {
          ecommerceField: EcommerceFieldType.GOOGLE_PRODUCT_CATEGORY,
          sourceField: 'google_category',
          defaultValue: '',
        },
        {
          ecommerceField: EcommerceFieldType.GOOGLE_GTIN,
          sourceField: 'gtin',
          defaultValue: '',
        },
        {
          ecommerceField: EcommerceFieldType.GOOGLE_MPN,
          sourceField: 'mpn',
          defaultValue: '',
        },
        {
          ecommerceField: EcommerceFieldType.BRAND,
          sourceField: 'brand',
          defaultValue: '',
        },
        {
          ecommerceField: EcommerceFieldType.GOOGLE_CONDITION,
          sourceField: 'condition',
          defaultValue: 'new',
        },
        {
          ecommerceField: EcommerceFieldType.PRODUCT_IMAGE,
          sourceField: 'imageUrl',
        }
      ]
    },

    [MarketplaceType.CUSTOM]: {
      marketplaceType: MarketplaceType.CUSTOM,
      templateName: 'Custom Template',
      description: 'Customizable template for any marketplace',
      fileFormat: 'csv',
      csvDelimiter: ',',
      csvQuote: '"',
      fieldMappings: []
    }
  };

  /**
   * Get predefined template for a marketplace
   */
  getMarketplaceTemplate(marketplaceType: MarketplaceType): MarketplaceTemplateDto {
    const template = this.marketplaceTemplates[marketplaceType];
    if (!template) {
      throw new BadRequestException(`No template found for marketplace: ${marketplaceType}`);
    }
    return { ...template }; // Return a copy
  }

  /**
   * Get all available marketplace types
   */
  getAvailableMarketplaces(): MarketplaceType[] {
    return Object.values(MarketplaceType);
  }

  /**
   * Get field mapping options for a marketplace
   */
  getMarketplaceFields(marketplaceType: MarketplaceType): EcommerceFieldType[] {
    const template = this.getMarketplaceTemplate(marketplaceType);
    return template.fieldMappings.map(mapping => mapping.ecommerceField);
  }

  /**
   * Validate field mappings for a marketplace
   */
  validateFieldMappings(marketplaceType: MarketplaceType, fieldMappings: FieldMappingDto[]): boolean {
    const template = this.getMarketplaceTemplate(marketplaceType);
    
    // Check for required fields based on marketplace
    const requiredFields = this.getRequiredFields(marketplaceType);
    const providedFields = fieldMappings.map(mapping => mapping.ecommerceField);
    
    const missingFields = requiredFields.filter(field => !providedFields.includes(field));
    
    if (missingFields.length > 0) {
      throw new BadRequestException(`Missing required fields for ${marketplaceType}: ${missingFields.join(', ')}`);
    }
    
    return true;
  }

  /**
   * Get required fields for a marketplace
   */
  private getRequiredFields(marketplaceType: MarketplaceType): EcommerceFieldType[] {
    switch (marketplaceType) {
      case MarketplaceType.AMAZON:
        return [
          EcommerceFieldType.PRODUCT_NAME,
          EcommerceFieldType.SKU,
          EcommerceFieldType.PRICE,
          EcommerceFieldType.CATEGORY
        ];
      case MarketplaceType.ALIEXPRESS:
        return [
          EcommerceFieldType.PRODUCT_NAME,
          EcommerceFieldType.PRICE,
          EcommerceFieldType.CATEGORY
        ];
      case MarketplaceType.EBAY:
        return [
          EcommerceFieldType.PRODUCT_NAME,
          EcommerceFieldType.PRICE,
          EcommerceFieldType.EBAY_CATEGORY_ID,
          EcommerceFieldType.EBAY_CONDITION
        ];
      case MarketplaceType.ETSY:
        return [
          EcommerceFieldType.PRODUCT_NAME,
          EcommerceFieldType.PRICE,
          EcommerceFieldType.ETSY_TAGS
        ];
      case MarketplaceType.SHOPIFY:
        return [
          EcommerceFieldType.SHOPIFY_HANDLE,
          EcommerceFieldType.PRODUCT_NAME,
          EcommerceFieldType.PRICE
        ];
      case MarketplaceType.WALMART:
        return [
          EcommerceFieldType.PRODUCT_NAME,
          EcommerceFieldType.SKU,
          EcommerceFieldType.PRICE,
          EcommerceFieldType.WALMART_GTIN
        ];
      case MarketplaceType.GOOGLE_SHOPPING:
        return [
          EcommerceFieldType.PRODUCT_NAME,
          EcommerceFieldType.PRICE,
          EcommerceFieldType.GOOGLE_PRODUCT_CATEGORY,
          EcommerceFieldType.BRAND,
          EcommerceFieldType.GOOGLE_CONDITION
        ];
      default:
        return [EcommerceFieldType.PRODUCT_NAME, EcommerceFieldType.PRICE];
    }
  }

  /**
   * Get human-readable field names for UI
   */
  getFieldDisplayName(field: EcommerceFieldType): string {
    const fieldNames: Record<EcommerceFieldType, string> = {
      [EcommerceFieldType.PRODUCT_NAME]: 'Product Name',
      [EcommerceFieldType.PRODUCT_DESCRIPTION]: 'Product Description',
      [EcommerceFieldType.SKU]: 'SKU',
      [EcommerceFieldType.PRICE]: 'Price',
      [EcommerceFieldType.BRAND]: 'Brand',
      [EcommerceFieldType.CATEGORY]: 'Category',
      [EcommerceFieldType.PRODUCT_IMAGE]: 'Product Image',
      [EcommerceFieldType.ADDITIONAL_IMAGES]: 'Additional Images',
      [EcommerceFieldType.WEIGHT]: 'Weight',
      [EcommerceFieldType.DIMENSIONS]: 'Dimensions',
      [EcommerceFieldType.INVENTORY_QUANTITY]: 'Inventory Quantity',
      [EcommerceFieldType.SHIPPING_WEIGHT]: 'Shipping Weight',
      [EcommerceFieldType.SHIPPING_CLASS]: 'Shipping Class',
      [EcommerceFieldType.TAX_CLASS]: 'Tax Class',
      [EcommerceFieldType.STATUS]: 'Status',
      [EcommerceFieldType.VISIBILITY]: 'Visibility',
      
      // Amazon specific
      [EcommerceFieldType.AMAZON_ASIN]: 'Amazon ASIN',
      [EcommerceFieldType.AMAZON_BULLET_POINTS]: 'Amazon Bullet Points',
      [EcommerceFieldType.AMAZON_KEYWORDS]: 'Amazon Keywords',
      [EcommerceFieldType.AMAZON_PARENT_SKU]: 'Amazon Parent SKU',
      [EcommerceFieldType.AMAZON_VARIATION_THEME]: 'Amazon Variation Theme',
      
      // AliExpress specific
      [EcommerceFieldType.ALIEXPRESS_SHIPPING_TEMPLATE]: 'AliExpress Shipping Template',
      [EcommerceFieldType.ALIEXPRESS_CATEGORY_ID]: 'AliExpress Category ID',
      [EcommerceFieldType.ALIEXPRESS_LOGISTICS]: 'AliExpress Logistics',
      
      // eBay specific
      [EcommerceFieldType.EBAY_CATEGORY_ID]: 'eBay Category ID',
      [EcommerceFieldType.EBAY_CONDITION]: 'eBay Condition',
      [EcommerceFieldType.EBAY_LISTING_DURATION]: 'eBay Listing Duration',
      
      // Etsy specific
      [EcommerceFieldType.ETSY_TAGS]: 'Etsy Tags',
      [EcommerceFieldType.ETSY_MATERIALS]: 'Etsy Materials',
      [EcommerceFieldType.ETSY_OCCASION]: 'Etsy Occasion',
      
      // Shopify specific
      [EcommerceFieldType.SHOPIFY_PRODUCT_TYPE]: 'Shopify Product Type',
      [EcommerceFieldType.SHOPIFY_VENDOR]: 'Shopify Vendor',
      [EcommerceFieldType.SHOPIFY_HANDLE]: 'Shopify Handle',
      
      // Walmart specific
      [EcommerceFieldType.WALMART_CATEGORY]: 'Walmart Category',
      [EcommerceFieldType.WALMART_SUBCATEGORY]: 'Walmart Subcategory',
      [EcommerceFieldType.WALMART_GTIN]: 'Walmart GTIN',
      
      // Google Shopping specific
      [EcommerceFieldType.GOOGLE_PRODUCT_CATEGORY]: 'Google Product Category',
      [EcommerceFieldType.GOOGLE_GTIN]: 'Google GTIN',
      [EcommerceFieldType.GOOGLE_MPN]: 'Google MPN',
      [EcommerceFieldType.GOOGLE_CONDITION]: 'Google Condition'
    };
    
    return fieldNames[field] || field.toString();
  }

  /**
   * Apply transformations to field values
   */
  applyTransformation(value: string, transformation?: string): string {
    if (!transformation) return value;

    switch (transformation) {
      case 'status_to_amazon':
        return value.toLowerCase() === 'complete' ? 'Active' : 'Inactive';
      case 'status_to_availability':
        return value.toLowerCase() === 'complete' ? 'in stock' : 'out of stock';
      case 'name_to_handle':
        return value.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
      default:
        return value;
    }
  }
}