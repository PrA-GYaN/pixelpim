import { Injectable, Logger, BadRequestException, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
import csv from 'csv-parser';
import * as https from 'https';
import * as http from 'http';
import { Readable } from 'stream';
import { ProductService } from '../product.service';
import { AttributeType } from '../../types/attribute-type.enum';
import { Prisma } from '@prisma/client';

// Type definitions
interface CsvRow {
  [key: string]: string | undefined;
}

interface NormalizedCsvRow {
  name?: string;
  sku?: string;
  parentSku?: string;
  family?: string;
  category?: string;
  productLink?: string;
  imageUrl?: string;
  subImages?: string;
  [attribute: string]: string | undefined;
}

interface ImportResult {
  imported: number;
  errors: string[];
  totalProcessed: number;
  executionTime: number;
}

interface CachedEntity {
  id: number;
  name: string;
}

interface AttributeCache extends CachedEntity {
  type: string;
}

// Constants
const CSV_FIELD_MAPPINGS: Record<string, string> = {
  'product_name': 'name',
  'product name': 'name',
  'product_sku': 'sku',
  'product sku': 'sku',
  'parent_sku': 'parentSku',
  'parent sku': 'parentSku',
  'parent': 'parentSku',
  'family_name': 'family',
  'family name': 'family',
  'category_name': 'category',
  'category name': 'category',
  'product_link': 'productLink',
  'product link': 'productLink',
  'url': 'productLink',
  'image_url': 'imageUrl',
  'image url': 'imageUrl',
  'image': 'imageUrl',
  'sub_images': 'subImages',
  'sub images': 'subImages',
};

const SKIP_COLUMNS = new Set([
  'name', 'sku', 'parentSku', 'productLink', 'imageUrl', 'subImages', 'category', 'family', 'status'
]);

const ATTRIBUTE_TYPE_COMPATIBILITY: Record<string, string[]> = {
  'STRING': ['TEXT', 'EMAIL', 'URL', 'PHONE', 'COLOR'],
  'TEXT': ['STRING', 'HTML'],
  'NUMBER': ['INTEGER', 'FLOAT', 'CURRENCY', 'PERCENTAGE'],
  'INTEGER': ['NUMBER'],
  'ARRAY': ['STRING'],
};

const GOOGLE_SHEETS_REGEX = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)(?:\/.*)?$/;
const GOOGLE_SHEETS_PUB_REGEX = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)\/pub(?:\?.*)?$/;

const BATCH_SIZE = 10; // Process products in batches
const PROGRESS_LOG_INTERVAL = 50;
const MAX_REDIRECTS = 5;

