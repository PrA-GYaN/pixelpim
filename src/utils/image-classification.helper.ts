import { Logger } from '@nestjs/common';

/**
 * Image Classification Type
 */
export enum ImageClassificationType {
  MAIN_IMAGE = 'main',
  SUB_IMAGE = 'subimage',
  ASSET = 'asset',
  NONE = 'none'
}

/**
 * Result of image classification
 */
export interface ImageClassificationResult {
  type: ImageClassificationType;
  sku: string;
  identifier?: string;
  filename: string;
}

/**
 * Helper class for classifying images based on filename patterns.
 * 
 * Classification Rules:
 * 1. Main Image (product.mainImageUrl):
 *    - SKU.ext
 *    - SKU_image.ext
 *    - SKU-image.ext
 *    - SKU.image.ext
 *    - SKU.<anything>.ext where first part equals SKU exactly
 * 
 * 2. Sub Images (product.subImages[]):
 *    - SKU_SubImage.ext
 *    - SKU_subimage.ext
 *    - SKU SubImage.ext
 *    - SKU-SubImage.ext
 *    - SKU.SubImage.ext
 *    - SKU[SubImage].ext
 *    - Any filename containing "subimage" (case-insensitive) after the SKU
 * 
 * 3. Assets (product.assets[]):
 *    - SKU_Assets.ext
 *    - SKU_assets.ext
 *    - SKU Assets.ext
 *    - SKU-Assets.ext
 *    - SKU[Assets].ext
 *    - Any filename containing "asset" or "assets" (case-insensitive) after the SKU
 */
export class ImageClassificationHelper {
  private static readonly logger = new Logger(ImageClassificationHelper.name);

  // Common separators used in filenames
  private static readonly SEPARATORS = ['_', '-', ' ', '.', '['];

  /**
   * Normalize a filename for pattern matching by:
   * - Trimming whitespace
   * - Converting to lowercase
   * - Removing file extension
   */
  private static normalizeFilename(filename: string): string {
    return filename
      .trim()
      .replace(/\.[^.]+$/, '') // Remove extension
      .toLowerCase();
  }

  /**
   * Extract the base part and suffix from a filename using various separators
   */
  private static extractParts(normalizedName: string, sku: string): {
    base: string;
    suffix: string;
    separator: string;
  } | null {
    const skuLower = sku.toLowerCase();
    const nameLower = normalizedName.toLowerCase();

    // Check if the filename starts with the SKU
    if (!nameLower.startsWith(skuLower)) {
      return null;
    }

    // If exact match (no suffix), return empty suffix
    if (nameLower === skuLower) {
      return { base: skuLower, suffix: '', separator: '' };
    }

    // Try to find separator after SKU
    const afterSku = nameLower.substring(skuLower.length);
    
    // Check for bracket pattern: SKU[identifier]
    if (afterSku.startsWith('[')) {
      const endBracket = afterSku.indexOf(']');
      if (endBracket > 0) {
        const identifier = afterSku.substring(1, endBracket);
        return { base: skuLower, suffix: identifier, separator: '[' };
      }
    }

    // Check for other separators: _, -, space, .
    for (const sep of ['_', '-', ' ', '.']) {
      if (afterSku.startsWith(sep)) {
        const suffix = afterSku.substring(sep.length);
        return { base: skuLower, suffix, separator: sep };
      }
    }

    // No valid separator found
    return null;
  }

