/**
 * WooCommerce Import Domain Models & Validation
 * 
 * This file defines clear domain boundaries between:
 * - WooCommerce data structures
 * - Local product/variant entities
 * - System fields vs custom attributes
 * 
 * Purpose: Prevent data corruption, enable proper validation, and maintain clean separation of concerns
 */

import { Logger } from '@nestjs/common';

const logger = new Logger('WooCommerceImportDomain');

// ============================================================================
// DOMAIN INTERFACES
// ============================================================================

/**
 * Represents a product in our local system
 * Parent products do NOT have parentProductId (or it's null)
 */
export interface LocalProduct {
  name: string;
  sku: string;
  productLink?: string;
  imageUrl?: string;
  subImages?: string[];
  categoryId?: number | null;
  userId: number;
  status: 'draft' | 'complete' | 'pending';
  parentProductId?: null; // Explicitly null for parent products
}

/**
 * Represents a variant (child product) in our local system
 * Variants MUST have a valid parentProductId
 */
export interface LocalVariant {
  name: string;
  sku: string;
  productLink?: string;
  imageUrl?: string;
  subImages?: string[];
  userId: number;
  status: 'draft' | 'complete' | 'pending';
  parentProductId: number; // REQUIRED - always references parent
}

/**
 * Custom attribute to be created/updated
 */
export interface AttributeToCreate {
  name: string;
  value: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN';
}

/**
 * Product data ready for database persistence
 */
export interface ProductDataWithAttributes {
  productData: LocalProduct;
  attributes: AttributeToCreate[];
}

/**
 * Variant data ready for database persistence
 */
export interface VariantDataWithAttributes {
  variantData: LocalVariant;
  attributes: AttributeToCreate[];
}

// ============================================================================
// WOOCOMMERCE FIELD CLASSIFICATION
// ============================================================================

/**
 * System fields that map to our product schema
 * These should NEVER be stored as custom attributes
 * Note: description and short_description are handled through field mappings as custom attributes
 */
export const PRODUCT_SYSTEM_FIELDS = new Set([
  'name',
  'sku',
  'type',
  'status',
  'featured',
  'catalog_visibility',
  'slug',
  'permalink',
  'date_created',
  'date_modified',
]);

/**
 * Fields that belong ONLY to variants
 * These should NOT pollute parent products
 */
export const VARIANT_ONLY_FIELDS = new Set([
  'regular_price',
  'sale_price',
  'date_on_sale_from',
  'date_on_sale_to',
  'stock_quantity',
  'stock_status',
  'manage_stock',
  'backorders',
  'weight',
  'dimensions',
]);

/**
 * Fields that can belong to both parent and variant
 */
export const SHARED_FIELDS = new Set([
  'images',
  'image',
]);

/**
 * Special fields that trigger specific behavior
 */
export const SPECIAL_FIELDS = new Set([
  'categories',
  'tags',
  'attributes',
  'variants',
  'variations',
]);

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

export class WooCommerceValidator {
  /**
   * Validate WooCommerce product payload
   */
  static validateWooProduct(wooProduct: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!wooProduct) {
      errors.push('WooCommerce product is null or undefined');
      return { valid: false, errors };
    }

    if (!wooProduct.id) {
      errors.push('WooCommerce product missing ID');
    }

    if (!wooProduct.name || typeof wooProduct.name !== 'string' || wooProduct.name.trim() === '') {
      errors.push('WooCommerce product missing or invalid name');
    }

    if (!wooProduct.sku || typeof wooProduct.sku !== 'string' || wooProduct.sku.trim() === '') {
      errors.push('WooCommerce product missing or invalid SKU');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate WooCommerce variation payload
   */
  static validateWooVariation(variation: any, parentWooProductId: number): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!variation) {
      errors.push('WooCommerce variation is null or undefined');
      return { valid: false, errors };
    }

    if (!variation.id) {
      errors.push('WooCommerce variation missing ID');
    }

