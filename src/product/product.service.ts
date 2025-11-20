import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { WebhookService } from '../webhook/webhook.service';
import { WebhookFormatterService } from '../webhook/webhook-formatter.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ImportProductsResponseDto, ImportProgressDto } from './dto/import-products.dto';
import { parseExcel } from '../utils/excel-parser';
import type { Express } from 'express';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductAttributesDto } from './dto/update-product-attribute.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { AddVariantDto, RemoveVariantDto, ProductVariantResponseDto, GetProductVariantsDto } from './dto/product-variant.dto';
import { ExportProductDto, ExportProductResponseDto, ProductAttribute, ExportFormat, AttributeSelectionDto } from './dto/export-product.dto';
import { ScheduleImportDto, UpdateScheduledImportDto, ImportJobResponseDto } from './dto/schedule-import.dto';
import { CsvImportService } from './services/csv-import.service';
import { ImportSchedulerService } from './services/import-scheduler.service';
import { ExcelImportService } from './services/excel-import.service';
import { PaginatedResponse, PaginationUtils } from '../common';
import { getUserFriendlyType } from '../types/user-attribute-type.enum';
import { Subject, Observable, interval } from 'rxjs';
import { map, takeWhile } from 'rxjs/operators';
import { randomBytes } from 'crypto';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  // Common Prisma include configurations
  private readonly PRODUCT_INCLUDE_FULL = {
    category: {
      select: {
        id: true,
        name: true,
        description: true,
      },
    },
    attributeGroup: {
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
        familyAttributes: {
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
      },
    },
    attributes: {
      select: {
        value: true,
        familyAttributeId: true,
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
    variants: {
      select: {
        id: true,
        name: true,
        sku: true,
        imageUrl: true,
        status: true,
      },
    },
  };

  // Cache for family attribute IDs to reduce database queries
  private familyAttributeCache = new Map<number, { data: number[]; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Progress tracking for imports
  private progressStreams = new Map<string, Subject<ImportProgressDto>>();
  private progressData = new Map<string, ImportProgressDto>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly webhookService: WebhookService,
    private readonly webhookFormatterService: WebhookFormatterService,
    @Inject(forwardRef(() => CsvImportService))
    private readonly csvImportService: CsvImportService,
    @Inject(forwardRef(() => ImportSchedulerService))
    private readonly importSchedulerService: ImportSchedulerService,
    @Inject(forwardRef(() => ExcelImportService))
    private readonly excelImportService: ExcelImportService,
  ) {}

  // How long to retain the last progress snapshot after completion so clients
  // that reload shortly after finishing can still reconnect and view the final
  // summary. This avoids progress UI disappearing immediately on reload.
  private readonly PROGRESS_RETENTION_MS = 5 * 60 * 1000; // 5 minutes

  // Generate a unique session ID for import tracking
  generateSessionId(): string {
    return randomBytes(16).toString('hex');
  }

  // Get import progress stream for SSE
  getImportProgressStream(sessionId: string, userId: number): Observable<MessageEvent> {
    let stream = this.progressStreams.get(sessionId);
    
    if (!stream) {
      stream = new Subject<ImportProgressDto>();
      this.progressStreams.set(sessionId, stream);
      // If we already have progress stored for this session, immediately emit it
      // so new subscribers (e.g. after a page reload) will receive the current
      // import progress without needing to wait for the next batch update.
      const cached = this.progressData.get(sessionId);
      if (cached) {
        // Emit asynchronously so creation flow completes before pushing the event
        setTimeout(() => stream!.next(cached), 0);
      }
    }

    // Clean up after completion
    return stream.pipe(
      map((progress) => ({
        data: progress,
      } as MessageEvent)),
      takeWhile((event: any) => event.data.status !== 'completed' && event.data.status !== 'error', true),
    );
  }

  // Update progress for a session
  private updateProgress(sessionId: string, progress: ImportProgressDto): void {
    this.progressData.set(sessionId, progress);
    const stream = this.progressStreams.get(sessionId);
    if (stream) {
      stream.next(progress);
      
      // Clean up on completion
      if (progress.status === 'completed' || progress.status === 'error') {
        setTimeout(() => {
          try {
            stream.complete();
          } catch (e) {
            this.logger.debug('Error completing progress stream', e);
          }
          // keep progressData for a short period so refreshed clients can fetch
          // the summary and the progress bar won't disappear immediately on a
          // page reload (improves UX). It will be removed after PROGRESS_RETENTION_MS.
          const timer = setTimeout(() => {
            this.progressStreams.delete(sessionId);
            this.progressData.delete(sessionId);
            clearTimeout(timer);
          }, this.PROGRESS_RETENTION_MS);
        }, 1000);
      }
    }
  }

  // Import with progress tracking
  async importProductsFromExcelWithProgress(
    file: Express.Multer.File, 
    mappingJson: string, 
    userId: number, 
    sessionId: string
  ): Promise<void> {
    const failedRows: Array<{ row: number; error: string }> = [];

    try {
      if (!file || !file.buffer) {
        throw new BadRequestException('Missing file upload');
      }

      // Initialize progress
      this.updateProgress(sessionId, {
        processed: 0,
        total: 0,
        successCount: 0,
        failedCount: 0,
        percentage: 0,
        status: 'processing',
        message: 'Starting Excel import with comprehensive validation...',
      });

      // ═══════════════════════════════════════════════════════════════════════════
      // STEP 1: Process Excel with comprehensive import service
      // This handles:
      // - Header processing with type inference
      // - Family-level attribute definitions
      // - Row-level validation
      // - Domain model transformation
      // ═══════════════════════════════════════════════════════════════════════════
      
      let importResult;
      try {
        importResult = await this.excelImportService.processExcelImport(
          file.buffer,
          mappingJson,
          userId
        );
      } catch (error) {
        this.logger.error('Excel import service failed', error);
        this.updateProgress(sessionId, {
          processed: 0,
          total: 0,
          successCount: 0,
          failedCount: 0,
          percentage: 0,
          status: 'error',
          message: error?.message || 'Failed to process Excel file',
        });
        return;
      }

      const { totalRows, successCount: validatedCount, failedRows: validationFailures, familyDefinitions } = importResult;

      this.logger.log(`Excel validation complete: ${validatedCount} valid rows, ${validationFailures.length} validation failures`);
      
      // Log family definitions if any
      if (familyDefinitions && familyDefinitions.length > 0) {
        this.logger.log('Family attribute definitions:');
        familyDefinitions.forEach(def => {
          this.logger.log(
            `  - ${def.familyName}: ${def.attributes.length} attributes ` +
            `(${def.attributes.filter(a => a.isRequired).length} required)`
          );
        });
      }

      // Add validation failures to failed rows
      failedRows.push(...validationFailures);

      // Update progress after validation
      this.updateProgress(sessionId, {
        processed: totalRows,
        total: totalRows,
        successCount: validatedCount,
        failedCount: failedRows.length,
        percentage: 50,
        status: 'processing',
        message: `Validation complete. Persisting ${validatedCount} valid products...`,
      });

      // ═══════════════════════════════════════════════════════════════════════════
      // STEP 2: Re-parse Excel and persist validated rows
      // (We need to re-parse to get the structured data for persistence)
      // ═══════════════════════════════════════════════════════════════════════════
      
      let parsed;
      try {
        parsed = await parseExcel(file.buffer);
      } catch (error) {
        this.logger.error('Failed to re-parse Excel file for persistence', error);
        this.updateProgress(sessionId, {
          processed: totalRows,
          total: totalRows,
          successCount: 0,
          failedCount: totalRows,
          percentage: 100,
          status: 'error',
          message: 'Failed to parse Excel file for persistence',
        });
        return;
      }

      const rows = parsed.rows || [];
      let mapping: Record<string, string>;
      try {
        mapping = JSON.parse(mappingJson);
      } catch (err) {
        throw new BadRequestException('Invalid mapping JSON');
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // STEP 3: Persist valid rows in batches
      // Uses upsert logic for transactional persistence
      // ═══════════════════════════════════════════════════════════════════════════
      
      const BATCH_SIZE = 50;
      let successCount = 0;
      let processed = 0;

      // Filter out rows that failed validation
      const validationFailureRows = new Set(validationFailures.map(f => f.row));
      const validRowsToProcess = rows.filter((_, index) => {
        const rowNumber = index + 2; // Excel row number
        return !validationFailureRows.has(rowNumber);
      });

      for (let start = 0; start < validRowsToProcess.length; start += BATCH_SIZE) {
        const batch = validRowsToProcess.slice(start, start + BATCH_SIZE);
        const batchPromises = batch.map(async (row, idx) => {
          const originalIndex = rows.indexOf(row);
          const rowNumber = originalIndex + 2; // +2 because header is row 1

          try {
            const productDto = await this.mapRowToCreateProductDto(row, mapping, userId);

            // Validate required fields
            if (!productDto.sku) {
              throw new BadRequestException('Missing SKU');
            }
            if (!productDto.name) {
              throw new BadRequestException('Missing name');
            }

            // Use upsert for transactional insert/update
            await this.upsertProductFromCsv(productDto, userId);
            return { success: true };
          } catch (error) {
            const message = error?.message || 'Unknown error';
            this.logger.warn(`Failed to persist row ${rowNumber}: ${message}`);
            failedRows.push({ row: rowNumber, error: message });
            return { success: false };
          }
        });

        const settled = await Promise.allSettled(batchPromises);
        const batchSuccessCount = settled.filter(res => 
          res.status === 'fulfilled' && res.value?.success
        ).length;
        
        successCount += batchSuccessCount;
        processed += batch.length;

        // Update progress after each batch
        const baseProgress = 50; // We're at 50% after validation
        const persistProgress = Math.round((processed / validRowsToProcess.length) * 50);
        const percentage = baseProgress + persistProgress;
        
        this.updateProgress(sessionId, {
          processed: processed + validationFailures.length, // Include validation failures in total
          total: totalRows,
          successCount,
          failedCount: failedRows.length,
          percentage,
          status: 'processing',
          message: `Persisting products: ${successCount}/${validRowsToProcess.length} successful...`,
        });
      }

      // Final completion update
      this.updateProgress(sessionId, {
        processed: totalRows,
        total: totalRows,
        successCount,
        failedCount: failedRows.length,
        percentage: 100,
        status: 'completed',
        message: `Import completed: ${successCount} succeeded, ${failedRows.length} failed`,
      });

    } catch (error) {
      this.logger.error('Import error:', error);
      this.updateProgress(sessionId, {
        processed: 0,
        total: 0,
        successCount: 0,
        failedCount: 0,
        percentage: 0,
        status: 'error',
        message: error?.message || 'Import failed',
      });
    }
  }

  // Import products from an uploaded Excel (.xlsx) file. Mapping is a JSON string mapping internal field names to
  // header column names in the uploaded sheet.
  // 
  // This method uses the comprehensive Excel import service with:
  // - Header type inference (explicit [Type] or auto-inferred)
  // - Family-level attribute handling (required/optional based on first row)
  // - Row-level validation with detailed error reporting
  // - Automatic type conversion and domain model mapping
  async importProductsFromExcel(file: Express.Multer.File, mappingJson: string, userId: number): Promise<ImportProductsResponseDto> {
    const failedRows: Array<{ row: number; error: string }> = [];

    if (!file || !file.buffer) {
      throw new BadRequestException('Missing file upload');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: Process Excel with comprehensive import service
    // ═══════════════════════════════════════════════════════════════════════════
    let importResult;
    try {
      importResult = await this.excelImportService.processExcelImport(
        file.buffer,
        mappingJson,
        userId
      );
    } catch (error) {
      this.logger.error('Excel import service failed', error);
      throw new BadRequestException(error?.message || 'Failed to process Excel file');
    }

    const { totalRows, successCount: validatedCount, failedRows: validationFailures, familyDefinitions } = importResult;

    this.logger.log(`Excel validation complete: ${validatedCount} valid rows, ${validationFailures.length} validation failures`);
    
    // Add validation failures to failed rows
    failedRows.push(...validationFailures);

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: Re-parse and persist validated rows
    // ═══════════════════════════════════════════════════════════════════════════
    let parsed;
    let mapping: Record<string, string>;
    
    try {
      mapping = JSON.parse(mappingJson);
    } catch (err) {
      throw new BadRequestException('Invalid mapping JSON');
    }

    try {
      parsed = await parseExcel(file.buffer);
    } catch (error) {
      this.logger.error('Failed to parse Excel file', error);
      throw new BadRequestException('Failed to parse Excel file');
    }

    const rows = parsed.rows || [];
    this.logger.log(`Parsed ${totalRows} rows from Excel import`);

    const BATCH_SIZE = 100;
    let successCount = 0;

    // Filter out rows that failed validation
    const validationFailureRows = new Set(validationFailures.map(f => f.row));
    const validRowsToProcess = rows.filter((_, index) => {
      const rowNumber = index + 2; // Excel row number
      return !validationFailureRows.has(rowNumber);
    });

    for (let start = 0; start < validRowsToProcess.length; start += BATCH_SIZE) {
      const batch = validRowsToProcess.slice(start, start + BATCH_SIZE);
      const batchPromises = batch.map(async (row, idx) => {
        const originalIndex = rows.indexOf(row);
        const rowNumber = originalIndex + 2; // +2 because header is row 1

        try {
          const productDto = await this.mapRowToCreateProductDto(row, mapping, userId);

          // Validate required fields
          if (!productDto.sku) {
            throw new BadRequestException('Missing SKU');
          }
          if (!productDto.name) {
            throw new BadRequestException('Missing name');
          }

          await this.upsertProductFromCsv(productDto, userId);
          return { success: true };
        } catch (error) {
          const message = error?.message || 'Unknown error';
          this.logger.warn(`Failed to import Excel row ${rowNumber}: ${message}`);
          failedRows.push({ row: rowNumber, error: message });
          return { success: false };
        }
      });

      const settled = await Promise.allSettled(batchPromises);
      successCount += settled.filter(res => 
        res.status === 'fulfilled' && res.value?.success
      ).length;
    }

    return { totalRows, successCount, failedRows };
  }

  private async mapRowToCreateProductDto(row: Record<string, any>, mapping: Record<string, string>, userId: number): Promise<CreateProductDto> {
    const productDto: any = {} as CreateProductDto;

    // Standard fields that map to top-level product fields
    const mapToField = (fieldName: string, setter: (val: any) => void) => {
      const header = mapping[fieldName];
      if (!header) return;
      const val = row[header];
      if (val === undefined || val === null) return;
      setter(val);
    };

    mapToField('sku', v => productDto.sku = String(v).trim());
    mapToField('name', v => productDto.name = String(v).trim());
    mapToField('productLink', v => productDto.productLink = String(v).trim());
    mapToField('imageUrl', v => productDto.imageUrl = String(v).trim());
    // subImages: accept JSON array, comma separated list, or single URL and convert to string array
    mapToField('subImages', v => {
      if (v === null || v === undefined) return;
      try {
        if (Array.isArray(v)) {
          productDto.subImages = v.map(x => String(x).trim());
          return;
        }
        const s = String(v).trim();
        if (!s) return;
        if (s.startsWith('[')) {
          try {
            const parsed = JSON.parse(s);
            if (Array.isArray(parsed)) {
              productDto.subImages = parsed.map(x => String(x).trim());
            } else {
              productDto.subImages = [String(s)];
            }
          } catch (err) {
            productDto.subImages = s.split(',').map(x => x.trim());
          }
        } else if (s.includes(',')) {
          productDto.subImages = s.split(',').map(x => x.trim());
        } else {
          productDto.subImages = [s];
        }
      } catch {
        productDto.subImages = [String(v)];
      }
    });

    // Map extras (any mapping key other than standard product fields will be treated as an attribute)
    const attributeEntries: Array<{ attributeId?: number; attributeName?: string; value: string }> = [];

    for (const [key, header] of Object.entries(mapping)) {
      if (!header) continue;
      if (['sku', 'name', 'productLink', 'imageUrl', 'subImages', 'category', 'family', 'parentSku'].includes(key)) continue;
      const value = row[header];
      if (value === undefined || value === null || String(value).trim() === '') continue;

      // Use the mapping key as the attribute name (e.g., price, description)
      attributeEntries.push({ attributeName: key, value: String(value).trim() });
    }

    // Convert attribute names to IDs using prisma; create attributes if missing
    const attributesWithValues = [] as any[];
    if (attributeEntries.length > 0) {
      // Batch fetch all attributes at once
      const attributeNames = attributeEntries.map(a => a.attributeName!);
      const existingAttributes = await this.prisma.attribute.findMany({
        where: { name: { in: attributeNames }, userId },
      });
      
      const existingAttrMap = new Map(existingAttributes.map(a => [a.name, a]));
      
      // Process each attribute
      for (const attr of attributeEntries) {
        try {
          let attribute = existingAttrMap.get(attr.attributeName!);
          
          if (!attribute) {
            // Create missing attribute
            attribute = await this.prisma.attribute.create({ 
              data: { name: attr.attributeName!, type: 'STRING', userId } 
            });
            existingAttrMap.set(attribute.name, attribute);
          }
          
          attributesWithValues.push({ attributeId: attribute.id, value: attr.value });
        } catch (e) {
          this.logger.warn(`Failed creating attribute ${attr.attributeName}: ${e.message}`);
        }
      }
    }

    if (attributesWithValues.length > 0) {
      productDto.attributesWithValues = attributesWithValues;
    }

    return productDto;
  }

  async create(createProductDto: CreateProductDto, userId: number): Promise<ProductResponseDto> {
    try {
      this.logger.log(`Creating product: ${createProductDto.name} for user: ${userId}`);

      // Check if product with same SKU already exists
      const existingProductAny = await this.prisma.product.findFirst({
        where: {
          sku: createProductDto.sku,
          userId,
        },
      });

      // If found but soft-deleted, restore it (clear deletedAt and mark isDeleted false) then run update
      if (existingProductAny && existingProductAny.isDeleted) {
        this.logger.log(`Restoring soft-deleted product with SKU "${createProductDto.sku}" for user ${userId}.`);
        await this.prisma.product.update({
          where: { id: existingProductAny.id },
          data: { isDeleted: false, deletedAt: null },
        });

        // After restore, call update to handle the rest of the creation logic (attributes, etc.)
        return this.update(existingProductAny.id, createProductDto as any, userId);
      }

      // Check for existing non-deleted product (previous behavior)
      const existingProduct = existingProductAny && !existingProductAny.isDeleted ? existingProductAny : null;

      // Handle SKU conflict based on updateExisting flag
      if (existingProduct) {
        if (createProductDto.updateExisting) {
          // Update the existing product instead of creating a new one
          this.logger.log(`Product with SKU "${createProductDto.sku}" already exists. Updating existing product (ID: ${existingProduct.id})`);
          return this.update(existingProduct.id, createProductDto, userId);
        } else {
          // Throw error if updateExisting is false
          throw new ConflictException(`A product with SKU "${createProductDto.sku}" already exists`);
        }
      }

      // Handle parentSku - convert to parentProductId
      let parentProductId: number | undefined;
      if (createProductDto.parentSku) {
        const parentProduct = await this.prisma.product.findFirst({
          where: {
            sku: createProductDto.parentSku,
            userId,
            isDeleted: false,
          },
          select: { id: true },
        });

        if (!parentProduct) {
          throw new BadRequestException(`Parent product with SKU "${createProductDto.parentSku}" not found`);
        }

        parentProductId = parentProduct.id;
        this.logger.log(`Resolved parent SKU "${createProductDto.parentSku}" to parent product ID: ${parentProductId}`);
      }

      // Validate category if provided
      if (createProductDto.categoryId) {
        await this.validateCategory(createProductDto.categoryId, userId);
      }

      // Validate attribute group if provided
      if (createProductDto.attributeGroupId) {
        await this.validateAttributeGroup(createProductDto.attributeGroupId, userId);
      }

      // Validate family if provided
      if (createProductDto.familyId) {
        await this.validateFamily(createProductDto.familyId, userId);
      }

      // Filter out attributes that are already in the family
      let filteredAttributes = createProductDto.attributes;
      let removedAttributeNames: string[] = [];
      if (createProductDto.familyId && createProductDto.attributes && createProductDto.attributes.length > 0) {
        const familyAttributeIds = await this.getFamilyAttributeIds(createProductDto.familyId);
        const { filteredAttributes: newFilteredAttributes, removedAttributes } = this.filterDuplicateAttributes(createProductDto.attributes, familyAttributeIds);

        if (removedAttributes.length > 0) {
          removedAttributeNames = await this.getAttributeNames(removedAttributes);
          this.logger.warn(`Removed duplicate attributes from product creation: ${removedAttributeNames.join(', ')} (already present in family)`);
        }

        filteredAttributes = newFilteredAttributes;
      }

      // Create product without status first
      const product = await this.prisma.product.create({
        data: {
          name: createProductDto.name,
          sku: createProductDto.sku,
          productLink: createProductDto.productLink,
          imageUrl: createProductDto.imageUrl,
          subImages: createProductDto.subImages || [],
          categoryId: createProductDto.categoryId,
          attributeGroupId: createProductDto.attributeGroupId,
          familyId: createProductDto.familyId,
          parentProductId: parentProductId,
          userId,
        },
      });

      // Add filtered attributes to the product
      if (filteredAttributes && filteredAttributes.length > 0) {
        await this.prisma.productAttribute.createMany({
          data: filteredAttributes.map(attributeId => ({ productId: product.id, attributeId })),
          skipDuplicates: true,
        });
      }

      // Add attributes with values if provided
      if (createProductDto.attributesWithValues && createProductDto.attributesWithValues.length > 0) {
        // Validate that all attributes belong to the user
        const attributeIds = createProductDto.attributesWithValues.map(av => av.attributeId);
        const existingAttributes = await this.prisma.attribute.findMany({
          where: {
            id: { in: attributeIds },
            userId,
          },
        });

        if (existingAttributes.length !== attributeIds.length) {
          throw new BadRequestException('One or more attributes do not exist or do not belong to you');
        }

        // Filter out attributes that are already in the family
        let filteredAttributesWithValues = createProductDto.attributesWithValues;
        if (createProductDto.familyId) {
          const familyAttributeIds = await this.getFamilyAttributeIds(createProductDto.familyId);
          filteredAttributesWithValues = createProductDto.attributesWithValues.filter(
            av => !familyAttributeIds.includes(av.attributeId)
          );
        }

        // Create ProductAttribute entries with values using upsert
        for (const { attributeId, value } of filteredAttributesWithValues) {
          await this.prisma.productAttribute.upsert({
            where: {
              productId_attributeId: {
                productId: product.id,
                attributeId,
              },
            },
            update: {
              value: value || null,
            },
            create: {
              productId: product.id,
              attributeId,
              value: value || null,
            },
          });
        }
      }

      // Handle family attributes with values if provided
      if (createProductDto.familyAttributesWithValues && createProductDto.familyAttributesWithValues.length > 0) {
        if (!createProductDto.familyId) {
          throw new BadRequestException('Cannot set family attribute values without a family assigned');
        }

        // Get family attributes to validate and get familyAttributeId mapping
        const familyAttributes = await this.prisma.familyAttribute.findMany({
          where: { familyId: createProductDto.familyId },
          include: { attribute: true },
        });

        const familyAttributeMap = new Map(
          familyAttributes.map(fa => [fa.attribute.id, fa.id])
        );

        // Validate that all provided attributes belong to the family
        for (const { attributeId } of createProductDto.familyAttributesWithValues) {
          if (!familyAttributeMap.has(attributeId)) {
            throw new BadRequestException(`Attribute ${attributeId} is not part of the selected family`);
          }
        }

        // Create ProductAttribute entries for family attributes with values
        for (const { attributeId, value } of createProductDto.familyAttributesWithValues) {
          const familyAttributeId = familyAttributeMap.get(attributeId);
          
          await this.prisma.productAttribute.upsert({
            where: {
              productId_attributeId: {
                productId: product.id,
                attributeId,
              },
            },
            update: {
              value: value || null,
              familyAttributeId,
            },
            create: {
              productId: product.id,
              attributeId,
              familyAttributeId,
              value: value || null,
            },
          });
        }
      }

      // Calculate status
      const status = await this.calculateProductStatus(product.id);
      await this.prisma.product.update({ where: { id: product.id }, data: { status } });
      this.logger.log(`Product ${product.id} created with initial status: ${status}`);

      // If this product has a parent, inherit family and merge attributes
      if (parentProductId) {
        await this.inheritFamilyFromParent(product.id, parentProductId, userId);
        await this.mergeCustomAttributes(product.id, parentProductId, userId);
      }

      // Fetch updated product with status
      const result = await this.findOne(product.id, userId);
      this.logger.log(`Successfully created product with ID: ${result.id}`);
      
      // Log notification
      await this.notificationService.logProductCreation(userId, result.name, result.id);
      
      // Trigger webhooks
      const webhooks = await this.webhookService.getActiveWebhooksForEvent(userId, 'product.created');
      for (const webhook of webhooks) {
        const payload = this.webhookFormatterService.formatProductCreated(result);
        this.webhookService.deliverWebhook(webhook.id, 'product.created', payload);
      }
      
      return {
        ...result,
        removedAttributesMessage: removedAttributeNames.length > 0
          ? `Removed duplicate attributes: ${removedAttributeNames.join(', ')} (already present in family)`
          : undefined,
      };
    } catch (error) {
      this.handleDatabaseError(error, 'create');
    }
  }

  async upsertProductFromCsv(createProductDto: CreateProductDto, userId: number): Promise<ProductResponseDto> {
    try {
      this.logger.log(`Upserting product: ${createProductDto.name} for user: ${userId}`);

      // Validate category if provided
      if (createProductDto.categoryId) {
        await this.validateCategory(createProductDto.categoryId, userId);
      }

      // Validate attribute group if provided
      if (createProductDto.attributeGroupId) {
        await this.validateAttributeGroup(createProductDto.attributeGroupId, userId);
      }

      // Validate family if provided
      if (createProductDto.familyId) {
        await this.validateFamily(createProductDto.familyId, userId);
      }

      // Filter out attributes that are already in the family
      let filteredAttributes = createProductDto.attributes;
      let removedAttributeNames: string[] = [];
      if (createProductDto.familyId && createProductDto.attributes && createProductDto.attributes.length > 0) {
        const familyAttributeIds = await this.getFamilyAttributeIds(createProductDto.familyId);
        const { filteredAttributes: newFilteredAttributes, removedAttributes } = this.filterDuplicateAttributes(createProductDto.attributes, familyAttributeIds);

        if (removedAttributes.length > 0) {
          removedAttributeNames = await this.getAttributeNames(removedAttributes);
          this.logger.warn(`Removed duplicate attributes from product upsert: ${removedAttributeNames.join(', ')} (already present in family)`);
        }

        filteredAttributes = newFilteredAttributes;
      }

      // Check whether a product with same SKU and user exists (restore soft-deleted if necessary)
      let product_deleted = await this.prisma.product.findFirst({
        where: {
          sku: createProductDto.sku,
          userId,
          isDeleted: true,
        },
      });

      let product = await this.prisma.product.findFirst({
        where: {
          sku: createProductDto.sku,
          userId,
        },
      });

      if (product_deleted && product_deleted.isDeleted) {
        // Restore soft-deleted product and update fields
        this.logger.log(`Restoring soft-deleted product with SKU "${createProductDto.sku}" for user ${userId} during upsert.`);
        product = await this.prisma.product.update({
          where: { id: product_deleted.id,
            isDeleted: true
          },
          data: {
            isDeleted: false,
            deletedAt: null,
            name: createProductDto.name,
            productLink: createProductDto.productLink,
            imageUrl: createProductDto.imageUrl,
            subImages: createProductDto.subImages || [],
            categoryId: createProductDto.categoryId,
            attributeGroupId: createProductDto.attributeGroupId,
            familyId: createProductDto.familyId,
          },
        });
      } 
      if (product) {
        // Update existing product
        product = await this.prisma.product.update({
          where: { id: product.id },
          data: {
            name: createProductDto.name,
            productLink: createProductDto.productLink,
            imageUrl: createProductDto.imageUrl,
            subImages: createProductDto.subImages || [],
            categoryId: createProductDto.categoryId,
            attributeGroupId: createProductDto.attributeGroupId,
            familyId: createProductDto.familyId,
          },
        });
      } else {
        // Create new product
        product = await this.prisma.product.create({
          data: {
            name: createProductDto.name,
            sku: createProductDto.sku,
            productLink: createProductDto.productLink,
            imageUrl: createProductDto.imageUrl,
            subImages: createProductDto.subImages || [],
            categoryId: createProductDto.categoryId,
            attributeGroupId: createProductDto.attributeGroupId,
            familyId: createProductDto.familyId,
            userId,
          },
        });
      }

      // Handle attributes - for upsert, we need to manage ProductAttribute entries
      if (filteredAttributes && filteredAttributes.length > 0) {
        // First, get existing non-family ProductAttribute entries for this product
        const existingProductAttributes = await this.prisma.productAttribute.findMany({
          where: { 
            productId: product.id,
            familyAttributeId: null // Only get non-family attributes
          },
          select: { attributeId: true },
        });
        const existingAttributeIds = existingProductAttributes.map(pa => pa.attributeId);

        // Determine which attributes to add and which to remove
        const attributesToAdd = filteredAttributes.filter(attrId => !existingAttributeIds.includes(attrId));
        const attributesToRemove = existingAttributeIds.filter(attrId => !filteredAttributes.includes(attrId));

        // Remove non-family attributes that are no longer in the list
        if (attributesToRemove.length > 0) {
          await this.prisma.productAttribute.deleteMany({
            where: {
              productId: product.id,
              attributeId: { in: attributesToRemove },
              familyAttributeId: null // Only delete non-family attributes
            },
          });
        }

        // Add new attributes
        if (attributesToAdd.length > 0) {
          await this.prisma.productAttribute.createMany({
            data: attributesToAdd.map(attributeId => ({ productId: product.id, attributeId })),
            skipDuplicates: true,
          });
        }
      } else {
        // If no attributes provided, remove all existing non-family ProductAttribute entries
        await this.prisma.productAttribute.deleteMany({ 
          where: { 
            productId: product.id,
            familyAttributeId: null // Only delete non-family attributes
          } 
        });
      }

      // Handle attributes with values if provided
      if (createProductDto.attributesWithValues && createProductDto.attributesWithValues.length > 0) {
        // Validate that all attributes belong to the user
        const attributeIds = createProductDto.attributesWithValues.map(av => av.attributeId);
        const existingAttributes = await this.prisma.attribute.findMany({
          where: {
            id: { in: attributeIds },
            userId,
          },
        });

        if (existingAttributes.length !== attributeIds.length) {
          throw new BadRequestException('One or more attributes do not exist or do not belong to you');
        }

        // Filter out attributes that are already in the family
        let filteredAttributesWithValues = createProductDto.attributesWithValues;
        if (createProductDto.familyId) {
          const familyAttributeIds = await this.getFamilyAttributeIds(createProductDto.familyId);
          filteredAttributesWithValues = createProductDto.attributesWithValues.filter(
            av => !familyAttributeIds.includes(av.attributeId)
          );
        }

        // First, delete existing non-family ProductAttribute entries that aren't in the new list
        const currentProductAttributes = await this.prisma.productAttribute.findMany({
          where: { 
            productId: product.id,
            familyAttributeId: null // Only get non-family attributes
          },
          select: { attributeId: true },
        });
        
        const newAttributeIds = filteredAttributesWithValues.map(av => av.attributeId);
        const attributesToDelete = currentProductAttributes
          .filter(pa => !newAttributeIds.includes(pa.attributeId))
          .map(pa => pa.attributeId);

        if (attributesToDelete.length > 0) {
          await this.prisma.productAttribute.deleteMany({
            where: {
              productId: product.id,
              attributeId: { in: attributesToDelete },
              familyAttributeId: null // Only delete non-family attributes
            },
          });
        }

        // Upsert ProductAttribute entries with values
        for (const { attributeId, value } of filteredAttributesWithValues) {
          await this.prisma.productAttribute.upsert({
            where: {
              productId_attributeId: {
                productId: product.id,
                attributeId,
              },
            },
            update: {
              value: value || null,
            },
            create: {
              productId: product.id,
              attributeId,
              value: value || null,
            },
          });
        }
      }

      // Handle family attributes with values if provided
      if (createProductDto.familyAttributesWithValues && createProductDto.familyAttributesWithValues.length > 0) {
        if (!createProductDto.familyId) {
          throw new BadRequestException('Cannot set family attribute values without a family assigned');
        }

        // Get family attributes to validate and get familyAttributeId mapping
        const familyAttributes = await this.prisma.familyAttribute.findMany({
          where: { familyId: createProductDto.familyId },
          include: { attribute: true },
        });

        const familyAttributeMap = new Map(
          familyAttributes.map(fa => [fa.attribute.id, fa.id])
        );

        // Validate that all provided attributes belong to the family
        for (const { attributeId } of createProductDto.familyAttributesWithValues) {
          if (!familyAttributeMap.has(attributeId)) {
            throw new BadRequestException(`Attribute ${attributeId} is not part of the selected family`);
          }
        }

        // First, delete existing family ProductAttribute entries that aren't in the new list
        const currentFamilyAttributes = await this.prisma.productAttribute.findMany({
          where: { 
            productId: product.id,
            familyAttributeId: { not: null }
          },
          select: { attributeId: true },
        });
        
        const newFamilyAttributeIds = createProductDto.familyAttributesWithValues.map(av => av.attributeId);
        const familyAttributesToDelete = currentFamilyAttributes
          .filter(pa => !newFamilyAttributeIds.includes(pa.attributeId))
          .map(pa => pa.attributeId);

        if (familyAttributesToDelete.length > 0) {
          await this.prisma.productAttribute.deleteMany({
            where: {
              productId: product.id,
              attributeId: { in: familyAttributesToDelete },
              familyAttributeId: { not: null }
            },
          });
        }

        // Upsert ProductAttribute entries for family attributes with values
        for (const { attributeId, value } of createProductDto.familyAttributesWithValues) {
          const familyAttributeId = familyAttributeMap.get(attributeId);
          
          await this.prisma.productAttribute.upsert({
            where: {
              productId_attributeId: {
                productId: product.id,
                attributeId,
              },
            },
            update: {
              value: value || null,
              familyAttributeId,
            },
            create: {
              productId: product.id,
              attributeId,
              familyAttributeId,
              value: value || null,
            },
          });
        }
      }

      // Calculate status
      const status = await this.calculateProductStatus(product.id);
      await this.prisma.product.update({ where: { id: product.id }, data: { status } });
      this.logger.log(`Product ${product.id} upserted with status: ${status}`);

      // Fetch updated product with status
      const result = await this.findOne(product.id, userId);
      this.logger.log(`Successfully upserted product with ID: ${result.id}`);
      
      // Log notification - check if it was created or updated
      const wasCreated = !product.createdAt; // If createdAt is not set, it was created
      if (wasCreated) {
        await this.notificationService.logProductCreation(userId, result.name, result.id);
      } else {
        await this.notificationService.logProductUpdate(userId, result.name, result.id);
      }
      
      // Trigger webhooks
      const event = wasCreated ? 'product.created' : 'product.updated';
      const webhooks = await this.webhookService.getActiveWebhooksForEvent(userId, event);
      for (const webhook of webhooks) {
        const payload = wasCreated
          ? this.webhookFormatterService.formatProductCreated(result)
          : this.webhookFormatterService.formatProductUpdated(result);
        this.webhookService.deliverWebhook(webhook.id, event, payload);
      }
      
      return {
        ...result,
        removedAttributesMessage: removedAttributeNames.length > 0
          ? `Removed duplicate attributes: ${removedAttributeNames.join(', ')} (already present in family)`
          : undefined,
      };
    } catch (error) {
      this.handleDatabaseError(error, 'upsert');
    }
  }

  async findAll(
    userId: number, 
    search?: string,
    status?: string, 
    categoryId?: number | null, 
    attributeIds?: number[], 
    attributeGroupId?: number | null, 
    familyId?: number | null,
    page: number = 1,
    limit: number = 10,
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'desc',
    includeDeleted: boolean = false
  ): Promise<PaginatedResponse<ProductResponseDto>> {
    try {
      this.logger.log(`Fetching products for user: ${userId}`);

      const whereCondition: any = { 
        userId,
        parentProductId: null, // Exclude variant products from main product list
      };

      // Exclude soft-deleted products by default
      if (!includeDeleted) {
        whereCondition.isDeleted = false;
      }

      if (search) {
        whereCondition.OR = [
          {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            sku: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ];
      }

      if (status) {
        whereCondition.status = status;
      }

      if (categoryId !== undefined) {
        whereCondition.categoryId = categoryId;
      }

      // Handle attribute filtering - if product has ANY of the selected attributes
      // OR if the product's family has ANY of the selected attributes
      if (attributeIds && attributeIds.length > 0) {
        whereCondition.OR = [
          // Direct product attributes
          {
            attributes: {
              some: {
                attributeId: {
                  in: attributeIds,
                },
              },
            },
          },
          // Family attributes
          {
            family: {
              familyAttributes: {
                some: {
                  attributeId: {
                    in: attributeIds,
                  },
                },
              },
            },
          },
        ];
      }

      if (attributeGroupId !== undefined) {
        whereCondition.attributeGroupId = attributeGroupId;
      }

      if (familyId !== undefined) {
        whereCondition.familyId = familyId;
      }

      const paginationOptions = PaginationUtils.createPrismaOptions(page, limit);

      // Build orderBy object based on sortBy parameter
      const orderBy = this.buildOrderBy(sortBy, sortOrder);

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where: whereCondition,
          ...paginationOptions,
          include: this.PRODUCT_INCLUDE_FULL,
          orderBy,
        }),
        this.prisma.product.count({ where: whereCondition }),
      ]);

      const productResponseDtos = await Promise.all(products.map(async product => {
        const response = await this.transformProductForResponse(product);
        return response;
      }));
      console.log('Product Response DTOs:', productResponseDtos);
      return PaginationUtils.createPaginatedResponse(productResponseDtos, total, page, limit);
    } catch (error) {
      this.logger.error(`Failed to fetch products for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findOne(id: number, userId: number, includeDeleted: boolean = false): Promise<ProductResponseDto> {
    try {
      this.logger.log(`Fetching product: ${id} for user: ${userId}`);

      const whereCondition: any = {
        id,
        userId, // Ensure user owns the product
      };

      // Exclude soft-deleted products by default
      if (!includeDeleted) {
        whereCondition.isDeleted = false;
      }

      const product = await this.prisma.product.findFirst({
        where: whereCondition,
        include: {
          ...this.PRODUCT_INCLUDE_FULL,
          parentProduct: {
            select: {
              id: true,
              name: true,
              sku: true,
              imageUrl: true,
              status: true,
            },
          },
          assets: {
            include: {
              asset: true,
            },
          },
        },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${id} not found or access denied`);
      }
      this.logger.log(`Product with ID ${id} found:`, product);
      return await this.transformProductForResponse(product);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to fetch product ${id}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch product');
    }
  }

  async findBySku(sku: string, userId: number): Promise<ProductResponseDto> {
    try {
      this.logger.log(`Fetching product by SKU: ${sku} for user: ${userId}`);

      const product = await this.prisma.product.findFirst({
        where: {
          sku,
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
          attributeGroup: {
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
              familyAttributes: true,
            },
          },
          attributes: {
            select: {
              value: true,
              familyAttributeId: true,
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
          variants: {
            select: {
              id: true,
              name: true,
              sku: true,
              imageUrl: true,
              status: true,
            },
          },
          parentProduct: {
            select: {
              id: true,
              name: true,
              sku: true,
              imageUrl: true,
              status: true,
            },
          },
        },
      });

      if (!product) {
        throw new NotFoundException(`Product with SKU ${sku} not found or access denied`);
      }

      this.logger.log(`Product with SKU ${sku} found: ID ${product}`);

      return await this.transformProductForResponse(product);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to fetch product by SKU ${sku}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch product');
    }
  }

  async update(id: number, updateProductDto: UpdateProductDto, userId: number): Promise<ProductResponseDto> {
    try {
      // Verify ownership first
      await this.findOne(id, userId);

      this.logger.log(`Updating product: ${id} for user: ${userId}`);
      this.logger.debug(`Update data: ${JSON.stringify(updateProductDto)}`);

      // Handle updateExisting flag: when true, treat missing attribute fields as empty arrays
      // This ensures complete replacement behavior for Excel imports
      if (updateProductDto.updateExisting) {
        if (updateProductDto.attributesWithValues === undefined) {
          updateProductDto.attributesWithValues = [];
        }
        if (updateProductDto.familyAttributesWithValues === undefined) {
          updateProductDto.familyAttributesWithValues = [];
        }
      }

      // Handle parentSku - convert to parentProductId
      let parentProductId: number | null | undefined;
      if (updateProductDto.parentSku !== undefined) {
        if (updateProductDto.parentSku === null || updateProductDto.parentSku === '') {
          // Explicitly setting to null to remove parent
          parentProductId = null;
        } else {
          const parentProduct = await this.prisma.product.findFirst({
            where: {
              sku: updateProductDto.parentSku,
              userId,
              isDeleted: false,
            },
            select: { id: true },
          });

          if (!parentProduct) {
            throw new BadRequestException(`Parent product with SKU "${updateProductDto.parentSku}" not found`);
          }

          parentProductId = parentProduct.id;
          this.logger.log(`Resolved parent SKU "${updateProductDto.parentSku}" to parent product ID: ${parentProductId}`);
        }
      }

      // Validate all entities in parallel if being updated
      const validations: Promise<void>[] = [];
      if (updateProductDto.categoryId !== undefined && updateProductDto.categoryId !== null) {
        validations.push(this.validateCategory(updateProductDto.categoryId, userId));
      }
      if (updateProductDto.attributeGroupId !== undefined && updateProductDto.attributeGroupId !== null) {
        validations.push(this.validateAttributeGroup(updateProductDto.attributeGroupId, userId));
      }
      if (updateProductDto.familyId !== undefined && updateProductDto.familyId !== null) {
        validations.push(this.validateFamily(updateProductDto.familyId, userId));
      }
      if (validations.length > 0) {
        await Promise.all(validations);
      }

      // Prepare update data
      const updateData: any = {};

      if (updateProductDto.name !== undefined) {
        updateData.name = updateProductDto.name;
      }

      if (updateProductDto.sku !== undefined) {
        updateData.sku = updateProductDto.sku;
      }

      if (updateProductDto.productLink !== undefined) {
        updateData.productLink = updateProductDto.productLink;
      }

      if (updateProductDto.imageUrl !== undefined) {
        updateData.imageUrl = updateProductDto.imageUrl;
      }

      if (updateProductDto.subImages !== undefined) {
        updateData.subImages = updateProductDto.subImages;
      }

  // Status will be set automatically below

      if (updateProductDto.categoryId !== undefined) {
        updateData.categoryId = updateProductDto.categoryId;
      }

  if (updateProductDto.attributeGroupId !== undefined) {
        updateData.attributeGroupId = updateProductDto.attributeGroupId;
      }

      if (updateProductDto.familyId !== undefined) {
        updateData.familyId = updateProductDto.familyId;
      }

      // Handle parentProductId (from parentSku or direct parentProductId)
      if (parentProductId !== undefined) {
        updateData.parentProductId = parentProductId;
        
        // If setting a parent (making this product a variant), inherit family and merge attributes
        if (parentProductId !== null) {
          await this.inheritFamilyFromParent(id, parentProductId, userId);
          await this.mergeCustomAttributes(id, parentProductId, userId);
        }
      } else if (updateProductDto.parentProductId !== undefined) {
        updateData.parentProductId = updateProductDto.parentProductId;
        
        // If setting a parent (making this product a variant), inherit family and merge attributes
        if (updateProductDto.parentProductId !== null) {
          await this.inheritFamilyFromParent(id, updateProductDto.parentProductId, userId);
          await this.mergeCustomAttributes(id, updateProductDto.parentProductId, userId);
        }
      }

      // Update product main fields
      await this.prisma.product.update({
        where: { id },
        data: updateData,
      });

      // If family was changed, update all variants to inherit the new family
      if (updateProductDto.familyId !== undefined) {
        await this.updateVariantsFamilyAndAttributes(id, userId);
      }

      // After updating attributes/assets, recalculate status

      // Update attributes if provided
      let removedAttributeNames: string[] = [];
      if (updateProductDto.attributes !== undefined) {
        // Filter out attributes that are already in the family
        let filteredAttributes = updateProductDto.attributes;
        let familyIdToCheck = updateProductDto.familyId;

        // If familyId is not being updated, get it from the existing product
        if (familyIdToCheck === undefined) {
          const existingProduct = await this.prisma.product.findUnique({
            where: { id },
            select: { familyId: true },
          });
          familyIdToCheck = existingProduct?.familyId ?? undefined;
        }

        if (familyIdToCheck && updateProductDto.attributes.length > 0) {
          const familyAttributeIds = await this.getFamilyAttributeIds(familyIdToCheck);
          const { filteredAttributes: newFilteredAttributes, removedAttributes } = this.filterDuplicateAttributes(updateProductDto.attributes, familyAttributeIds);

          if (removedAttributes.length > 0) {
            removedAttributeNames = await this.getAttributeNames(removedAttributes);
            this.logger.warn(`Removed duplicate attributes from product update: ${removedAttributeNames.join(', ')} (already present in family)`);
          }

          filteredAttributes = newFilteredAttributes;
        }

        // Delete only non-family attributes before recreating
        await this.prisma.productAttribute.deleteMany({ 
          where: { 
            productId: id,
            familyAttributeId: null // Only delete non-family attributes
          } 
        });
        if (filteredAttributes.length > 0) {
          await this.prisma.productAttribute.createMany({
            data: filteredAttributes.map(attributeId => ({ productId: id, attributeId })),
            skipDuplicates: true,
          });
        }
      }

      // Update attributes with values if provided
      if (updateProductDto.attributesWithValues !== undefined) {
        // Validate that all attributes belong to the user
        const attributeIds = updateProductDto.attributesWithValues.map(av => av.attributeId);
        if (attributeIds.length > 0) {
          const existingAttributes = await this.prisma.attribute.findMany({
            where: {
              id: { in: attributeIds },
              userId,
            },
          });

          if (existingAttributes.length !== attributeIds.length) {
            throw new BadRequestException('One or more attributes do not exist or do not belong to you');
          }

          // Filter out attributes that are already in the family (if family is being updated)
          let filteredAttributesWithValues = updateProductDto.attributesWithValues;
          let familyIdToCheck = updateProductDto.familyId;
          
          // If familyId is not being updated, get it from the existing product
          if (familyIdToCheck === undefined) {
            const existingProduct = await this.prisma.product.findUnique({
              where: { id },
              select: { familyId: true },
            });
            familyIdToCheck = existingProduct?.familyId ?? undefined;
          }

          if (familyIdToCheck) {
            const familyAttributeIds = await this.getFamilyAttributeIds(familyIdToCheck);
            filteredAttributesWithValues = updateProductDto.attributesWithValues.filter(
              av => !familyAttributeIds.includes(av.attributeId)
            );
          }

          // First, delete existing non-family ProductAttribute entries that aren't in the new list
          const currentProductAttributes = await this.prisma.productAttribute.findMany({
            where: { 
              productId: id,
              familyAttributeId: null // Only get non-family attributes
            },
            select: { attributeId: true },
          });
          
          const newAttributeIds = filteredAttributesWithValues.map(av => av.attributeId);
          const attributesToDelete = currentProductAttributes
            .filter(pa => !newAttributeIds.includes(pa.attributeId))
            .map(pa => pa.attributeId);

          if (attributesToDelete.length > 0) {
            await this.prisma.productAttribute.deleteMany({
              where: {
                productId: id,
                attributeId: { in: attributesToDelete },
                familyAttributeId: null // Only delete non-family attributes
              },
            });
          }

          // Create or update ProductAttribute entries with values using upsert
          for (const { attributeId, value } of filteredAttributesWithValues) {
            await this.prisma.productAttribute.upsert({
              where: {
                productId_attributeId: {
                  productId: id,
                  attributeId,
                },
              },
              update: {
                value: value || null,
              },
              create: {
                productId: id,
                attributeId,
                value: value || null,
              },
            });
          }
        } else {
          // If empty array provided, delete all non-family ProductAttribute entries
          await this.prisma.productAttribute.deleteMany({ 
            where: { 
              productId: id,
              familyAttributeId: null // Only delete non-family attributes
            } 
          });
        }
      }

      // Handle family attributes with values if provided
      if (updateProductDto.familyAttributesWithValues !== undefined) {
        let familyIdToCheck = updateProductDto.familyId;
        
        // If familyId is not being updated, get it from the existing product
        if (familyIdToCheck === undefined) {
          const existingProduct = await this.prisma.product.findUnique({
            where: { id },
            select: { familyId: true },
          });
          familyIdToCheck = existingProduct?.familyId ?? undefined;
        }

        if (updateProductDto.familyAttributesWithValues.length > 0) {
          if (!familyIdToCheck) {
            throw new BadRequestException('Cannot set family attribute values without a family assigned');
          }

          // Get family attributes to validate and get familyAttributeId mapping
          const familyAttributes = await this.prisma.familyAttribute.findMany({
            where: { familyId: familyIdToCheck },
            include: { attribute: true },
          });

          const familyAttributeMap = new Map(
            familyAttributes.map(fa => [fa.attribute.id, fa.id])
          );

          // Validate that all provided attributes belong to the family
          for (const { attributeId } of updateProductDto.familyAttributesWithValues) {
            if (!familyAttributeMap.has(attributeId)) {
              throw new BadRequestException(`Attribute ${attributeId} is not part of the product's family`);
            }
          }

          // First, delete existing family ProductAttribute entries that aren't in the new list
          const currentFamilyAttributes = await this.prisma.productAttribute.findMany({
            where: { 
              productId: id,
              familyAttributeId: { not: null }
            },
            select: { attributeId: true, familyAttributeId: true },
          });
          
          const newFamilyAttributeIds = updateProductDto.familyAttributesWithValues.map(av => av.attributeId);
          const familyAttributesToDelete = currentFamilyAttributes
            .filter(pa => !newFamilyAttributeIds.includes(pa.attributeId))
            .map(pa => pa.attributeId);

          if (familyAttributesToDelete.length > 0) {
            await this.prisma.productAttribute.deleteMany({
              where: {
                productId: id,
                attributeId: { in: familyAttributesToDelete },
                familyAttributeId: { not: null }
              },
            });
          }

          // Create or update ProductAttribute entries for family attributes with values
          for (const { attributeId, value } of updateProductDto.familyAttributesWithValues) {
            const familyAttributeId = familyAttributeMap.get(attributeId);
            
            await this.prisma.productAttribute.upsert({
              where: {
                productId_attributeId: {
                  productId: id,
                  attributeId,
                },
              },
              update: {
                value: value || null,
                familyAttributeId,
              },
              create: {
                productId: id,
                attributeId,
                familyAttributeId,
                value: value || null,
              },
            });
          }
        } else {
          // If empty array provided, delete all family ProductAttribute entries
          await this.prisma.productAttribute.deleteMany({ 
            where: { 
              productId: id,
              familyAttributeId: { not: null }
            } 
          });
        }
      }

      // Update assets if provided
      if (updateProductDto.assets !== undefined) {
        await this.prisma.productAsset.deleteMany({ where: { productId: id } });
        if (updateProductDto.assets.length > 0) {
          await this.prisma.productAsset.createMany({
            data: updateProductDto.assets.map(assetId => ({ productId: id, assetId })),
            skipDuplicates: true,
          });
        }
      }

  // Recalculate status
  const newStatus = await this.calculateProductStatus(id);
  await this.prisma.product.update({ where: { id }, data: { status: newStatus } });
  this.logger.log(`Product ${id} status updated to: ${newStatus}`);

      // Fetch and return the updated product with relations
      const result = await this.findOne(id, userId);
      this.logger.log(`Successfully updated product with ID: ${id}`);
      
      // Log notification
      await this.notificationService.logProductUpdate(userId, result.name, result.id);
      
      // Trigger webhooks
      const webhooks = await this.webhookService.getActiveWebhooksForEvent(userId, 'product.updated');
      for (const webhook of webhooks) {
        const payload = this.webhookFormatterService.formatProductUpdated(result);
        this.webhookService.deliverWebhook(webhook.id, 'product.updated', payload);
      }
      
      return {
        ...result,
        removedAttributesMessage: removedAttributeNames.length > 0
          ? `Removed duplicate attributes: ${removedAttributeNames.join(', ')} (already present in family)`
          : undefined,
      };
  } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to update product ${id}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to update product');
    }
  }

  private async calculateProductStatus(productId: number): Promise<string> {
    this.logger.log(`[calculateProductStatus] Called for productId: ${productId}`);
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        family: {
          include: {
            familyAttributes: {
              where: { isRequired: true },
              include: {
                attribute: {
                  select: { id: true, name: true, defaultValue: true }
                }
              }
            }
          }
        },
        attributes: {
          select: {
            value: true,
            attribute: {
              select: { id: true, name: true, defaultValue: true }
            }
          }
        }
      }
    });

    if (!product) {
      this.logger.error(`[calculateProductStatus] Product not found for productId: ${productId}`);
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    const hasFamily = !!product.family;
    const productAttributes = product.attributes || [];
    const hasCustomAttributes = productAttributes.length > 0;

    let status = 'incomplete';
    let reason = '';

    // Rule 1: Product is complete ONLY if it has a family AND all required attributes have values
    if (hasFamily) {
      const requiredAttributes = product.family?.familyAttributes || [];

      if (requiredAttributes.length > 0) {
        // Check if all required family attributes have product-attribute values (not default values)
        const requiredAttributeIds = requiredAttributes.map((fa: any) => fa.attribute.id);
        const familyAttributeValues = productAttributes.filter((pa: any) =>
          requiredAttributeIds.includes(pa.attribute.id)
        );

        const allRequiredHaveProductValues = requiredAttributes.every((fa: any) => {
          const productAttr = familyAttributeValues.find((pa: any) => pa.attribute.id === fa.attribute.id);
          // Only consider product-attribute values, not default values
          const hasProductValue = productAttr && productAttr.value !== null && productAttr.value !== '';
          return hasProductValue;
        });

        if (allRequiredHaveProductValues) {
          status = 'complete';
          reason = 'Family exists and all required attributes have product-attribute values.';
        } else {
          status = 'incomplete';
          reason = 'Family exists but not all required attributes have product-attribute values.';
        }
      } else {
        // Family exists but has no required attributes - still incomplete
        status = 'incomplete';
        reason = 'Family exists but has no required attributes.';
      }
    } else {
      // No family - incomplete
      status = 'incomplete';
      reason = 'Product does not have a family assigned.';
    }

    // Note: Custom attributes are no longer considered for status calculation
    // Only family and required attributes matter

    this.logger.log(`[calculateProductStatus] Calculated status '${status}' for productId ${productId}. Reason: ${reason}`);
    return status;
  }

  async remove(id: number, userId: number): Promise<{ message: string }> {
    try {
      // Use soft delete instead of hard delete
      const result = await this.softDeleteProduct(id, userId, false);
      return { message: result.message };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to delete product ${id}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to delete product');
    }
  }

  /**
   * Bulk remove products, either by explicit ids or by filters.
   * Returns number of deleted items.
   */
  async bulkRemove(ids: number[], userId: number, filters?: Record<string, any>): Promise<number> {
    try {
      this.logger.log(`Bulk removing products for user ${userId}. ids=${JSON.stringify(ids)} filters=${JSON.stringify(filters)}`);

      let productIds: number[] = ids || [];

      if ((!productIds || productIds.length === 0) && filters) {
        // Build where condition using the same logic as findAll
        const whereCondition: any = { userId, parentProductId: null, isDeleted: false };

        if (filters.search) {
          whereCondition.OR = [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { sku: { contains: filters.search, mode: 'insensitive' } },
          ];
        }

        if (filters.status) whereCondition.status = filters.status;
        if (filters.categoryId) whereCondition.categoryId = filters.categoryId;
        if (filters.familyId) whereCondition.familyId = filters.familyId;
        if (filters.attributeIds && Array.isArray(filters.attributeIds) && filters.attributeIds.length > 0) {
          whereCondition.OR = whereCondition.OR ?? [];
          whereCondition.OR.push({ attributes: { some: { attributeId: { in: filters.attributeIds } } } });
          whereCondition.OR.push({ family: { familyAttributes: { some: { attributeId: { in: filters.attributeIds } } } } });
        }

        // Get all matching ids
        const matched = await this.prisma.product.findMany({ where: whereCondition, select: { id: true } });
        productIds = matched.map(m => m.id);
      }

      if (!productIds || productIds.length === 0) return 0;

      // Soft delete each product
      let deletedCount = 0;
      for (const id of productIds) {
        try {
          await this.softDeleteProduct(id, userId, false);
          deletedCount += 1;
        } catch (err) {
          // Ignore per-item failures but log
          this.logger.warn(`Failed to bulk-delete product ${id}: ${err?.message || err}`);
        }
      }

      // Log bulk notification
      await this.notificationService.logBulkOperation(userId, 'product' as any, 'bulk_deleted' as any, deletedCount, 'Products');

      return deletedCount;
    } catch (error) {
      this.logger.error(`Failed to bulk delete products: ${error?.message || error}`);
      throw new BadRequestException('Failed to bulk delete products');
    }
  }

  async getProductsByCategory(categoryId: number, userId: number, page: number = 1, limit: number = 10, sortBy?: string, sortOrder: 'asc' | 'desc' = 'desc'): Promise<PaginatedResponse<ProductResponseDto>> {
    try {
      // Verify category ownership
      await this.validateCategory(categoryId, userId);

      this.logger.log(`Fetching products for category: ${categoryId}, user: ${userId}`);

      const whereCondition = {
        categoryId,
        userId,
      };

      const paginationOptions = PaginationUtils.createPrismaOptions(page, limit);

      // Build orderBy object based on sortBy parameter
      const orderBy = this.buildOrderBy(sortBy, sortOrder);

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where: whereCondition,
          ...paginationOptions,
          include: this.PRODUCT_INCLUDE_FULL,
          orderBy,
        }),
        this.prisma.product.count({ where: whereCondition }),
      ]);

      const productResponseDtos = await Promise.all(products.map(product => this.transformProductForResponse(product)));
      
      return PaginationUtils.createPaginatedResponse(productResponseDtos, total, page, limit);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to fetch products for category ${categoryId}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch products');
    }
  }

  async getProductsByAttribute(attributeId: number, userId: number, page: number = 1, limit: number = 10, sortBy?: string, sortOrder: 'asc' | 'desc' = 'desc'): Promise<PaginatedResponse<ProductResponseDto>> {
    try {
      // Verify attribute ownership
      await this.validateAttribute(attributeId, userId);

      this.logger.log(`Fetching products for attribute: ${attributeId}, user: ${userId}`);

      const whereCondition = {
        attributeId,
        userId,
      };

      const paginationOptions = PaginationUtils.createPrismaOptions(page, limit);

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where: whereCondition,
          ...paginationOptions,
          include: this.PRODUCT_INCLUDE_FULL,
          orderBy: this.buildOrderBy(sortBy, sortOrder),
        }),
        this.prisma.product.count({ where: whereCondition }),
      ]);

      const productResponseDtos = await Promise.all(products.map(product => this.transformProductForResponse(product)));
      
      return PaginationUtils.createPaginatedResponse(productResponseDtos, total, page, limit);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to fetch products for attribute ${attributeId}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch products');
    }
  }

  async getProductsByAttributeGroup(attributeGroupId: number, userId: number, page: number = 1, limit: number = 10, sortBy?: string, sortOrder: 'asc' | 'desc' = 'desc'): Promise<PaginatedResponse<ProductResponseDto>> {
    try {
      // Verify attribute group ownership
      await this.validateAttributeGroup(attributeGroupId, userId);

      this.logger.log(`Fetching products for attribute group: ${attributeGroupId}, user: ${userId}`);

      const whereCondition = {
        attributeGroupId,
        userId,
      };

      const paginationOptions = PaginationUtils.createPrismaOptions(page, limit);

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where: whereCondition,
          ...paginationOptions,
          include: this.PRODUCT_INCLUDE_FULL,
          orderBy: this.buildOrderBy(sortBy, sortOrder),
        }),
        this.prisma.product.count({ where: whereCondition }),
      ]);

      const productResponseDtos = await Promise.all(products.map(product => this.transformProductForResponse(product)));
      
      return PaginationUtils.createPaginatedResponse(productResponseDtos, total, page, limit);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to fetch products for attribute group ${attributeGroupId}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch products');
    }
  }

  async getProductsByFamily(familyId: number, userId: number, page: number = 1, limit: number = 10, sortBy?: string, sortOrder: 'asc' | 'desc' = 'desc'): Promise<PaginatedResponse<ProductResponseDto>> {
    try {
      // Verify family ownership
      await this.validateFamily(familyId, userId);

      this.logger.log(`Fetching products for family: ${familyId}, user: ${userId}`);

      const whereCondition = {
        familyId,
        userId,
      };

      const paginationOptions = PaginationUtils.createPrismaOptions(page, limit);

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where: whereCondition,
          ...paginationOptions,
          include: this.PRODUCT_INCLUDE_FULL,
          orderBy: this.buildOrderBy(sortBy, sortOrder),
        }),
        this.prisma.product.count({ where: whereCondition }),
      ]);

      const productResponseDtos = await Promise.all(products.map(product => this.transformProductForResponse(product)));
      
      return PaginationUtils.createPaginatedResponse(productResponseDtos, total, page, limit);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to fetch products for family ${familyId}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch products');
    }
  }

  private async validateCategory(categoryId: number, userId: number): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        userId,
      },
    });

    if (!category) {
      throw new BadRequestException('Category not found or does not belong to you');
    }
  }

  private async validateAttribute(attributeId: number, userId: number): Promise<void> {
  // No longer needed: attributes are managed via join table
  }

  private async validateAttributeGroup(attributeGroupId: number, userId: number): Promise<void> {
    const attributeGroup = await this.prisma.attributeGroup.findFirst({
      where: {
        id: attributeGroupId,
        userId,
      },
    });

    if (!attributeGroup) {
      throw new BadRequestException('Attribute group not found or does not belong to you');
    }
  }

  private async validateFamily(familyId: number, userId: number): Promise<void> {
    const family = await this.prisma.family.findFirst({
      where: {
        id: familyId,
        userId,
      },
    });

    if (!family) {
      throw new BadRequestException('Family not found or does not belong to you');
    }
  }

  private async transformProductForResponse(product: any): Promise<ProductResponseDto> {
    // Extract variants from the product data (one-to-many relationship)
    const variants: any[] = [];
    
    if (product.variants && product.variants.length > 0) {
      // If this product is a parent, include its variants
      variants.push(...product.variants);
    }

    // Attributes details
    let attributes: any = undefined;
    if (product.attributes) {
      if (product.attributes.length > 0 && product.attributes[0].attribute) {
        attributes = product.attributes.map((attr: any) => ({
          id: attr.attribute.id,
          name: attr.attribute.name,
          type: attr.attribute.type,
          userFriendlyType: attr.attribute.userFriendlyType ?? getUserFriendlyType(attr.attribute.type),
          defaultValue: attr.attribute.defaultValue,
          value: attr.value, // Include the actual value from ProductAttribute
        }));
      } else {
        attributes = product.attributes.map((attr: any) => attr.attributeId);
      }
    }

    // Assets details
    let assets: any = undefined;
    if (product.assets) {
      assets = product.assets.map((pa: any) => pa.asset ? {
        id: pa.asset.id,
        name: pa.asset.name,
        fileName: pa.asset.fileName,
        filePath: pa.asset.filePath,
        mimeType: pa.asset.mimeType,
        uploadDate: pa.asset.uploadDate,
        size: pa.asset.size !== undefined && pa.asset.size !== null ? pa.asset.size.toString() : null,
      } : pa.assetId);
    }

    // Format dates to YYYY-MM-DD format
    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0];
    };

    // Helper function to get attribute value from product attributes
    const getAttributeValue = (attributeId: number, familyAttributeId?: number) => {
      // First, try to find by familyAttributeId if provided
      if (familyAttributeId) {
        const familyProductAttribute = product.attributes?.find((pa: any) => pa.familyAttributeId === familyAttributeId);
        if (familyProductAttribute) {
          return familyProductAttribute.value;
        }
      }
      
      // Fall back to finding by attributeId
      const productAttribute = product.attributes?.find((pa: any) => pa.attributeId === attributeId);
      return productAttribute?.value || null;
    };

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      productLink: product.productLink,
      imageUrl: product.imageUrl,
      subImages: product.subImages || [],
      status: product.status,
      categoryId: product.categoryId,
      attributeGroupId: product.attributeGroupId,
      familyId: product.familyId,
      parentProductId: product.parentProductId,
      userId: product.userId,
      createdAt: formatDate(product.createdAt),
      updatedAt: formatDate(product.updatedAt),
      category: product.category ? {
        id: product.category.id,
        name: product.category.name,
        description: product.category.description,
      } : undefined,
      attributeGroup: product.attributeGroup ? {
        id: product.attributeGroup.id,
        name: product.attributeGroup.name,
        description: product.attributeGroup.description,
      } : undefined,
      family: product.family ? {
        id: product.family.id,
        name: product.family.name,
        requiredAttributes: product.family.familyAttributes
          ?.filter((fa: any) => fa.isRequired)
          ?.map((fa: any) => ({
            id: fa.attribute.id,
            name: fa.attribute.name,
            type: fa.attribute.type,
            defaultValue: fa.attribute.defaultValue,
            userFriendlyType: fa.attribute.userFriendlyType ?? getUserFriendlyType(fa.attribute.type),
            value: getAttributeValue(fa.attribute.id, fa.id), // Pass familyAttributeId as well
          })) || [],
        optionalAttributes: product.family.familyAttributes
          ?.filter((fa: any) => !fa.isRequired)
          ?.map((fa: any) => ({
            id: fa.attribute.id,
            name: fa.attribute.name,
            type: fa.attribute.type,
            defaultValue: fa.attribute.defaultValue,
            userFriendlyType: fa.attribute.userFriendlyType ?? getUserFriendlyType(fa.attribute.type),
            value: getAttributeValue(fa.attribute.id, fa.id), // Pass familyAttributeId as well
          })) || [],
      } : undefined,
      variants: variants.length > 0 ? variants.map(variant => ({
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        imageUrl: variant.imageUrl,
        status: variant.status,
      })) : undefined,
      totalVariants: variants.length,
      parentProduct: product.parentProduct ? {
        id: product.parentProduct.id,
        name: product.parentProduct.name,
        sku: product.parentProduct.sku,
        imageUrl: product.parentProduct.imageUrl,
        status: product.parentProduct.status,
      } : undefined,
      attributes,
      assets,
    };
  }

  private handleDatabaseError(error: any, operation: string): never {
    this.logger.error(`Failed to ${operation} product: ${error.message}`, error.stack);

    // Handle Prisma-specific errors
    if (error.code === 'P2002') {
      if (error.meta?.target?.includes('sku')) {
        throw new ConflictException('A product with this SKU already exists');
      }
      if (error.meta?.target?.includes('name')) {
        throw new ConflictException('A product with this name already exists');
      }
      throw new ConflictException('A product with these details already exists');
    }

    if (error.code === 'P2000') {
      throw new BadRequestException('The provided value is too long');
    }

    if (error.code === 'P2025') {
      throw new NotFoundException('Product not found');
    }

    // Re-throw known HTTP exceptions
    if (error.status) {
      throw error;
    }

    // Default error
    throw new BadRequestException(`Failed to ${operation} product`);
  }

  // Product Variant Management Methods

  /**
   * Add a variant to a parent product with automatic inheritance of family and attributes
   * @param parentId - The ID of the parent product
   * @param variantData - The data for the new variant product
   * @param userId - The ID of the user
   * @returns Promise<ProductResponseDto>
   */
  async addVariant(parentId: number, variantData: AddVariantDto, userId: number): Promise<ProductResponseDto> {
    try {
      this.logger.log(`Adding variant to parent product ${parentId} for user: ${userId}`);

      // Verify the parent product exists and belongs to the user
      const parentProduct = await this.prisma.product.findFirst({
        where: { id: parentId, userId },
        include: {
          family: {
            include: {
              familyAttributes: true,
            },
          },
          attributes: {
            include: {
              attribute: true,
            },
          },
        },
      });

      if (!parentProduct) {
        throw new BadRequestException('Parent product not found or does not belong to you');
      }

      // Prevent variants from being parents
      if (parentProduct.parentProductId) {
        throw new BadRequestException('Cannot add variants to a variant product. Variants cannot have their own variants.');
      }

      // Prepare variant data with inheritance
      const variantProductData: any = {
        ...variantData,
        parentProductId: parentId,
        familyId: parentProduct.familyId, // Inherit family
        categoryId: parentProduct.categoryId, // Optionally inherit category
        userId,
      };

      // Create the variant product
      const variant = await this.prisma.product.create({
        data: {
          name: variantProductData.name,
          sku: variantProductData.sku,
          productLink: variantProductData.productLink,
          imageUrl: variantProductData.imageUrl,
          subImages: variantProductData.subImages || [],
          categoryId: variantProductData.categoryId,
          attributeGroupId: variantProductData.attributeGroupId,
          familyId: variantProductData.familyId,
          parentProductId: variantProductData.parentProductId,
          userId: variantProductData.userId,
        },
      });

      // Copy all attributes from parent to variant
      if (parentProduct.attributes && parentProduct.attributes.length > 0) {
        const attributesToCopy = parentProduct.attributes.map(attr => ({
          productId: variant.id,
          attributeId: attr.attributeId,
          familyAttributeId: attr.familyAttributeId,
          value: attr.value, // Copy the value from parent
        }));

        await this.prisma.productAttribute.createMany({
          data: attributesToCopy,
          skipDuplicates: true,
        });
      }

      // Calculate status for the variant
      const status = await this.calculateProductStatus(variant.id);
      await this.prisma.product.update({ 
        where: { id: variant.id }, 
        data: { status } 
      });

      this.logger.log(`Successfully created variant ${variant.id} for parent product ${parentId}`);

      // Log notification
      await this.notificationService.logProductCreation(userId, variant.name, variant.id);

      // Return the complete variant product
      return await this.findOne(variant.id, userId);
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to add variant: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to add variant');
    }
  }

  /**
   * Remove a variant from a parent product
   * @param parentId - The ID of the parent product
   * @param variantId - The ID of the variant to remove
   * @param userId - The ID of the user
   * @returns Promise<{ message: string }>
   */
  async removeVariant(parentId: number, variantId: number, userId: number): Promise<{ message: string }> {
    try {
      this.logger.log(`Removing variant ${variantId} from parent product ${parentId} for user: ${userId}`);

      // Verify the parent product exists and belongs to the user
      const parentProduct = await this.prisma.product.findFirst({
        where: { id: parentId, userId },
      });

      if (!parentProduct) {
        throw new BadRequestException('Parent product not found or does not belong to you');
      }

      // Verify the variant exists and belongs to the user and is actually a variant of the parent
      const variant = await this.prisma.product.findFirst({
        where: { 
          id: variantId, 
          userId,
          parentProductId: parentId,
        },
      });

      if (!variant) {
        throw new BadRequestException('Variant not found or does not belong to the specified parent product');
      }

      // Delete the variant (cascade will handle related records)
      await this.prisma.product.delete({
        where: { id: variantId },
      });

      this.logger.log(`Successfully removed variant ${variantId} from parent product ${parentId}`);

      // Log notification
      await this.notificationService.logProductDeletion(userId, variant.name);

      return { message: `Successfully removed variant product ${variant.name}` };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to remove variant: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to remove variant');
    }
  }

  /**
   * Get all variants for a specific parent product
   * @param parentId - The ID of the parent product
   * @param userId - The ID of the user
   * @param queryDto - Pagination and filtering options
   * @returns Promise<PaginatedResponse<ProductVariantResponseDto>>
   */
  async getVariants(
    parentId: number,
    userId: number,
    queryDto: GetProductVariantsDto
  ): Promise<PaginatedResponse<ProductVariantResponseDto>> {
    try {
      this.logger.log(`Getting variants for parent product ${parentId} for user: ${userId}`);

      // Verify the parent product exists and belongs to the user
      const parentProduct = await this.prisma.product.findFirst({
        where: { id: parentId, userId },
      });

      if (!parentProduct) {
        throw new BadRequestException('Parent product not found or does not belong to you');
      }

      const { page = 1, limit = 10, sortBy = 'name', sortOrder = 'asc', search, status } = queryDto;
      const skip = (page - 1) * limit;

      // Build where clause
      const whereClause: any = {
        parentProductId: parentId,
        userId,
      };

      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (status) {
        whereClause.status = status;
      }

      // Get total count
      const total = await this.prisma.product.count({
        where: whereClause,
      });

      // Get paginated variants
      const variants = await this.prisma.product.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          sku: true,
          imageUrl: true,
          status: true,
          parentProductId: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
      });

      // Transform the response
      const transformedVariants = variants.map(variant => ({
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        imageUrl: variant.imageUrl ?? undefined,
        status: variant.status,
        parentProductId: variant.parentProductId ?? undefined,
        createdAt: variant.createdAt.toISOString().split('T')[0],
        updatedAt: variant.updatedAt.toISOString().split('T')[0],
      })) as ProductVariantResponseDto[];

      const totalPages = Math.ceil(total / limit);

      return {
        data: transformedVariants,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to get variants: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to get variants');
    }
  }

  /**
   * Get all user's attributes for export selection
   */
  async getAttributesForExport(userId: number): Promise<any[]> {
    try {
      this.logger.log(`Fetching attributes for export for user: ${userId}`);

      const attributes = await this.prisma.attribute.findMany({
        where: {
          userId,
        },
        select: {
          id: true,
          name: true,
          type: true,
          defaultValue: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      return attributes;
    } catch (error) {
      this.logger.error(`Failed to fetch attributes for export: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch attributes for export');
    }
  }

  /**
   * Export products with user-selected attributes
   * @param exportDto - Export configuration with product IDs and selected attributes
   * @param userId - The ID of the user
   * @returns Promise<ExportProductResponseDto>
   */
  async exportProducts(exportDto: ExportProductDto, userId: number): Promise<ExportProductResponseDto> {
    try {
      this.logger.log(`Exporting ${exportDto.productIds.length} products for user: ${userId}`);

      // Determine what data to include based on selected attributes
      const includeRelations = this.determineIncludeRelations(exportDto.attributes, exportDto.selectedAttributes);

      // Fetch products with required relations
      const products = await this.prisma.product.findMany({
        where: {
          id: { in: exportDto.productIds },
          userId,
        },
        include: includeRelations,
        orderBy: { id: 'asc' },
      });

      if (products.length === 0) {
        throw new NotFoundException('No products found with the provided IDs or access denied');
      }

      // Get variant data for products that need it
      const variantData = new Map<number, any[]>();
      if (this.needsVariantData(exportDto.attributes)) {
        for (const product of products) {
          const variants = await this.getProductVariantsForExport(product.id);
          variantData.set(product.id, variants);
        }
      }

      // Transform products to export format based on selected attributes
      const exportData = products.map(product => {
        const transformedProduct = this.transformProductForExport(
          product, 
          exportDto.attributes, 
          variantData.get(product.id) || [],
          exportDto.selectedAttributes
        );
        return transformedProduct;
      });

      const filename = exportDto.filename || `products_export_${new Date().toISOString().split('T')[0]}.${exportDto.format || ExportFormat.JSON}`;

      this.logger.log(`Successfully exported ${exportData.length} products`);

      return {
        data: exportData,
        format: exportDto.format || ExportFormat.JSON,
        filename,
        totalRecords: exportData.length,
        selectedAttributes: exportDto.attributes,
        customAttributes: exportDto.selectedAttributes,
        exportedAt: new Date(),
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to export products: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to export products');
    }
  }

  /**
   * Determine which relations to include based on selected attributes
   */
  private determineIncludeRelations(attributes: ProductAttribute[], selectedAttributes?: AttributeSelectionDto[]): any {
    const includeRelations: any = {};

    // Check if we need category data
    if (attributes.some(attr => ['categoryName', 'categoryDescription'].includes(attr))) {
      includeRelations.category = {
        select: {
          id: true,
          name: true,
          description: true,
        },
      };
    }

    // Note: Product doesn't have a direct 'attribute' relation.
    // Attributes are accessed through the 'attributes' relation (ProductAttribute model).
    // This section is removed as it was causing the Prisma error.

    // Check if we need attribute group data
    if (attributes.some(attr => ['attributeGroupName', 'attributeGroupDescription'].includes(attr))) {
      includeRelations.attributeGroup = {
        select: {
          id: true,
          name: true,
          description: true,
        },
      };
    }

    // Check if we need family data
    if (attributes.some(attr => ['familyName'].includes(attr))) {
      includeRelations.family = {
        select: {
          id: true,
          name: true,
          familyAttributes: {
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
        },
      };
    }

    // Always include product attributes if we have custom attributes, customAttributes flag, or any attribute-related fields
    if ((selectedAttributes && selectedAttributes.length > 0) || 
        attributes.includes(ProductAttribute.CUSTOM_ATTRIBUTES) ||
        attributes.some(attr => ['attributeName', 'attributeType', 'attributeDefaultValue'].includes(attr))) {
      includeRelations.attributes = {
        select: {
          value: true,
          familyAttributeId: true,
          attribute: {
            select: {
              id: true,
              name: true,
              type: true,
              defaultValue: true,
            },
          },
        },
      };
    }

    return includeRelations;
  }

  /**
   * Check if variant data is needed
   */
  private needsVariantData(attributes: ProductAttribute[]): boolean {
    return attributes.some(attr => ['variantCount', 'variantNames', 'variantSkus'].includes(attr));
  }

  /**
   * Get variants for a product for export purposes
   */
  private async getProductVariantsForExport(productId: number): Promise<any[]> {
    try {
      const variants = await this.prisma.product.findMany({
        where: {
          parentProductId: productId,
        },
        select: {
          id: true,
          name: true,
          sku: true,
        },
      });

      return variants;
    } catch (error) {
      this.logger.error(`Failed to fetch variants for product ${productId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Transform product data for export based on selected attributes
   */
  private transformProductForExport(
    product: any, 
    selectedAttributes: ProductAttribute[], 
    variants: any[], 
    customAttributes?: AttributeSelectionDto[]
  ): any {
    const exportRecord: any = {};

    (selectedAttributes || []).forEach(attr => {
      switch (attr) {
        case ProductAttribute.ID:
          exportRecord.id = product.id;
          break;
        case ProductAttribute.NAME:
          exportRecord.name = product.name;
          break;
        case ProductAttribute.SKU:
          exportRecord.sku = product.sku;
          break;
        case ProductAttribute.STATUS:
          exportRecord.status = product.status;
          break;
        case ProductAttribute.PRODUCT_LINK:
          exportRecord.productLink = product.productLink || '';
          break;
        case ProductAttribute.IMAGE_URL:
          exportRecord.imageUrl = product.imageUrl || '';
          break;
        case ProductAttribute.CATEGORY_ID:
          exportRecord.categoryId = product.categoryId || '';
          break;
        case ProductAttribute.CATEGORY_NAME:
          exportRecord.categoryName = product.category?.name || '';
          break;
        case ProductAttribute.CATEGORY_DESCRIPTION:
          exportRecord.categoryDescription = product.category?.description || '';
          break;
        case ProductAttribute.ATTRIBUTE_ID:
          exportRecord.attributeId = product.attributeId || '';
          break;
        case ProductAttribute.ATTRIBUTE_NAME:
          exportRecord.attributeName = product.attribute?.name || '';
          break;
        case ProductAttribute.ATTRIBUTE_TYPE:
          exportRecord.attributeType = product.attribute?.type || '';
          break;
        case ProductAttribute.ATTRIBUTE_DEFAULT_VALUE:
          exportRecord.attributeDefaultValue = product.attribute?.defaultValue || '';
          break;
        case ProductAttribute.ATTRIBUTE_GROUP_ID:
          exportRecord.attributeGroupId = product.attributeGroupId || '';
          break;
        case ProductAttribute.ATTRIBUTE_GROUP_NAME:
          exportRecord.attributeGroupName = product.attributeGroup?.name || '';
          break;
        case ProductAttribute.ATTRIBUTE_GROUP_DESCRIPTION:
          exportRecord.attributeGroupDescription = product.attributeGroup?.description || '';
          break;
        case ProductAttribute.FAMILY_ID:
          exportRecord.familyId = product.familyId || '';
          break;
        case ProductAttribute.FAMILY_NAME:
          exportRecord.familyName = product.family?.name || '';
          break;
        case ProductAttribute.VARIANT_COUNT:
          exportRecord.variantCount = variants.length;
          break;
        case ProductAttribute.VARIANT_NAMES:
          exportRecord.variantNames = variants.map(v => v.name).join(', ');
          break;
        case ProductAttribute.VARIANT_SKUS:
          exportRecord.variantSkus = variants.map(v => v.sku).join(', ');
          break;
        case ProductAttribute.USER_ID:
          exportRecord.userId = product.userId;
          break;
        case ProductAttribute.CREATED_AT:
          exportRecord.createdAt = product.createdAt.toISOString();
          break;
        case ProductAttribute.UPDATED_AT:
          exportRecord.updatedAt = product.updatedAt.toISOString();
          break;
        case ProductAttribute.CUSTOM_ATTRIBUTES:
          // Handle custom attributes - add individual attribute values
          if ((customAttributes && customAttributes.length > 0) && product.attributes) {
            (customAttributes || []).forEach(customAttr => {
              const productAttribute = product.attributes.find((pa: any) => 
                pa.attribute.id === customAttr.attributeId
              );
              const columnName = customAttr.columnName || customAttr.attributeName;
              const value = productAttribute?.value || productAttribute?.attribute?.defaultValue || '';
              const attributeType = productAttribute?.attribute?.type || '';
              
              // Format the value with type information
              const formattedValue = attributeType ? `${value}(${attributeType})` : value;
              exportRecord[columnName] = formattedValue;
            });
          }
          break;
        default:
          // Handle any unknown attributes gracefully
          this.logger.warn(`Unknown attribute: ${attr}`);
          break;
      }
    });

    return exportRecord;
  }

  /**
   * Get all attribute IDs from a family (both required and optional)
   * Uses caching to reduce database queries
   */
  private async getFamilyAttributeIds(familyId: number): Promise<number[]> {
    const now = Date.now();
    const cached = this.familyAttributeCache.get(familyId);
    
    // Return cached data if valid
    if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
      return cached.data;
    }
    
    // Fetch from database
    const familyAttributes = await this.prisma.familyAttribute.findMany({
      where: { familyId },
      select: { attributeId: true },
    });

    const attributeIds = familyAttributes.map(fa => fa.attributeId);
    
    // Update cache
    this.familyAttributeCache.set(familyId, { data: attributeIds, timestamp: now });
    
    return attributeIds;
  }

  /**
   * Filter out attributes that are already present in the family
   */
  private filterDuplicateAttributes(attributes: number[], familyAttributeIds: number[]): { filteredAttributes: number[], removedAttributes: number[] } {
    const filteredAttributes: number[] = [];
    const removedAttributes: number[] = [];

    attributes.forEach(attributeId => {
      if (familyAttributeIds.includes(attributeId)) {
        removedAttributes.push(attributeId);
      } else {
        filteredAttributes.push(attributeId);
      }
    });

    return { filteredAttributes, removedAttributes };
  }

  /**
   * Get attribute names for logging purposes
   */
  private async getAttributeNames(attributeIds: number[]): Promise<string[]> {
    if (attributeIds.length === 0) return [];

    const attributes = await this.prisma.attribute.findMany({
      where: { id: { in: attributeIds } },
      select: { id: true, name: true },
    });

    return attributes.map(attr => attr.name);
  }

  /**
   * Build orderBy object based on sortBy parameter
   */
  private buildOrderBy(sortBy?: string, sortOrder: 'asc' | 'desc' = 'desc'): any {
    if (!sortBy) {
      return { createdAt: 'desc' };
    }

    const validSortFields = [
      'id', 'name', 'sku', 'productLink', 'imageUrl', 'status', 
      'categoryId', 'attributeGroupId', 'familyId', 'userId', 
      'createdAt', 'updatedAt'
    ];
    
    if (validSortFields.includes(sortBy)) {
      return { [sortBy]: sortOrder };
    }
    
    // Handle related field sorting
    switch (sortBy) {
      case 'categoryName':
        return {
          category: {
            name: sortOrder
          }
        };
      case 'attributeGroupName':
        return {
          attributeGroup: {
            name: sortOrder
          }
        };
      case 'familyName':
        return {
          family: {
            name: sortOrder
          }
        };
      default:
        return { createdAt: 'desc' };
    }
  }

  /**
   * Update attribute values for a specific product
   */
  async updateProductAttributeValues(
    productId: number,
    attributeValues: { attributeId: number; value?: string }[],
    userId: number
  ): Promise<ProductResponseDto> {
    try {
      this.logger.log(`Updating attribute values for product: ${productId} by user: ${userId}`);

      // Verify product ownership
      const product = await this.prisma.product.findFirst({
        where: { id: productId, userId },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      // Verify all attributes belong to the user
      const attributeIds = attributeValues.map(av => av.attributeId);
      const existingAttributes = await this.prisma.attribute.findMany({
        where: {
          id: { in: attributeIds },
          userId,
        },
      });

      if (existingAttributes.length !== attributeIds.length) {
        throw new BadRequestException('One or more attributes do not exist or do not belong to you');
      }

      // Update each attribute value using upsert
      for (const { attributeId, value } of attributeValues) {
        await this.prisma.productAttribute.upsert({
          where: {
            productId_attributeId: {
              productId,
              attributeId,
            },
          },
          update: {
            value: value || null,
          },
          create: {
            productId,
            attributeId,
            value: value || null,
          },
        });
      }

      // Recalculate product status after updating attribute values
      const status = await this.calculateProductStatus(productId);
      await this.prisma.product.update({ 
        where: { id: productId }, 
        data: { status } 
      });

      // Return updated product
      return this.findOne(productId, userId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.handleDatabaseError(error, 'updateProductAttributeValues');
    }
  }

  /**
   * Get product attribute values
   */
  async getProductAttributeValues(
    productId: number,
    userId: number
  ): Promise<{ attributeId: number; attributeName: string; attributeType: string; value: string | null; defaultValue: string | null }[]> {
    try {
      this.logger.log(`Getting attribute values for product: ${productId} by user: ${userId}`);

      // Verify product ownership
      const product = await this.prisma.product.findFirst({
        where: { id: productId, userId },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      // Get all product attributes with their values
      const productAttributes = await this.prisma.productAttribute.findMany({
        where: { productId },
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
      });

      return productAttributes.map(pa => ({
        attributeId: pa.attributeId,
        attributeName: pa.attribute.name,
        attributeType: pa.attribute.type,
        value: pa.value,
        defaultValue: pa.attribute.defaultValue,
      }));
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.handleDatabaseError(error, 'getProductAttributeValues');
    }
  }

  /**
   * Update family attribute values for a specific product
   * Family attributes are attributes that belong to a product's family and need
   * to be stored with a reference to the familyAttributeId
   */
  async updateProductFamilyAttributeValues(
    productId: number,
    familyAttributeValues: { attributeId: number; value?: string }[],
    userId: number
  ): Promise<ProductResponseDto> {
    try {
      this.logger.log(`Updating family attribute values for product: ${productId} by user: ${userId}`);

      // Verify product ownership and get product with family info
      const product = await this.prisma.product.findFirst({
        where: { id: productId, userId },
        include: {
          family: {
            include: {
              familyAttributes: {
                include: {
                  attribute: true,
                },
              },
            },
          },
        },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      if (!product.family) {
        throw new BadRequestException('Product does not have a family assigned');
      }

      // Validate that all provided attributes belong to the product's family
      const familyAttributeMap = new Map(
        product.family.familyAttributes.map(fa => [fa.attribute.id, fa.id])
      );

      for (const { attributeId } of familyAttributeValues) {
        if (!familyAttributeMap.has(attributeId)) {
          throw new BadRequestException(`Attribute ${attributeId} is not part of the product's family`);
        }
      }

      // Update each family attribute value using upsert
      for (const { attributeId, value } of familyAttributeValues) {
        const familyAttributeId = familyAttributeMap.get(attributeId);
        
        await this.prisma.productAttribute.upsert({
          where: {
            productId_attributeId: {
              productId,
              attributeId,
            },
          },
          update: {
            value: value || null,
            familyAttributeId,
          },
          create: {
            productId,
            attributeId,
            familyAttributeId,
            value: value || null,
          },
        });
      }

      // Recalculate product status after updating family attribute values
      const status = await this.calculateProductStatus(productId);
      await this.prisma.product.update({ 
        where: { id: productId }, 
        data: { status } 
      });

      // Return updated product
      return this.findOne(productId, userId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.handleDatabaseError(error, 'updateProductFamilyAttributeValues');
    }
  }

  /**
   * Get family attribute values for a specific product
   * Returns only the attributes that belong to the product's family
   */
  async getProductFamilyAttributeValues(
    productId: number,
    userId: number
  ): Promise<{ 
    familyAttributeId: number; 
    attributeId: number; 
    attributeName: string; 
    attributeType: string; 
    isRequired: boolean;
    value: string | null; 
    defaultValue: string | null;
  }[]> {
    try {
      this.logger.log(`Getting family attribute values for product: ${productId} by user: ${userId}`);

      // Verify product ownership and get product with family info
      const product = await this.prisma.product.findFirst({
        where: { id: productId, userId },
        include: {
          family: {
            include: {
              familyAttributes: {
                include: {
                  attribute: true,
                },
              },
            },
          },
          attributes: {
            where: {
              familyAttributeId: { not: null },
            },
            include: {
              attribute: true,
            },
          },
        },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      if (!product.family) {
        throw new BadRequestException('Product does not have a family assigned');
      }

      // Create a map of family attribute values
      const productAttributeValues = new Map(
        product.attributes.map(pa => [pa.familyAttributeId, pa.value])
      );

      // Return family attributes with their current values
      return product.family.familyAttributes.map(fa => ({
        familyAttributeId: fa.id,
        attributeId: fa.attribute.id,
        attributeName: fa.attribute.name,
        attributeType: fa.attribute.type,
        isRequired: fa.isRequired,
        value: productAttributeValues.get(fa.id) || null,
        defaultValue: fa.attribute.defaultValue,
      }));
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.handleDatabaseError(error, 'getProductFamilyAttributeValues');
    }
  }

  /**
   * Inherit family and attributes from parent product when setting parentProductId
   * This intelligently merges parent data with existing child data:
   * - Sets family from parent if child doesn't have one
   * - For each parent attribute:
   *   - If child already has the attribute with a value, keep child's value
   *   - If child has the attribute but no value, take parent's value
   *   - If attribute only exists in parent, copy it to child
   */
  private async inheritFromParentProduct(childProductId: number, parentProductId: number, userId: number): Promise<void> {
    try {
      this.logger.log(`Inheriting family and attributes from parent ${parentProductId} to child ${childProductId}`);

      // Fetch parent product with all necessary data
      const parentProduct = await this.prisma.product.findFirst({
        where: { id: parentProductId, userId },
        include: {
          family: true,
          attributes: {
            include: {
              attribute: true,
            },
          },
        },
      });

      if (!parentProduct) {
        throw new BadRequestException('Parent product not found or does not belong to you');
      }

      // Prevent variants from being parents
      if (parentProduct.parentProductId) {
        throw new BadRequestException('Cannot use a variant product as a parent. Variants cannot have their own variants.');
      }

      // Fetch child product
      const childProduct = await this.prisma.product.findFirst({
        where: { id: childProductId, userId },
        include: {
          attributes: {
            include: {
              attribute: true,
            },
          },
        },
      });

      if (!childProduct) {
        throw new NotFoundException('Child product not found');
      }

      // Step 1: Inherit family from parent if child doesn't have one
      if (parentProduct.familyId && !childProduct.familyId) {
        await this.prisma.product.update({
          where: { id: childProductId },
          data: { familyId: parentProduct.familyId },
        });
        this.logger.log(`Inherited family ${parentProduct.familyId} from parent to child product ${childProductId}`);
      }

      // Step 2: Merge attributes intelligently
      // Create a map of child's existing attributes with their values
      const childAttributeMap = new Map(
        childProduct.attributes.map(attr => [attr.attributeId, attr])
      );

      // Process each parent attribute
      for (const parentAttr of parentProduct.attributes) {
        const childAttr = childAttributeMap.get(parentAttr.attributeId);

        if (childAttr) {
          // Child already has this attribute
          if (!childAttr.value || childAttr.value.trim() === '') {
            // Child has attribute but no value - take parent's value
            if (parentAttr.value && parentAttr.value.trim() !== '') {
              await this.prisma.productAttribute.update({
                where: {
                  productId_attributeId: {
                    productId: childProductId,
                    attributeId: parentAttr.attributeId,
                  },
                },
                data: {
                  value: parentAttr.value,
                  familyAttributeId: parentAttr.familyAttributeId,
                },
              });
              this.logger.log(`Updated attribute ${parentAttr.attributeId} with parent's value for child ${childProductId}`);
            }
          } else {
            // Child has attribute with value - keep child's value, but ensure familyAttributeId is set
            if (parentAttr.familyAttributeId && !childAttr.familyAttributeId) {
              await this.prisma.productAttribute.update({
                where: {
                  productId_attributeId: {
                    productId: childProductId,
                    attributeId: parentAttr.attributeId,
                  },
                },
                data: {
                  familyAttributeId: parentAttr.familyAttributeId,
                },
              });
            }
            this.logger.log(`Kept existing value for attribute ${parentAttr.attributeId} in child ${childProductId}`);
          }
        } else {
          // Child doesn't have this attribute - copy from parent
          await this.prisma.productAttribute.create({
            data: {
              productId: childProductId,
              attributeId: parentAttr.attributeId,
              familyAttributeId: parentAttr.familyAttributeId,
              value: parentAttr.value,
            },
          });
          this.logger.log(`Copied new attribute ${parentAttr.attributeId} from parent to child ${childProductId}`);
        }
      }

      // Step 3: Recalculate child product status
      const status = await this.calculateProductStatus(childProductId);
      await this.prisma.product.update({
        where: { id: childProductId },
        data: { status },
      });
      this.logger.log(`Updated child product ${childProductId} status to ${status} after inheritance`);

    } catch (error) {
      this.logger.error(`Failed to inherit from parent product: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get available marketplace templates
   */
  // async getMarketplaceTemplates() {
  //   try {
  //     const marketplaces = this.marketplaceTemplateService.getAvailableMarketplaces();
  //     return marketplaces.map(marketplace => ({
  //       marketplaceType: marketplace,
  //       displayName: this.getMarketplaceDisplayName(marketplace),
  //       template: this.marketplaceTemplateService.getMarketplaceTemplate(marketplace)
  //     }));
  //   } catch (error) {
  //     this.logger.error(`Failed to get marketplace templates: ${error.message}`, error.stack);
  //     throw new BadRequestException('Failed to get marketplace templates');
  //   }
  // }


  // CSV Import Scheduling Methods

  async scheduleCsvImport(scheduleDto: ScheduleImportDto, userId: number) {
    return this.importSchedulerService.scheduleImport(scheduleDto, userId);
  }

  async getImportJobs(userId: number, includeExecutions: boolean = true) {
    return this.importSchedulerService.getAllJobs(userId, includeExecutions);
  }

  async getImportJob(jobId: string, userId: number, includeExecutions: boolean = true): Promise<ImportJobResponseDto> {
    const job = await this.importSchedulerService.getJob(jobId, userId, includeExecutions);
    if (!job) {
      throw new NotFoundException(`Import job with ID ${jobId} not found`);
    }
    return job;
  }

  async updateScheduledImport(jobId: string, updateDto: UpdateScheduledImportDto, userId: number) {
    return this.importSchedulerService.updateScheduledImport(jobId, updateDto, userId);
  }

  async pauseImportJob(jobId: string, userId: number): Promise<boolean> {
    return this.importSchedulerService.pauseJob(jobId, userId);
  }

  async resumeImportJob(jobId: string, userId: number): Promise<boolean> {
    return this.importSchedulerService.resumeJob(jobId, userId);
  }

  async cancelImportJob(jobId: string, userId: number): Promise<boolean> {
    return this.importSchedulerService.cancelJob(jobId, userId);
  }

  async deleteImportJob(jobId: string, userId: number): Promise<boolean> {
    return this.importSchedulerService.deleteJob(jobId, userId);
  }

  async getExecutionLogs(jobId: string, userId: number, page: number = 1, limit: number = 20) {
    return this.importSchedulerService.getExecutionLogs(jobId, userId, page, limit);
  }

  async getExecutionStats(jobId: string, userId: number) {
    return this.importSchedulerService.getExecutionStats(jobId, userId);
  }

  /**
   * Helper: Inherit family from parent product to variant
   * When a product becomes a variant, it should inherit the parent's family
   * even if it previously had a different family.
   */
  private async inheritFamilyFromParent(variantId: number, parentId: number, userId: number): Promise<void> {
    try {
      this.logger.log(`[inheritFamilyFromParent] Starting family inheritance for variant ${variantId} from parent ${parentId}`);

      // Fetch parent product with family information
      const parentProduct = await this.prisma.product.findFirst({
        where: { id: parentId, userId },
        select: { 
          id: true, 
          familyId: true,
          parentProductId: true 
        },
      });

      if (!parentProduct) {
        throw new BadRequestException('Parent product not found or does not belong to you');
      }

      // Prevent variants from being parents
      if (parentProduct.parentProductId) {
        throw new BadRequestException('Cannot use a variant product as a parent. Variants cannot have their own variants.');
      }

      // If parent has a family, assign it to the variant (overriding any existing family)
      if (parentProduct.familyId) {
        await this.prisma.product.update({
          where: { id: variantId },
          data: { familyId: parentProduct.familyId },
        });
        this.logger.log(`[inheritFamilyFromParent] Variant ${variantId} now has family ${parentProduct.familyId} from parent`);
      } else {
        this.logger.log(`[inheritFamilyFromParent] Parent ${parentId} has no family, skipping family inheritance`);
      }

    } catch (error) {
      this.logger.error(`[inheritFamilyFromParent] Failed to inherit family: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Helper: Merge custom attributes from parent to variant
   * Variant's existing attributes take priority over parent's attributes.
   * If variant has an attribute with no value, use parent's value.
   * If variant doesn't have an attribute, copy it from parent.
   */
  private async mergeCustomAttributes(variantId: number, parentId: number, userId: number): Promise<void> {
    try {
      this.logger.log(`[mergeCustomAttributes] Starting attribute merge for variant ${variantId} from parent ${parentId}`);

      // Fetch parent product with attributes
      const parentProduct = await this.prisma.product.findFirst({
        where: { id: parentId, userId },
        include: {
          attributes: {
            include: {
              attribute: true,
            },
          },
        },
      });

      if (!parentProduct) {
        throw new BadRequestException('Parent product not found');
      }

      // Fetch variant product with attributes
      const variantProduct = await this.prisma.product.findFirst({
        where: { id: variantId, userId },
        include: {
          attributes: {
            include: {
              attribute: true,
            },
          },
        },
      });

      if (!variantProduct) {
        throw new NotFoundException('Variant product not found');
      }

      // Create a map of variant's existing attributes
      const variantAttributeMap = new Map(
        variantProduct.attributes.map(attr => [attr.attributeId, attr])
      );

      let attributesMerged = 0;
      let attributesAdded = 0;
      let attributesKept = 0;

      // Process each parent attribute
      for (const parentAttr of parentProduct.attributes) {
        const variantAttr = variantAttributeMap.get(parentAttr.attributeId);

        if (variantAttr) {
          // Variant already has this attribute
          if (!variantAttr.value || variantAttr.value.trim() === '') {
            // Variant has attribute but no value - use parent's value
            if (parentAttr.value && parentAttr.value.trim() !== '') {
              await this.prisma.productAttribute.update({
                where: {
                  productId_attributeId: {
                    productId: variantId,
                    attributeId: parentAttr.attributeId,
                  },
                },
                data: {
                  value: parentAttr.value,
                  familyAttributeId: parentAttr.familyAttributeId || variantAttr.familyAttributeId,
                },
              });
              attributesMerged++;
              this.logger.log(`[mergeCustomAttributes] Merged parent value for attribute ${parentAttr.attributeId} into variant ${variantId}`);
            }
          } else {
            // Variant has attribute with value - keep variant's value (priority)
            attributesKept++;
            this.logger.log(`[mergeCustomAttributes] Kept variant's value for attribute ${parentAttr.attributeId} (variant priority)`);
            
            // Update familyAttributeId if parent has it and variant doesn't
            if (parentAttr.familyAttributeId && !variantAttr.familyAttributeId) {
              await this.prisma.productAttribute.update({
                where: {
                  productId_attributeId: {
                    productId: variantId,
                    attributeId: parentAttr.attributeId,
                  },
                },
                data: {
                  familyAttributeId: parentAttr.familyAttributeId,
                },
              });
            }
          }
        } else {
          // Variant doesn't have this attribute - copy from parent
          await this.prisma.productAttribute.create({
            data: {
              productId: variantId,
              attributeId: parentAttr.attributeId,
              familyAttributeId: parentAttr.familyAttributeId,
              value: parentAttr.value,
            },
          });
          attributesAdded++;
          this.logger.log(`[mergeCustomAttributes] Added new attribute ${parentAttr.attributeId} from parent to variant ${variantId}`);
        }
      }

      this.logger.log(
        `[mergeCustomAttributes] Completed for variant ${variantId}: ` +
        `${attributesAdded} added, ${attributesMerged} merged, ${attributesKept} kept (variant priority)`
      );

      // Recalculate variant status after attribute merge
      const status = await this.calculateProductStatus(variantId);
      await this.prisma.product.update({
        where: { id: variantId },
        data: { status },
      });
      this.logger.log(`[mergeCustomAttributes] Updated variant ${variantId} status to ${status}`);

    } catch (error) {
      this.logger.error(`[mergeCustomAttributes] Failed to merge attributes: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Helper: Unlink all variants when parent product is deleted
   * Sets parentProductId to null for all variants of the deleted product.
   * This makes them standalone products instead of orphaned variants.
   */
  private async unlinkVariantsOnDelete(parentId: number, userId: number): Promise<void> {
    try {
      this.logger.log(`[unlinkVariantsOnDelete] Unlinking variants for parent product ${parentId}`);

      // Find all variants of this parent
      const variants = await this.prisma.product.findMany({
        where: {
          parentProductId: parentId,
          userId,
        },
        select: { id: true, sku: true },
      });

      if (variants.length === 0) {
        this.logger.log(`[unlinkVariantsOnDelete] No variants found for parent ${parentId}`);
        return;
      }

      // Unlink all variants by setting parentProductId to null
      const result = await this.prisma.product.updateMany({
        where: {
          parentProductId: parentId,
          userId,
        },
        data: {
          parentProductId: null,
        },
      });

      this.logger.log(
        `[unlinkVariantsOnDelete] Successfully unlinked ${result.count} variants from parent ${parentId}. ` +
        `Variants are now standalone products: ${variants.map(v => v.sku).join(', ')}`
      );

    } catch (error) {
      this.logger.error(`[unlinkVariantsOnDelete] Failed to unlink variants: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Helper: Update all variants when parent's family changes
   * This ensures all variants stay synchronized with their parent's family
   */
  private async updateVariantsFamilyAndAttributes(parentId: number, userId: number): Promise<void> {
    try {
      this.logger.log(`[updateVariantsFamilyAndAttributes] Updating all variants for parent ${parentId}`);

      // Find all variants of this parent
      const variants = await this.prisma.product.findMany({
        where: {
          parentProductId: parentId,
          userId,
        },
        select: { id: true, sku: true },
      });

      if (variants.length === 0) {
        this.logger.log(`[updateVariantsFamilyAndAttributes] No variants found for parent ${parentId}`);
        return;
      }

      // Update each variant's family and merge attributes
      for (const variant of variants) {
        await this.inheritFamilyFromParent(variant.id, parentId, userId);
        await this.mergeCustomAttributes(variant.id, parentId, userId);
      }

      this.logger.log(
        `[updateVariantsFamilyAndAttributes] Successfully updated ${variants.length} variants: ` +
        `${variants.map(v => v.sku).join(', ')}`
      );

    } catch (error) {
      this.logger.error(`[updateVariantsFamilyAndAttributes] Failed to update variants: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ============================================================
  // SOFT DELETE METHODS
  // ============================================================

  /**
   * Soft delete a product by setting deletedAt and isDeleted flags
   * @param id - Product ID
   * @param userId - User ID
   * @param softDeleteVariants - If true, also soft-delete variants (default: false)
   * @returns Promise<{ message: string; product: ProductResponseDto }>
   */
  async softDeleteProduct(
    id: number, 
    userId: number, 
    softDeleteVariants: boolean = false
  ): Promise<{ message: string; product: any }> {
    try {
      this.logger.log(`Soft deleting product: ${id} for user: ${userId}`);

      // Verify ownership and ensure not already deleted
      const product = await this.prisma.product.findFirst({
        where: { 
          id, 
          userId,
          isDeleted: false 
        },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${id} not found or already deleted`);
      }

      // Soft delete the product
      const deletedProduct = await this.prisma.product.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isDeleted: true,
        },
      });

      // Optionally soft-delete variants
      if (softDeleteVariants) {
        const variantCount = await this.prisma.product.updateMany({
          where: {
            parentProductId: id,
            userId,
            isDeleted: false,
          },
          data: {
            deletedAt: new Date(),
            isDeleted: true,
          },
        });

        if (variantCount.count > 0) {
          this.logger.log(`Soft deleted ${variantCount.count} variants for product ${id}`);
        }
      }

      this.logger.log(`Successfully soft deleted product with ID: ${id}`);

      // Log notification
      await this.notificationService.logProductDeletion(userId, product.name);

      return { 
        message: 'Product successfully soft deleted',
        product: deletedProduct 
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to soft delete product ${id}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to soft delete product');
    }
  }

  /**
   * Restore a soft-deleted product
   * @param id - Product ID
   * @param userId - User ID
   * @param restoreVariants - If true, also restore variants (default: false)
   * @returns Promise<{ message: string; product: ProductResponseDto }>
   */
  async restoreProduct(
    id: number, 
    userId: number,
    restoreVariants: boolean = false
  ): Promise<{ message: string; product: ProductResponseDto }> {
    try {
      this.logger.log(`Restoring soft-deleted product: ${id} for user: ${userId}`);

      // Find the soft-deleted product
      const product = await this.prisma.product.findFirst({
        where: { 
          id, 
          userId,
          isDeleted: true 
        },
      });

      if (!product) {
        throw new NotFoundException(`Soft-deleted product with ID ${id} not found`);
      }

      // Check for SKU conflicts before restoring
      const existingProduct = await this.prisma.product.findFirst({
        where: {
          sku: product.sku,
          userId,
          isDeleted: false,
        },
      });

      if (existingProduct) {
        throw new ConflictException(`Cannot restore: A product with SKU "${product.sku}" already exists`);
      }

      // Restore the product
      await this.prisma.product.update({
        where: { id },
        data: {
          deletedAt: null,
          isDeleted: false,
        },
      });

      // Optionally restore variants
      if (restoreVariants) {
        const variantCount = await this.prisma.product.updateMany({
          where: {
            parentProductId: id,
            userId,
            isDeleted: true,
          },
          data: {
            deletedAt: null,
            isDeleted: false,
          },
        });

        if (variantCount.count > 0) {
          this.logger.log(`Restored ${variantCount.count} variants for product ${id}`);
        }
      }

      const restoredProduct = await this.findOne(id, userId);
      this.logger.log(`Successfully restored product with ID: ${id}`);

      // Log notification
      await this.notificationService.logProductCreation(userId, product.name, product.id);

      return { 
        message: 'Product successfully restored',
        product: restoredProduct 
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }

      this.logger.error(`Failed to restore product ${id}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to restore product');
    }
  }

  /**
   * Get soft-deleted products for a user
   * @param userId - User ID
   * @param page - Page number
   * @param limit - Items per page
   * @returns Promise<PaginatedResponse<ProductResponseDto>>
   */
  async getSoftDeletedProducts(
    userId: number,
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedResponse<any>> {
    try {
      this.logger.log(`Fetching soft-deleted products for user: ${userId}`);

      const whereCondition = {
        userId,
        isDeleted: true,
      };

      const paginationOptions = PaginationUtils.createPrismaOptions(page, limit);

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where: whereCondition,
          ...paginationOptions,
          orderBy: { deletedAt: 'desc' },
        }),
        this.prisma.product.count({ where: whereCondition }),
      ]);

      return PaginationUtils.createPaginatedResponse(products, total, page, limit);
    } catch (error) {
      this.logger.error(`Failed to fetch soft-deleted products: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch soft-deleted products');
    }
  }

  /**
   * Permanently delete a soft-deleted product (hard delete)
   * @param id - Product ID
   * @param userId - User ID
   * @returns Promise<{ message: string }>
   */
  async permanentlyDeleteProduct(id: number, userId: number): Promise<{ message: string }> {
    try {
      this.logger.log(`Permanently deleting product: ${id} for user: ${userId}`);

      // Verify the product is soft-deleted
      const product = await this.prisma.product.findFirst({
        where: { 
          id, 
          userId,
          isDeleted: true 
        },
      });

      if (!product) {
        throw new NotFoundException(`Soft-deleted product with ID ${id} not found`);
      }

      // Unlink variants before permanent deletion
      await this.unlinkVariantsOnDelete(id, userId);

      // Permanently delete
      await this.prisma.product.delete({
        where: { id },
      });

      this.logger.log(`Successfully permanently deleted product with ID: ${id}`);

      return { message: 'Product permanently deleted' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to permanently delete product ${id}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to permanently delete product');
    }
  }
}
