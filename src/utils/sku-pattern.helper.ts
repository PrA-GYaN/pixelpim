import { Logger } from '@nestjs/common';

/**
 * Helper class for parsing SKU patterns with identifiers.
 * Supports format: SKU[Identifier] where identifier can be any alphanumeric value.
 * 
 * Examples:
 * - "PROD123[SubImage1]" -> { sku: "PROD123", identifier: "SubImage1" }
 * - "SKU-ABC[MainImage]" -> { sku: "SKU-ABC", identifier: "MainImage" }
 * - "PRODUCT-XYZ" -> null (no pattern match)
 */
export class SkuPatternHelper {
  private static readonly logger = new Logger(SkuPatternHelper.name);
  
  // Regex pattern to match SKU[Identifier]
  // Captures: SKU (any characters before bracket) and Identifier (content inside brackets)
  private static readonly SKU_PATTERN_REGEX = /^(.+?)\[([^\]]+)\]$/;
  
  // Regex pattern to match SKU with space/underscore followed by identifier
  // Captures: SKU (characters before space/underscore) and Identifier (after space/underscore)
  // Examples: "TPE-3 Asset2", "TPE-3_SubImage", "SKU Asset1"
  private static readonly SKU_SPACE_PATTERN_REGEX = /^(.+?)[\s_](.+)$/;

  /**
   * Parse a value that might contain SKU[Identifier] or SKU Identifier pattern
   * @param value - The value to parse (e.g., "PROD123[SubImage1]" or "PROD123 Asset1")
   * @param preferredSku - Optional SKU to validate against for space-based patterns
   * @returns Parsed result with sku and identifier, or null if no pattern match
   */
  static parseSkuPattern(value: string | null | undefined, preferredSku?: string): {
    sku: string;
    identifier: string;
    patternType: 'bracket' | 'space';
  } | null {
    if (!value || typeof value !== 'string') {
      return null;
    }

    const trimmedValue = value.trim();
    
    // First try bracket pattern SKU[Identifier]
    const bracketMatch = trimmedValue.match(this.SKU_PATTERN_REGEX);
    if (bracketMatch) {
      const sku = bracketMatch[1].trim();
      const identifier = bracketMatch[2].trim();

      // Validate that both parts are non-empty
      if (!sku || !identifier) {
        this.logger.warn(`Invalid SKU pattern: ${value} - both SKU and identifier must be non-empty`);
        return null;
      }

      return { sku, identifier, patternType: 'bracket' };
    }
    
    // Try space/underscore pattern if preferredSku is provided
    // This helps validate that the first part actually matches the expected SKU
    if (preferredSku) {
      const spaceMatch = trimmedValue.match(this.SKU_SPACE_PATTERN_REGEX);
      if (spaceMatch) {
        const sku = spaceMatch[1].trim();
        const identifier = spaceMatch[2].trim();
        
        // Validate that the SKU matches the expected SKU (case-insensitive)
        if (sku.toLowerCase() === preferredSku.toLowerCase() && identifier) {
          return { sku, identifier, patternType: 'space' };
        }
      }
    }

    return null;
  }

  /**
   * Check if a value contains the SKU[Identifier] pattern
   * @param value - The value to check
   * @returns true if the value matches the pattern
   */
  static hasSkuPattern(value: string | null | undefined): boolean {
    return this.parseSkuPattern(value) !== null;
  }

  /**
   * Process an array of values that might contain SKU[Identifier] patterns.
   * Separates normal URLs/values from SKU patterns.
   * 
   * @param values - Array of values to process
   * @returns Object containing regular values and parsed SKU patterns
   */
  static processValueArray(values: string[]): {
    regularValues: string[];
    skuPatterns: Array<{ sku: string; identifier: string; originalValue: string }>;
  } {
    const regularValues: string[] = [];
    const skuPatterns: Array<{ sku: string; identifier: string; originalValue: string }> = [];

    for (const value of values) {
      if (!value || typeof value !== 'string') {
        continue;
      }

      const parsed = this.parseSkuPattern(value);
      if (parsed) {
        skuPatterns.push({
          sku: parsed.sku,
          identifier: parsed.identifier,
          originalValue: value,
        });
      } else {
        regularValues.push(value);
      }
    }

    return { regularValues, skuPatterns };
  }

  /**
   * Extract all unique SKUs from an array of values containing SKU patterns
   * @param values - Array of values that might contain SKU patterns
   * @returns Array of unique SKUs found in the patterns
   */
  static extractSkusFromPatterns(values: string[]): string[] {
    const skus = new Set<string>();
    
    for (const value of values) {
      const parsed = this.parseSkuPattern(value);
      if (parsed) {
        skus.add(parsed.sku);
      }
    }

    return Array.from(skus);
  }

  /**
   * Group SKU patterns by their SKU value
   * @param values - Array of values containing SKU patterns
   * @returns Map of SKU to array of identifiers
   */
  static groupPatternsBySku(values: string[]): Map<string, string[]> {
    const groupedMap = new Map<string, string[]>();

    for (const value of values) {
      const parsed = this.parseSkuPattern(value);
      if (parsed) {
        const existing = groupedMap.get(parsed.sku) || [];
        existing.push(parsed.identifier);
        groupedMap.set(parsed.sku, existing);
      }
    }

    return groupedMap;
  }

  /**
   * Validate SKU pattern format
   * @param value - The value to validate
   * @returns Object with validation result and error message if invalid
   */
  static validateSkuPattern(value: string): {
    valid: boolean;
    error?: string;
  } {
    if (!value || typeof value !== 'string') {
      return { valid: false, error: 'Value must be a non-empty string' };
    }

    const trimmedValue = value.trim();
    
    // Check if it has opening bracket without closing
    if (trimmedValue.includes('[') && !trimmedValue.includes(']')) {
      return { valid: false, error: 'Missing closing bracket ]' };
    }

    // Check if it has closing bracket without opening
    if (!trimmedValue.includes('[') && trimmedValue.includes(']')) {
      return { valid: false, error: 'Missing opening bracket [' };
    }

    // If it contains brackets, validate the full pattern
    if (trimmedValue.includes('[')) {
      const parsed = this.parseSkuPattern(trimmedValue);
      if (!parsed) {
        return { valid: false, error: 'Invalid SKU pattern format. Expected: SKU[Identifier]' };
      }
      
      // Additional validation: identifier should not contain special characters that might cause issues
      if (!/^[a-zA-Z0-9_-]+$/.test(parsed.identifier)) {
        return { 
          valid: false, 
          error: 'Identifier should only contain alphanumeric characters, hyphens, and underscores' 
        };
      }
    }

    return { valid: true };
  }
}
