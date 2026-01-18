import { Injectable, Logger } from '@nestjs/common';
import { ExportFormat } from '../dto/export-product.dto';

/**
 * Service for generating export files in different formats
 */
@Injectable()
export class ExportGeneratorService {
  private readonly logger = new Logger(ExportGeneratorService.name);

  /**
   * Generate CSV file content from data
   */
  generateCSV(data: any[], attributes: string[]): string {
    if (!data || data.length === 0) {
      return attributes.join(',') + '\n';
    }

    // Create header row
    const headers = attributes.join(',');

    // Create data rows
    const rows = data.map(item => {
      return attributes.map(attr => {
        const value = item[attr];
        // Handle null/undefined values
        if (value === null || value === undefined) return '';
        // Handle values with commas, quotes, or newlines by wrapping in quotes
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        // Handle other data types
        if (typeof value === 'object') {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',');
    });

    return [headers, ...rows].join('\n');
  }

  /**
   * Generate Excel file buffer from data
   */
  async generateExcel(data: any[], attributes: string[]): Promise<Buffer> {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Products');

    // Add header row
    worksheet.addRow(attributes);

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add data rows
    data.forEach(item => {
      const row = attributes.map(attr => {
        const value = item[attr];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return value;
      });
      worksheet.addRow(row);
    });

    // Auto-size columns
    attributes.forEach((attr, index) => {
      const column = worksheet.getColumn(index + 1);
      let maxLength = attr.length;
      
      data.forEach(item => {
        const value = item[attr];
        if (value !== null && value !== undefined) {
          const length = String(value).length;
          if (length > maxLength) {
            maxLength = length;
          }
        }
      });
      
      column.width = Math.min(maxLength + 2, 50); // Max width of 50
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Generate XML file content from data
   */
  generateXML(data: any[], attributes: string[]): string {
    if (!data || data.length === 0) {
      return '<?xml version="1.0" encoding="UTF-8"?>\n<products></products>';
    }

    const escapeXml = (str: string): string => {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const productsXml = data.map((item, index) => {
      const productElements = attributes.map(attr => {
        const value = item[attr];
        const escapedValue = escapeXml(value);
        return `    <${attr}>${escapedValue}</${attr}>`;
      }).join('\n');

      return `  <product id="${index + 1}">\n${productElements}\n  </product>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<products>\n${productsXml}\n</products>`;
  }

  /**
   * Generate JSON file content from data
   */
  generateJSON(data: any[]): string {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Generate file based on format
   */
  async generateFile(
    data: any[],
    attributes: string[],
    format: ExportFormat
  ): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
    let buffer: Buffer;
    let mimeType: string;
    let extension: string;

    this.logger.log(`Generating ${format} file with ${data.length} records`);

    switch (format) {
      case ExportFormat.CSV:
        const csvContent = this.generateCSV(data, attributes);
        buffer = Buffer.from(csvContent, 'utf-8');
        mimeType = 'text/csv';
        extension = 'csv';
        break;

      case ExportFormat.EXCEL:
        buffer = await this.generateExcel(data, attributes);
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        extension = 'xlsx';
        break;

      case ExportFormat.XML:
        const xmlContent = this.generateXML(data, attributes);
        buffer = Buffer.from(xmlContent, 'utf-8');
        mimeType = 'application/xml';
        extension = 'xml';
        break;

      case ExportFormat.JSON:
      default:
        const jsonContent = this.generateJSON(data);
        buffer = Buffer.from(jsonContent, 'utf-8');
        mimeType = 'application/json';
        extension = 'json';
        break;
    }

    this.logger.log(`Generated ${format} file: ${buffer.length} bytes`);

    return { buffer, mimeType, extension };
  }

  /**
   * Get file extension for format
   */
  getFileExtension(format: ExportFormat): string {
    switch (format) {
      case ExportFormat.CSV:
        return 'csv';
      case ExportFormat.EXCEL:
        return 'xlsx';
      case ExportFormat.XML:
        return 'xml';
      case ExportFormat.JSON:
      default:
        return 'json';
    }
  }

  /**
   * Get MIME type for format
   */
  getMimeType(format: ExportFormat): string {
    switch (format) {
      case ExportFormat.CSV:
        return 'text/csv';
      case ExportFormat.EXCEL:
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case ExportFormat.XML:
        return 'application/xml';
      case ExportFormat.JSON:
      default:
        return 'application/json';
    }
  }
}