    // Variations may not always have their own SKU, we can generate one
    // but log a warning
    if (!variation.sku) {
      logger.warn(`Variation ${variation.id} missing SKU, will generate one`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate local product data before persistence
   */
  static validateLocalProduct(data: LocalProduct): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.name || data.name.trim() === '') {
      errors.push('Product name is required');
    }

    if (!data.sku || data.sku.trim() === '') {
      errors.push('Product SKU is required');
    }

    if (!data.userId || data.userId <= 0) {
      errors.push('Valid userId is required');
    }

    // Parent product should NOT have parentProductId
    if (data.parentProductId !== undefined && data.parentProductId !== null) {
      errors.push('Parent product should not have parentProductId');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate local variant data before persistence
   */
  static validateLocalVariant(data: LocalVariant): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.name || data.name.trim() === '') {
      errors.push('Variant name is required');
    }

    if (!data.sku || data.sku.trim() === '') {
      errors.push('Variant SKU is required');
    }

    if (!data.userId || data.userId <= 0) {
      errors.push('Valid userId is required');
    }

    // Variant MUST have parentProductId
    if (!data.parentProductId || data.parentProductId <= 0) {
      errors.push('Variant must have valid parentProductId');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Check if parent product SKU matches any variation SKU
   * This prevents data corruption where variant lookup finds parent product
   */
  static detectSkuConflicts(
    parentProductSku: string,
    variations: any[]
  ): { hasConflict: boolean; conflictingSKUs: string[] } {
    if (!parentProductSku || !variations || variations.length === 0) {
      return { hasConflict: false, conflictingSKUs: [] };
    }

    const normalizedParentSku = parentProductSku.trim().toLowerCase();
    const conflictingSKUs: string[] = [];

    for (const variation of variations) {
      // Check if variation has a SKU
      if (variation.sku) {
        const normalizedVariationSku = variation.sku.trim().toLowerCase();
        
        // Check for exact match
        if (normalizedVariationSku === normalizedParentSku) {
          conflictingSKUs.push(variation.sku);
          logger.warn(
            `SKU conflict detected: Variation ${variation.id} SKU "${variation.sku}" matches parent SKU "${parentProductSku}"`
          );
        }
      }
    }

    return {
      hasConflict: conflictingSKUs.length > 0,
      conflictingSKUs
    };
  }
}

// ============================================================================
// FIELD MAPPING STRATEGIES
// ============================================================================

export class FieldMappingStrategy {
  /**
   * Determine if a WooCommerce field should be stored as a custom attribute
   * or mapped to a system field
   */
  static shouldStoreAsAttribute(wooField: string, isVariant: boolean): boolean {
    // System fields are never stored as attributes
    if (PRODUCT_SYSTEM_FIELDS.has(wooField)) {
      return false;
    }

    // Special fields are handled separately
    if (SPECIAL_FIELDS.has(wooField)) {
      return false;
    }

    // Variant-only fields on parent products should NOT be stored
    if (!isVariant && VARIANT_ONLY_FIELDS.has(wooField)) {
      logger.warn(`Variant-only field "${wooField}" detected on parent product - will skip`);
      return false;
    }

    // Everything else can be stored as custom attribute
    return true;
  }

  /**
   * Map WooCommerce system field to local product field
   * Note: description and short_description are handled through field mappings as custom attributes
   */
  static mapSystemField(wooField: string, wooValue: any): { field: string; value: any } | null {
    switch (wooField) {
      case 'name':
        return { field: 'name', value: String(wooValue || '') };
      case 'sku':
        return { field: 'sku', value: String(wooValue || '') };
      case 'status':
        // Map WooCommerce status to our status
        const statusMap: Record<string, string> = {
          'publish': 'complete',
          'draft': 'draft',
          'pending': 'pending',
        };
        return { field: 'status', value: statusMap[wooValue] || 'draft' };
      default:
        return null;
    }
  }

  /**
   * Extract variant-specific fields that should become attributes
   * @deprecated This method bypasses import mapping configuration and should not be used.
   * Use processFieldMappings with isVariant=true instead to respect user-defined mappings.
   */
  static extractVariantFields(wooVariation: any): AttributeToCreate[] {
    const attributes: AttributeToCreate[] = [];

    VARIANT_ONLY_FIELDS.forEach(field => {
      const value = wooVariation[field];
      if (value !== undefined && value !== null && value !== '') {
        attributes.push({
          name: field,
          value: String(value),
          type: this.inferAttributeType(field, value),
        });
      }
    });

    return attributes;
  }

  /**
   * Infer attribute type from field name and value
   */
  static inferAttributeType(fieldName: string, value: any): 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' {
    // Check field name patterns
    if (fieldName.includes('price') || fieldName.includes('weight') || fieldName.includes('quantity')) {
      return 'NUMBER';
    }
    if (fieldName.includes('date') || fieldName === 'date_created' || fieldName === 'date_modified') {
      return 'DATE';
    }
    if (typeof value === 'boolean') {
      return 'BOOLEAN';
    }
    if (typeof value === 'number') {
      return 'NUMBER';
    }
    return 'TEXT';
  }
}

// ============================================================================
// PRODUCT BUILDER
// ============================================================================

export class LocalProductBuilder {
  private logger = new Logger('LocalProductBuilder');