  /**
   * Classify an image based on its filename pattern relative to a product SKU.
   * 
   * @param filename - The image filename (e.g., "PROD-123_SubImage.jpg")
   * @param sku - The product SKU (e.g., "PROD-123")
   * @returns Classification result
   */
  static classifyImage(filename: string, sku: string): ImageClassificationResult {
    const normalizedName = this.normalizeFilename(filename);
    const skuLower = sku.toLowerCase();

    this.logger.debug(`Classifying: ${filename} for SKU: ${sku}`);

    // Extract parts from the filename
    const parts = this.extractParts(normalizedName, sku);

    if (!parts) {
      // Filename doesn't match SKU pattern
      return {
        type: ImageClassificationType.NONE,
        sku,
        filename
      };
    }

    const { suffix, separator } = parts;

    // Rule 1: Main Image - exact match or common image suffixes
    if (suffix === '') {
      // Exact match: SKU.ext
      this.logger.debug(`Main image (exact match): ${filename}`);
      return {
        type: ImageClassificationType.MAIN_IMAGE,
        sku,
        filename
      };
    }

    // Check for main image variations
    const mainImagePatterns = ['image', 'main', 'primary', 'front'];
    const suffixLower = suffix.toLowerCase();
    
    if (mainImagePatterns.some(pattern => suffixLower === pattern || suffixLower.startsWith(pattern))) {
      this.logger.debug(`Main image (pattern match): ${filename}`);
      return {
        type: ImageClassificationType.MAIN_IMAGE,
        sku,
        identifier: suffix,
        filename
      };
    }

    // Rule 2: Sub Images - contains "subimage" or "sub"
    if (suffixLower.includes('subimage') || 
        suffixLower.includes('sub-image') ||
        suffixLower.includes('sub_image') ||
        suffixLower === 'sub' ||
        suffixLower.startsWith('sub')) {
      this.logger.debug(`Sub image: ${filename}`);
      return {
        type: ImageClassificationType.SUB_IMAGE,
        sku,
        identifier: suffix,
        filename
      };
    }

    // Rule 3: Assets - contains "asset" or "assets"
    if (suffixLower.includes('asset') || suffixLower.includes('assets')) {
      this.logger.debug(`Asset: ${filename}`);
      return {
        type: ImageClassificationType.ASSET,
        sku,
        identifier: suffix,
        filename
      };
    }

    // Default: If no specific pattern matched, treat as asset
    // This includes patterns like SKU[Detail1], SKU[Manual], etc.
    this.logger.debug(`Asset (default): ${filename}`);
    return {
      type: ImageClassificationType.ASSET,
      sku,
      identifier: suffix,
      filename
    };
  }

  /**
   * Classify multiple images for a product
   * 
   * @param filenames - Array of image filenames
   * @param sku - The product SKU
   * @returns Array of classification results
   */
  static classifyImages(filenames: string[], sku: string): ImageClassificationResult[] {
    return filenames.map(filename => this.classifyImage(filename, sku));
  }

  /**
   * Group classified images by type
   * 
   * @param classifications - Array of classification results
   * @returns Grouped results by type
   */
  static groupByType(classifications: ImageClassificationResult[]): {
    mainImages: ImageClassificationResult[];
    subImages: ImageClassificationResult[];
    assets: ImageClassificationResult[];
    none: ImageClassificationResult[];
  } {
    const result = {
      mainImages: [] as ImageClassificationResult[],
      subImages: [] as ImageClassificationResult[],
      assets: [] as ImageClassificationResult[],
      none: [] as ImageClassificationResult[]
    };

    for (const classification of classifications) {
      switch (classification.type) {
        case ImageClassificationType.MAIN_IMAGE:
          result.mainImages.push(classification);
          break;
        case ImageClassificationType.SUB_IMAGE:
          result.subImages.push(classification);
          break;
        case ImageClassificationType.ASSET:
          result.assets.push(classification);
          break;
        case ImageClassificationType.NONE:
          result.none.push(classification);
          break;
      }
    }

    return result;
  }

  /**
   * Check if a filename is a main image for the given SKU
   * 
   * @param filename - The image filename
   * @param sku - The product SKU
   * @returns true if it's a main image
   */
  static isMainImage(filename: string, sku: string): boolean {
    const result = this.classifyImage(filename, sku);
    return result.type === ImageClassificationType.MAIN_IMAGE;
  }

  /**
   * Check if a filename is a sub-image for the given SKU
   * 
   * @param filename - The image filename
   * @param sku - The product SKU
   * @returns true if it's a sub-image
   */
  static isSubImage(filename: string, sku: string): boolean {
    const result = this.classifyImage(filename, sku);
    return result.type === ImageClassificationType.SUB_IMAGE;
  }

  /**
   * Check if a filename is an asset for the given SKU
   * 
   * @param filename - The image filename
   * @param sku - The product SKU
   * @returns true if it's an asset
   */
  static isAsset(filename: string, sku: string): boolean {
    const result = this.classifyImage(filename, sku);
    return result.type === ImageClassificationType.ASSET;
  }
}
