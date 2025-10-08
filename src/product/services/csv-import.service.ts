import { Injectable, Logger, BadRequestException, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
import csv from 'csv-parser';
import * as https from 'https';
import * as http from 'http';
import { Readable } from 'stream';
import { ProductService } from '../product.service';

@Injectable()
export class CsvImportService {
  private readonly logger = new Logger(CsvImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => ProductService))
    private readonly productService: ProductService,
  ) {}

  async importFromCsv(csvUrl: string, userId: number): Promise<{ imported: number; errors: string[] }> {
    this.logger.log(`Starting CSV import from URL: ${csvUrl} for user: ${userId}`);

    try {
      const csvData = await this.downloadCsv(csvUrl);
      const products = await this.parseCsv(csvData);

      let imported = 0;
      const errors: string[] = [];

      for (const productData of products) {
        try {
          await this.createProductFromCsvRow(productData, userId);
          imported++;
        } catch (error) {
          this.logger.error(`Error importing product: ${JSON.stringify(productData)}`, error);
          errors.push(`Failed to import product ${productData.name || 'Unknown'}: ${error.message}`);
        }
      }

      this.logger.log(`CSV import completed. Imported: ${imported}, Errors: ${errors.length}`);

      // Send notification
      await this.notificationService.createNotification(
        userId,
        'PRODUCT' as any,
        'BULK_CREATED' as any,
        'CSV Import',
        undefined,
        { imported, errors }
      );

      return { imported, errors };
    } catch (error) {
      this.logger.error(`CSV import failed: ${error.message}`, error);
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
    // Map CSV columns to product fields
    // This is a basic mapping - you may need to adjust based on your CSV structure
    const productData = {
      name: row.name || row.Name || row.product_name,
      sku: row.sku || row.SKU || row.product_sku,
      productLink: row.productLink || row.product_link || row.url,
      imageUrl: row.imageUrl || row.image_url || row.image,
      subImages: this.parseSubImages(row.subImages || row.sub_images),
      status: 'incomplete',
      categoryId: row.categoryId ? parseInt(row.categoryId) : undefined,
      attributeGroupId: row.attributeGroupId ? parseInt(row.attributeGroupId) : undefined,
      familyId: row.familyId ? parseInt(row.familyId) : undefined,
      attributes: this.parseAttributes(row.attributes),
    };

    // Validate required fields
    if (!productData.name || !productData.sku) {
      throw new Error('Missing required fields: name and sku');
    }

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