  /**
   * Build parent product data from WooCommerce product
   */
  buildParentProduct(
    wooProduct: any,
    userId: number,
    attributeMappings: Record<string, string>,
    fieldMappings: Record<string, string>,
  ): ProductDataWithAttributes {
    // Validate input
    const validation = WooCommerceValidator.validateWooProduct(wooProduct);
    if (!validation.valid) {
      throw new Error(`Invalid WooCommerce product: ${validation.errors.join(', ')}`);
    }

    // Build base product data
    const productData: LocalProduct = {
      name: wooProduct.name.trim(),
      sku: wooProduct.sku.trim(),
      userId,
      status: 'complete',
      parentProductId: null, // Explicitly null for parent
    };

    // Handle images
    if (wooProduct.images && Array.isArray(wooProduct.images) && wooProduct.images.length > 0) {
      productData.imageUrl = wooProduct.images[0].src;
      if (wooProduct.images.length > 1) {
        productData.subImages = wooProduct.images.slice(1).map((img: any) => img.src);
      }
    } else if (wooProduct.image?.src) {
      productData.imageUrl = wooProduct.image.src;
    }

    // Build attributes
    const attributes: AttributeToCreate[] = [];

    // Process WooCommerce attributes using mapping
    if (wooProduct.attributes && Array.isArray(wooProduct.attributes)) {
      this.processWooAttributes(wooProduct.attributes, attributeMappings, attributes);
    }

    // Process field mappings (but exclude variant-only fields)
    this.processFieldMappings(wooProduct, fieldMappings, attributes, false);

    // Validate built product
    const productValidation = WooCommerceValidator.validateLocalProduct(productData);
    if (!productValidation.valid) {
      throw new Error(`Invalid product data: ${productValidation.errors.join(', ')}`);
    }

    return { productData, attributes };
  }

