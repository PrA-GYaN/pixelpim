import { Injectable, Logger, BadRequestException, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
import csv from 'csv-parser';
import * as https from 'https';
import * as http from 'http';
import { Readable } from 'stream';
import { ProductService } from '../product.service';
import { AttributeType } from '../../types/attribute-type.enum';

@Injectable()
export class CsvImportService {
  private readonly logger = new Logger(CsvImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => ProductService))
    private readonly productService: ProductService,
  ) {}

  async importFromCsv(csvUrl: string, userId: number): Promise<{ imported: number; errors: string[]; totalProcessed: number; executionTime: number }> {
    const startTime = Date.now();
    this.logger.log(`Starting CSV import from URL: ${csvUrl} for user: ${userId}`);

    try {
      // Download CSV with detailed logging
      this.logger.debug(`Downloading CSV from: ${csvUrl}`);
      const csvData = await this.downloadCsv(csvUrl);
      this.logger.debug(`CSV downloaded successfully, size: ${csvData.length} characters`);

      // Parse CSV with logging
      this.logger.debug('Parsing CSV data');
      const products = await this.parseCsv(csvData);
      this.logger.log(`CSV parsed successfully, found ${products.length} products to process`);

      let imported = 0;
      const errors: string[] = [];
      let processed = 0;

      for (const productData of products) {
        processed++;
        try {
          this.logger.debug(`Processing product ${processed}/${products.length}: ${productData.name || productData.sku || 'Unknown'}`);
          await this.createProductFromCsvRow(productData, userId);
          imported++;
          
          // Log progress every 50 items for better visibility
          if (processed % 50 === 0) {
            this.logger.log(`Progress: ${processed}/${products.length} products processed, ${imported} imported, ${errors.length} errors`);
          }
        } catch (error) {
          const productIdentifier = productData.name || productData.sku || `Row ${processed}`;
          const errorMessage = `Failed to import product '${productIdentifier}': ${error.message}`;
          this.logger.error(`Error importing product at row ${processed}: ${JSON.stringify(productData, null, 2)}`, error.stack);
          errors.push(errorMessage);
        }
      }

      const executionTime = Date.now() - startTime;
      const successRate = products.length > 0 ? ((imported / products.length) * 100).toFixed(2) : '0';
      
      this.logger.log(`CSV import completed in ${executionTime}ms. Total: ${products.length}, Imported: ${imported} (${successRate}%), Errors: ${errors.length}`);

      // Send notification with enhanced metadata
      await this.notificationService.createNotification(
        userId,
        'PRODUCT' as any,
        'BULK_CREATED' as any,
        'CSV Import',
        undefined,
        { 
          imported, 
          errors: errors.slice(0, 10), // Limit error array size in notification
          totalErrors: errors.length,
          totalProcessed: products.length,
          successRate: parseFloat(successRate),
          executionTime,
          csvUrl
        }
      );

      return { 
        imported, 
        errors, 
        totalProcessed: products.length, 
        executionTime 
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`CSV import failed after ${executionTime}ms: ${error.message}`, error);
      
      // Send failure notification
      await this.notificationService.createNotification(
        userId,
        'PRODUCT' as any,
        'BULK_IMPORT_FAILED' as any,
        'CSV Import Failed',
        undefined,
        { 
          error: error.message,
          csvUrl,
          executionTime
        }
      );
      
      throw new BadRequestException(`CSV import failed: ${error.message}`);
    }
  }

  private async downloadCsv(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;

      protocol.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download CSV: HTTP ${response.statusCode}`));
          return;
        }

        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          resolve(data);
        });
      }).on('error', (error) => {
        reject(new Error(`Failed to download CSV: ${error.message}`));
      });
    });
  }

  private async parseCsv(csvData: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const stream = Readable.from(csvData);

      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          resolve(results);
        })
        .on('error', (error) => {
          reject(new Error(`Failed to parse CSV: ${error.message}`));
        });
    });
  }

  private async createProductFromCsvRow(row: any, userId: number): Promise<void> {
    // Map CSV columns to product fields - name and sku are required
    const productName = row.name || row.Name || row.product_name;
    const productSku = row.sku || row.SKU || row.product_sku;

    // Validate required fields first
    if (!productName || !productSku) {
      throw new Error('Missing required fields: name and sku are mandatory');
    }

    // Parse optional fields
    const productLink = row.productLink || row.product_link || row.url;
    const imageUrl = row.imageUrl || row.image_url || row.image;
    const subImages = this.parseSubImages(row.subImages || row.sub_images);
    
    // Handle category by name (create if doesn't exist)
    let categoryId: number | undefined;
    const categoryName = row.categoryName || row.category_name || row.category;
    if (categoryName) {
      categoryId = await this.findOrCreateCategory(categoryName.trim(), userId);
    }

    // Handle family by name (create if doesn't exist)  
    let familyId: number | undefined;
    const familyName = row.familyName || row.family_name || row.family;
    if (familyName) {
      familyId = await this.findOrCreateFamily(familyName.trim(), userId);
    }

    // Parse and handle attributes by name (create if don't exist)
    const attributes = await this.parseAndCreateAttributes(row, userId);

    const productData = {
      name: productName.trim(),
      sku: productSku.trim(),
      productLink: productLink?.trim(),
      imageUrl: imageUrl?.trim(),
      subImages,
      status: 'incomplete',
      categoryId,
      familyId,
      attributes,
    };

    await this.productService.create(productData, userId);
  }

  private parseSubImages(subImagesStr: string): string[] {
    if (!subImagesStr) return [];
    try {
      return JSON.parse(subImagesStr);
    } catch {
      return subImagesStr.split(',').map(url => url.trim());
    }
  }

  private async findOrCreateCategory(categoryName: string, userId: number): Promise<number> {
    this.logger.debug(`Finding or creating category: ${categoryName} for user: ${userId}`);
    
    // First try to find existing category
    let category = await this.prisma.category.findFirst({
      where: {
        name: categoryName,
        userId,
        parentCategoryId: null, // Only look for root categories for simplicity
      },
    });

    if (!category) {
      this.logger.debug(`Category ${categoryName} not found, creating new one`);
      // Create new category
      category = await this.prisma.category.create({
        data: {
          name: categoryName,
          userId,
        },
      });
      this.logger.debug(`Created new category with ID: ${category.id}`);
    }

    return category.id;
  }

  private async findOrCreateFamily(familyName: string, userId: number): Promise<number> {
    this.logger.debug(`Finding or creating family: ${familyName} for user: ${userId}`);
    
    // First try to find existing family
    let family = await this.prisma.family.findUnique({
      where: {
        name_userId: {
          name: familyName,
          userId,
        },
      },
    });

    if (!family) {
      this.logger.debug(`Family ${familyName} not found, creating new one`);
      // Create new family
      family = await this.prisma.family.create({
        data: {
          name: familyName,
          userId,
        },
      });
      this.logger.debug(`Created new family with ID: ${family.id}`);
    }

    return family.id;
  }

  private async findOrCreateAttribute(attributeName: string, attributeValue: any, userId: number): Promise<number> {
    this.logger.debug(`Finding or creating attribute: ${attributeName} for user: ${userId}`);
    
    // First try to find existing attribute
    let attribute = await this.prisma.attribute.findUnique({
      where: {
        name_userId: {
          name: attributeName,
          userId,
        },
      },
    });

    if (!attribute) {
      this.logger.debug(`Attribute ${attributeName} not found, creating new one`);
      
      // Infer attribute type from value
      const attributeType = this.inferAttributeType(attributeValue);
      
      // Create new attribute
      attribute = await this.prisma.attribute.create({
        data: {
          name: attributeName,
          type: attributeType,
          userId,
        },
      });
      this.logger.debug(`Created new attribute with ID: ${attribute.id}, type: ${attributeType}`);
    } else {
      // Validate that the existing attribute type matches the data
      const expectedType = this.inferAttributeType(attributeValue);
      if (!this.isAttributeTypeCompatible(attribute.type, expectedType, attributeValue)) {
        this.logger.warn(`Attribute ${attributeName} type mismatch. Expected: ${expectedType}, Found: ${attribute.type}. Value: ${attributeValue}`);
        // You can choose to either throw an error or convert the value
        // For now, we'll log a warning and proceed
      }
    }

    return attribute.id;
  }

  private inferAttributeType(value: any): string {
    if (value === null || value === undefined || value === '') {
      return 'STRING'; // Default to string for empty values
    }

    const strValue = String(value).trim();

    // Check for boolean values
    if (['true', 'false', '1', '0', 'yes', 'no'].includes(strValue.toLowerCase())) {
      return 'BOOLEAN';
    }

    // Check for integers
    if (/^-?\d+$/.test(strValue)) {
      return 'INTEGER';
    }

    // Check for decimal numbers
    if (/^-?\d*\.\d+$/.test(strValue)) {
      return 'NUMBER';
    }

    // Check for dates (basic patterns)
    if (/^\d{4}-\d{2}-\d{2}$/.test(strValue) || 
        /^\d{2}\/\d{2}\/\d{4}$/.test(strValue) || 
        /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(strValue)) {
      return 'DATE';
    }

    // Check for URLs
    if (/^https?:\/\/.+/i.test(strValue)) {
      return 'URL';
    }

    // Check for emails
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strValue)) {
      return 'EMAIL';
    }

    // Check for arrays/multiple values (comma-separated)
    if (strValue.includes(',') && strValue.split(',').length > 1) {
      return 'ARRAY';
    }

    // Check for long text (more than 255 characters)
    if (strValue.length > 255) {
      return 'TEXT';
    }

    // Default to STRING
    return 'STRING';
  }

  private isAttributeTypeCompatible(existingType: string, inferredType: string, value: any): boolean {
    // If types match exactly, they're compatible
    if (existingType === inferredType) {
      return true;
    }

    // Some types are compatible with each other
    const compatibilityMap: Record<string, string[]> = {
      'STRING': ['TEXT', 'EMAIL', 'URL', 'PHONE', 'COLOR'], // String can accept most text-based types
      'TEXT': ['STRING', 'HTML'], // Text can accept strings and HTML
      'NUMBER': ['INTEGER', 'FLOAT', 'CURRENCY', 'PERCENTAGE'], // Number types are interchangeable
      'INTEGER': ['NUMBER'],
      'ARRAY': ['STRING'], // Arrays can sometimes be stored as strings
    };

    return compatibilityMap[existingType]?.includes(inferredType) || 
           compatibilityMap[inferredType]?.includes(existingType) || 
           false;
  }

  private async parseAndCreateAttributes(row: any, userId: number): Promise<number[]> {
    const attributeIds: number[] = [];
    
    // Define columns to skip (these are product fields, not attributes)
    const skipColumns = new Set([
      'name', 'Name', 'product_name',
      'sku', 'SKU', 'product_sku',
      'productLink', 'product_link', 'url',
      'imageUrl', 'image_url', 'image',
      'subImages', 'sub_images',
      'categoryName', 'category_name', 'category',
      'familyName', 'family_name', 'family',
      'status'
    ]);

    // Process each column in the CSV row as a potential attribute
    for (const [columnName, columnValue] of Object.entries(row)) {
      // Skip if it's a product field or if value is empty
      if (skipColumns.has(columnName) || 
          columnValue === null || 
          columnValue === undefined || 
          String(columnValue).trim() === '') {
        continue;
      }

      try {
        // Clean up the attribute name
        const attributeName = columnName.trim().replace(/[_-]/g, ' ').replace(/\s+/g, ' ');
        
        // Find or create the attribute
        const attributeId = await this.findOrCreateAttribute(attributeName, columnValue, userId);
        attributeIds.push(attributeId);

        this.logger.debug(`Processed attribute: ${attributeName} (ID: ${attributeId}) with value: ${columnValue}`);
      } catch (error) {
        this.logger.error(`Failed to process attribute ${columnName}: ${error.message}`);
        // Continue processing other attributes instead of failing the entire import
      }
    }

    return attributeIds;
  }

  private parseAttributes(attributesStr: string): number[] {
    if (!attributesStr) return [];
    try {
      const parsed = JSON.parse(attributesStr);
      if (Array.isArray(parsed)) {
        return parsed.map(id => parseInt(id)).filter(id => !isNaN(id));
      }
      return [];
    } catch {
      // If not JSON, assume it's a comma-separated list of IDs
      return attributesStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    }
  }
}