@Injectable()
export class CsvImportService {
  private readonly logger = new Logger(CsvImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => ProductService))
    private readonly productService: ProductService,
  ) {}

  // Caching for performance optimization
  private categoryCache = new Map<string, CachedEntity>();
  private familyCache = new Map<string, CachedEntity>();
  private attributeCache = new Map<string, AttributeCache>();

  async importFromCsv(csvUrl: string, userId: number): Promise<ImportResult> {
    const startTime = Date.now();
    this.logger.log(`Starting CSV import from URL: ${csvUrl} for user: ${userId}`);

    try {
      // Initialize caches for this import session
      this.initializeCaches();

      // Download and parse CSV
      const csvData = await this.downloadCsv(csvUrl);
      const products = await this.parseCsv(csvData);

      this.logger.log(`CSV parsed successfully, found ${products.length} products to process`);

      // Process products in batches for better performance
      const result = await this.processProductsInBatches(products, userId, startTime);

      // Send success notification
      await this.sendSuccessNotification(userId, result, csvUrl);

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`CSV import failed after ${executionTime}ms: ${error.message}`, error);

      // Send failure notification
      await this.sendFailureNotification(userId, error.message, csvUrl, executionTime);

      throw new BadRequestException(`CSV import failed: ${error.message}`);
    }
  }

  private initializeCaches(): void {
    this.categoryCache.clear();
    this.familyCache.clear();
    this.attributeCache.clear();
  }

  private async processProductsInBatches(
    products: NormalizedCsvRow[],
    userId: number,
    startTime: number
  ): Promise<ImportResult> {
    let imported = 0;
    const errors: string[] = [];
    let processed = 0;

    // Process in batches to improve performance
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map((productData, index) =>
          this.createProductFromCsvRow(productData, userId, processed + index + 1)
        )
      );

      // Process batch results
      batchResults.forEach((result, batchIndex) => {
        processed++;
        const productData = batch[batchIndex];

        if (result.status === 'fulfilled') {
          imported++;
        } else {
          const productIdentifier = productData.name || productData.sku || `Row ${processed}`;
          const errorMessage = `Failed to import product '${productIdentifier}': ${result.reason.message}`;
          this.logger.error(`Error importing product at row ${processed}: ${JSON.stringify(productData, null, 2)}`, result.reason.stack);
          errors.push(errorMessage);
        }
      });

      // Log progress
      if (processed % PROGRESS_LOG_INTERVAL === 0 || processed === products.length) {
        this.logger.log(`Progress: ${processed}/${products.length} products processed, ${imported} imported, ${errors.length} errors`);
      }
    }

    const executionTime = Date.now() - startTime;
    const successRate = products.length > 0 ? ((imported / products.length) * 100).toFixed(2) : '0';

    this.logger.log(`CSV import completed in ${executionTime}ms. Total: ${products.length}, Imported: ${imported} (${successRate}%), Errors: ${errors.length}`);

    return { imported, errors, totalProcessed: products.length, executionTime };
  }

  private async sendSuccessNotification(userId: number, result: ImportResult, csvUrl: string): Promise<void> {
    const successRate = result.totalProcessed > 0 ? ((result.imported / result.totalProcessed) * 100).toFixed(2) : '0';

    await this.notificationService.createNotification(
      userId,
      'PRODUCT' as any,
      'BULK_CREATED' as any,
      'CSV Import',
      undefined,
      {
        imported: result.imported,
        errors: result.errors.slice(0, 10),
        totalErrors: result.errors.length,
        totalProcessed: result.totalProcessed,
        successRate: parseFloat(successRate),
        executionTime: result.executionTime,
        csvUrl
      }
    );
  }

  private async sendFailureNotification(userId: number, errorMessage: string, csvUrl: string, executionTime: number): Promise<void> {
    await this.notificationService.createNotification(
      userId,
      'PRODUCT' as any,
      'BULK_IMPORT_FAILED' as any,
      'CSV Import Failed',
      undefined,
      { error: errorMessage, csvUrl, executionTime }
    );
  }

  private async downloadCsv(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Check if it's a Google Spreadsheet URL and convert to CSV export URL
      let downloadUrl = url;
      const match = url.match(GOOGLE_SHEETS_REGEX);
      const pubMatch = url.match(GOOGLE_SHEETS_PUB_REGEX);

      if (pubMatch) {
        const spreadsheetId = pubMatch[1];
        downloadUrl = `https://docs.google.com/spreadsheets/d/e/${spreadsheetId}/pub?output=csv`;
        this.logger.debug(`Converted Google published sheet URL to CSV export URL: ${downloadUrl}`);
      } else if (match) {
        const spreadsheetId = match[1];
        downloadUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=0`;
        this.logger.debug(`Converted Google Spreadsheet URL to CSV export URL: ${downloadUrl}`);
      }

      this.downloadWithRedirects(downloadUrl, 0, resolve, reject);
    });
  }

  private downloadWithRedirects(
    url: string, 
    redirectCount: number, 
    resolve: (data: string) => void, 
    reject: (error: Error) => void,
    maxRedirects: number = MAX_REDIRECTS
  ): void {
    if (redirectCount > maxRedirects) {
      reject(new Error(`Too many redirects (${redirectCount})`));
      return;
    }

    const protocol = url.startsWith('https') ? https : http;

    this.logger.debug(`Downloading from: ${url} (redirect count: ${redirectCount})`);

    protocol.get(url, (response) => {
      const statusCode = response.statusCode || 0;
      
      // Handle redirects (301, 302, 307, 308)
      if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
        const redirectUrl = response.headers.location;
        this.logger.debug(`Following redirect (${statusCode}) to: ${redirectUrl}`);
        this.downloadWithRedirects(redirectUrl, redirectCount + 1, resolve, reject, maxRedirects);
        return;
      }

      if (statusCode !== 200) {
        this.logger.error(`Failed to download CSV: HTTP ${statusCode}, headers: ${JSON.stringify(response.headers)}`);
        reject(new Error(`Failed to download CSV: HTTP ${statusCode}`));
        return;
      }

      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        this.logger.log(`Downloaded CSV data (first 1000 characters): ${data.substring(0, 1000)}${data.length > 1000 ? '...' : ''}`);
        resolve(data);
      });
    }).on('error', (error) => {
      reject(new Error(`Failed to download CSV: ${error.message}`));
    });
  }

  private async parseCsv(csvData: string): Promise<NormalizedCsvRow[]> {
    return new Promise((resolve, reject) => {
      const results: NormalizedCsvRow[] = [];
      const stream = Readable.from(csvData);

      stream
        .pipe(csv())
        .on('data', (data: CsvRow) => {
          const normalizedData: NormalizedCsvRow = {};
          for (const [key, value] of Object.entries(data)) {
            const lowerKey = key.toLowerCase().trim();
            // Map variations to standard field names
            const finalKey = CSV_FIELD_MAPPINGS[lowerKey] || lowerKey;
            normalizedData[finalKey] = value;
          }
          results.push(normalizedData);
        })
        .on('end', () => {
          resolve(results);
        })
        .on('error', (error) => {
          reject(new Error(`Failed to parse CSV: ${error.message}`));
        });
    });
  }

  private async createProductFromCsvRow(row: NormalizedCsvRow, userId: number, rowNumber?: number): Promise<void> {
    this.logger.debug(`Processing product ${rowNumber || 'unknown'}: ${row.name || row.sku || 'Unknown'}`);

    // Validate required fields
    if (!row.name || !row.sku) {
      throw new Error('Missing required fields: name and sku are mandatory');
    }

    // Check if this product has a parent SKU (making it a variant)
    if (row.parentSku && row.parentSku.trim()) {
      await this.createVariantProduct(row, userId);
    } else {
      // Prepare product data for regular product
      const productData = await this.buildProductData(row, userId);
      await this.productService.upsertProductFromCsv(productData, userId);
    }
  }

  private async buildProductData(row: NormalizedCsvRow, userId: number): Promise<any> {
    // Handle category and family with caching
    const categoryId = row.category ? await this.getOrCreateCategory(row.category.trim(), userId) : undefined;
    const familyId = row.family ? await this.getOrCreateFamily(row.family.trim(), userId) : undefined;

    // Parse attributes with caching - now returns attribute-value pairs
    const attributeValuePairs = await this.parseAndCreateAttributes(row, userId);

    return {
      name: row.name!.trim(),
      sku: row.sku!.trim(),
      productLink: row.productLink?.trim(),
      imageUrl: row.imageUrl?.trim(),
      subImages: this.parseSubImages(row.subImages || ''),
      categoryId,
      familyId,
      attributesWithValues: attributeValuePairs,
    };
  }

  private async createVariantProduct(row: NormalizedCsvRow, userId: number): Promise<void> {
    this.logger.debug(`Processing variant product with parent SKU: ${row.parentSku}`);

    const parentSku = row.parentSku!.trim();

    // Find or create the parent product
    let parentProduct = await this.prisma.product.findFirst({
      where: {
        sku: parentSku,
        userId,
        isDeleted: false,
      },
      include: {
        family: true,
        attributes: {
          include: {
            attribute: true,
          },
        },
      },
    });

    // If parent product doesn't exist, create it with basic info
    if (!parentProduct) {
      this.logger.warn(`Parent product with SKU ${parentSku} not found, creating placeholder product`);
      
      parentProduct = await this.prisma.product.create({
        data: {
          name: `Parent Product - ${parentSku}`,
          sku: parentSku,
          userId,
          status: 'incomplete',
        },
        include: {
          family: true,
          attributes: {
            include: {
              attribute: true,
            },
          },
        },
      });
    }

    // Verify parent is not a variant itself
    if (parentProduct.parentProductId) {
      throw new Error(`Cannot add variant to ${parentSku} because it is itself a variant. Variants cannot have their own variants.`);
    }

    // Build variant product data
    const categoryId = row.category ? await this.getOrCreateCategory(row.category.trim(), userId) : parentProduct.categoryId;
    const familyId = row.family ? await this.getOrCreateFamily(row.family.trim(), userId) : parentProduct.familyId;
    
    // Parse attributes for the variant
    const attributeValuePairs = await this.parseAndCreateAttributes(row, userId);

    // Check if variant with this SKU already exists
    const existingVariant = await this.prisma.product.findFirst({
      where: {
        sku: row.sku!.trim(),
        userId,
        isDeleted: false,
      },
    });

    if (existingVariant) {
      // Update existing variant
      this.logger.log(`Updating existing variant product: ${row.sku}`);
      
      await this.prisma.product.update({
        where: { id: existingVariant.id },
        data: {
          name: row.name!.trim(),
          productLink: row.productLink?.trim(),
          imageUrl: row.imageUrl?.trim(),
          subImages: this.parseSubImages(row.subImages || ''),
          categoryId,
          familyId,
          parentProductId: parentProduct.id,
        },
      });

      // Update attributes
      if (attributeValuePairs.length > 0) {
        // Remove existing product attributes
        await this.prisma.productAttribute.deleteMany({
          where: { 
            productId: existingVariant.id,
            familyAttributeId: null, // Only delete non-family attributes
          },
        });

        // Add new attributes
        for (const { attributeId, value } of attributeValuePairs) {
          await this.prisma.productAttribute.upsert({
            where: {
              productId_attributeId: {
                productId: existingVariant.id,
                attributeId,
              },
            },
            update: {
              value: value || null,
            },
            create: {
              productId: existingVariant.id,
              attributeId,
              value: value || null,
            },
          });
        }
      }

      // Recalculate status
      const status = await this.calculateProductStatus(existingVariant.id);
      await this.prisma.product.update({ 
        where: { id: existingVariant.id }, 
        data: { status } 
      });
    } else {
      // Create new variant
      this.logger.log(`Creating new variant product: ${row.sku} for parent: ${parentSku}`);
      
      const variant = await this.prisma.product.create({
        data: {
          name: row.name!.trim(),
          sku: row.sku!.trim(),
          productLink: row.productLink?.trim(),
          imageUrl: row.imageUrl?.trim(),
          subImages: this.parseSubImages(row.subImages || ''),
          categoryId,
          familyId,
          parentProductId: parentProduct.id,
          userId,
          status: 'incomplete',
        },
      });

      // Copy parent attributes to variant if no custom attributes provided
      if (attributeValuePairs.length === 0 && 'attributes' in parentProduct && parentProduct.attributes && Array.isArray(parentProduct.attributes) && parentProduct.attributes.length > 0) {
        const attributesToCopy = (parentProduct.attributes as any[]).map(attr => ({
          productId: variant.id,
          attributeId: attr.attributeId,
          familyAttributeId: attr.familyAttributeId,
          value: attr.value,
        }));

        await this.prisma.productAttribute.createMany({
          data: attributesToCopy,
          skipDuplicates: true,
        });
      } else if (attributeValuePairs.length > 0) {
        // Add custom attributes
        for (const { attributeId, value } of attributeValuePairs) {
          await this.prisma.productAttribute.create({
            data: {
              productId: variant.id,
              attributeId,
              value: value || null,
            },
          });
        }
      }

      // Calculate status
      const status = await this.calculateProductStatus(variant.id);
      await this.prisma.product.update({ 
        where: { id: variant.id }, 
        data: { status } 
      });
    }
  }

  private async calculateProductStatus(productId: number): Promise<string> {
    // Get the product with all its attributes and family attributes
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        family: {
          include: {
            familyAttributes: {
              where: { isRequired: true },
            },
          },
        },
        attributeGroup: {
          include: {
            attributes: {
              where: { required: true },
            },
          },
        },
        attributes: true,
      },
    });

    if (!product) {
      return 'incomplete';
    }

    // Check if all required family attributes have values
    if (product.family && product.family.familyAttributes.length > 0) {
      const familyAttributeIds = product.family.familyAttributes.map(fa => fa.attributeId);
      const productFamilyAttributes = product.attributes.filter(pa => 
        pa.familyAttributeId !== null && familyAttributeIds.includes(pa.attributeId)
      );
      
      if (productFamilyAttributes.length < product.family.familyAttributes.length) {
        return 'incomplete';
      }

      // Check if any required family attribute has no value
      const missingValues = productFamilyAttributes.some(pa => !pa.value || pa.value.trim() === '');
      if (missingValues) {
        return 'incomplete';
      }
    }

    // Check if all required attribute group attributes have values
    if (product.attributeGroup && product.attributeGroup.attributes.length > 0) {
      const requiredAttributeIds = product.attributeGroup.attributes.map(aga => aga.attributeId);
      const productRequiredAttributes = product.attributes.filter(pa => 
        requiredAttributeIds.includes(pa.attributeId)
      );
      
      if (productRequiredAttributes.length < product.attributeGroup.attributes.length) {
        return 'incomplete';
      }

      // Check if any required attribute has no value
      const missingValues = productRequiredAttributes.some(pa => !pa.value || pa.value.trim() === '');
      if (missingValues) {
        return 'incomplete';
      }
    }

    // Check basic required fields
    if (!product.name || !product.sku) {
      return 'incomplete';
    }

    return 'complete';
  }

  private parseSubImages(subImagesStr: string): string[] {
    if (!subImagesStr) return [];
    try {
      return JSON.parse(subImagesStr);
    } catch {
      return subImagesStr.split(',').map(url => url.trim());
    }
  }

  private async getOrCreateCategory(categoryName: string, userId: number): Promise<number> {
    const cacheKey = `${userId}:${categoryName}`;
    const cached = this.categoryCache.get(cacheKey);
    if (cached) {
      return cached.id;
    }

    const category = await this.findOrCreateCategory(categoryName, userId);
    this.categoryCache.set(cacheKey, { id: category, name: categoryName });
    return category;
  }

  private async getOrCreateFamily(familyName: string, userId: number): Promise<number> {
    const cacheKey = `${userId}:${familyName}`;
    const cached = this.familyCache.get(cacheKey);
    if (cached) {
      return cached.id;
    }

    const family = await this.findOrCreateFamily(familyName, userId);
    this.familyCache.set(cacheKey, { id: family, name: familyName });
    return family;
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

  private async findOrCreateCategory(categoryName: string, userId: number): Promise<number> {
    this.logger.debug(`Finding or creating category: ${categoryName} for user: ${userId}`);

    // First try to find existing category (assuming root category, parentCategoryId null)
    let category = await this.prisma.category.findFirst({
      where: {
        name: categoryName,
        userId,
        parentCategoryId: null,
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

  private async parseAndCreateAttributes(row: any, userId: number): Promise<{ attributeId: number; value: string }[]> {
    const attributeValuePairs: { attributeId: number; value: string }[] = [];
    
    // Define columns to skip (these are product fields, not attributes)
    const skipColumns = new Set([
      'name',
      'sku',
      'parentSku',
      'productLink',
      'imageUrl',
      'subImages',
      'category',
      'family',
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
        attributeValuePairs.push({
          attributeId,
          value: String(columnValue).trim()
        });

        this.logger.debug(`Processed attribute: ${attributeName} (ID: ${attributeId}) with value: ${columnValue}`);
      } catch (error) {
        this.logger.error(`Failed to process attribute ${columnName}: ${error.message}`);
        // Continue processing other attributes instead of failing the entire import
      }
    }

    return attributeValuePairs;
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