  /**
   * Build variant data from WooCommerce variation
   */
  buildVariant(
    wooVariation: any,
    parentProductId: number,
    parentWooProductId: number,
    userId: number,
    attributeMappings: Record<string, string>,
    fieldMappings: Record<string, string>,
  ): VariantDataWithAttributes {
    // Validate input
    const validation = WooCommerceValidator.validateWooVariation(wooVariation, parentWooProductId);
    if (!validation.valid) {
      throw new Error(`Invalid WooCommerce variation: ${validation.errors.join(', ')}`);
    }

    // Build base variant data
    const variantData: LocalVariant = {
      name: wooVariation.sku || `Variant-${wooVariation.id}`,
      sku: wooVariation.sku || `VAR-${parentWooProductId}-${wooVariation.id}`,
      userId,
      status: 'complete',
      parentProductId, // REQUIRED - links to parent
    };

    // Handle variant image
    if (wooVariation.image?.src) {
      variantData.imageUrl = wooVariation.image.src;
    }

    // Build attributes
    const attributes: AttributeToCreate[] = [];

    // Process variation attributes (color, size, etc.) from WooCommerce attributes
    if (wooVariation.attributes && Array.isArray(wooVariation.attributes)) {
      this.processVariationAttributes(wooVariation.attributes, attributeMappings, attributes);
    }

    // Process field mappings for variant-specific fields (stock, price, dimensions, etc.)
    // This ensures only explicitly mapped fields are imported
    this.processFieldMappings(wooVariation, fieldMappings, attributes, true);

    // Validate built variant
    const variantValidation = WooCommerceValidator.validateLocalVariant(variantData);
    if (!variantValidation.valid) {
      throw new Error(`Invalid variant data: ${variantValidation.errors.join(', ')}`);
    }

    return { variantData, attributes };
  }

  /**
   * Process WooCommerce product attributes
   */
  private processWooAttributes(
    wooAttributes: any[],
    attributeMappings: Record<string, string>,
    attributes: AttributeToCreate[],
  ): void {
    // Check for "map all" wildcard
    const mapAll = attributeMappings['*'] === '*';

    for (const wooAttr of wooAttributes) {
      const attrName = wooAttr.slug || wooAttr.name;
      if (!attrName) continue;

      const attrValue = Array.isArray(wooAttr.options) 
        ? wooAttr.options.join(', ') 
        : String(wooAttr.option || '');

      if (!attrValue) continue;

      if (mapAll) {
        // Map all attributes with original name
        attributes.push({
          name: attrName,
          value: attrValue,
          type: 'TEXT',
        });
      } else if (attributeMappings[attrName]) {
        // Use explicit mapping
        attributes.push({
          name: attributeMappings[attrName],
          value: attrValue,
          type: 'TEXT',
        });
      }
    }
  }

  /**
   * Process variation attributes (color, size, etc.)
   */
  private processVariationAttributes(
    variationAttributes: any[],
    attributeMappings: Record<string, string>,
    attributes: AttributeToCreate[],
  ): void {
    const mapAll = attributeMappings['*'] === '*';

    for (const varAttr of variationAttributes) {
      const attrName = varAttr.name || varAttr.slug;
      const attrValue = varAttr.option;

      if (!attrName || !attrValue) continue;

      if (mapAll) {
        attributes.push({
          name: attrName,
          value: String(attrValue),
          type: 'TEXT',
        });
      } else if (attributeMappings[attrName]) {
        attributes.push({
          name: attributeMappings[attrName],
          value: String(attrValue),
          type: 'TEXT',
        });
      }
    }
  }

  /**
   * Process field mappings
   */
  private processFieldMappings(
    wooData: any,
    fieldMappings: Record<string, string>,
    attributes: AttributeToCreate[],
    isVariant: boolean,
  ): void {
    for (const [wooField, localFieldOrAttr] of Object.entries(fieldMappings)) {
      // Skip special fields
      if (SPECIAL_FIELDS.has(wooField)) continue;

      // Skip variant-only fields on parent products
      if (!isVariant && VARIANT_ONLY_FIELDS.has(wooField)) {
        this.logger.warn(`Skipping variant-only field "${wooField}" on parent product`);
        continue;
      }

      const value = wooData[wooField];
      if (value === undefined || value === null || value === '') continue;

      // Determine if this should be stored as attribute
      if (FieldMappingStrategy.shouldStoreAsAttribute(wooField, isVariant)) {
        attributes.push({
          name: localFieldOrAttr,
          value: String(value),
          type: FieldMappingStrategy.inferAttributeType(wooField, value),
        });
      }
    }
  }

  /**
   * Sanitize HTML content
   */
  private sanitizeHtml(html: string): string {
    if (!html) return '';
    return html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }
}
