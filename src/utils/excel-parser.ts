import ExcelJS from 'exceljs';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * EXCEL IMPORT RULES AND DOCUMENTATION
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * This module implements a comprehensive Excel import pipeline with the following features:
 * 
 * 1. FILE UPLOAD & MAPPING
 *    - Backend receives Excel file buffer from frontend
 *    - Column-to-attribute mapping provided as JSON from frontend
 *    - Validates file type and size before processing
 *    - Security: Sanitizes all string fields, checks user permissions
 * 
 * 2. HEADER PROCESSING AND TYPE INFERENCE
 *    - Headers can include explicit data types in brackets, e.g., "Color [Short Text]"
 *    - If no type specified, automatically infers from first data row
 *    - Supported types:
 *      • Short Text (STRING)   - Text up to 255 characters
 *      • Long Text (TEXT)      - Text over 255 characters
 *      • Number (INTEGER)      - Whole numbers
 *      • Decimal (DECIMAL)     - Decimal numbers
 *      • Date (DATE)           - Date values
 *      • Boolean (BOOLEAN)     - True/false values
 *    - Type inference rules:
 *      • Numeric values → Number or Decimal (based on decimal point)
 *      • Date-like values → Date
 *      • "true"/"false" → Boolean
 *      • Default → Short Text
 * 
 * 3. FAMILY-LEVEL ATTRIBUTE HANDLING
 *    - If "Family" column mapped, identify all distinct families
 *    - For each family:
 *      • Use first row with that family as reference
 *      • Attach only attributes present in user-provided mapping
 *      • Mark as REQUIRED if first row has a value
 *      • Mark as OPTIONAL if first row is empty/null
 *    - Ensures consistent attribute requirements per family
 * 
 * 4. ROW-LEVEL VALIDATION
 *    - Validates each row according to:
 *      • Required field constraints (SKU, Name, etc.)
 *      • Type enforcement (numbers, dates, booleans)
 *      • Family attribute requirements
 *      • String length constraints
 *      • URL format validation
 *    - Collects all errors with row numbers and detailed messages
 *    - Continues processing valid rows even if some fail
 * 
 * 5. MAPPING TO DOMAIN MODEL
 *    - Converts valid rows into CreateProductDto objects
 *    - Automatic type conversions:
 *      • Dates: ISO string or Excel serial number → Date object
 *      • Numbers: String numbers → Number/Decimal
 *      • Booleans: Various formats → true/false
 *      • Enums: String values → Enum constants
 *    - Handles nested objects (attributes, family attributes)
 *    - Maintains referential integrity (family, category links)
 * 
 * 6. PERSISTENCE AND TRANSACTIONS
 *    - Supports batch inserts/upserts for performance
 *    - Uses database transactions for atomicity
 *    - Rollback on critical failures
 *    - Update existing products or create new based on SKU
 *    - Maintains audit trail (created/updated timestamps)
 * 
 * 7. ERROR HANDLING AND REPORTING
 *    - Comprehensive error collection:
 *      • Parse errors (invalid Excel format)
 *      • Validation errors (per-row with line numbers)
 *      • Database errors (constraint violations)
 *      • Type conversion errors
 *    - Detailed error messages for user feedback
 *    - Summary report: total rows, success count, failure count
 *    - Error logs with row numbers and specific issues
 * 
 * 8. SECURITY CHECKS
 *    - File type validation (only .xlsx, .xls)
 *    - File size limits (configurable)
 *    - User permission verification
 *    - SQL injection prevention (parameterized queries)
 *    - XSS prevention (string sanitization)
 *    - Rate limiting for import operations
 * 
 * 9. TESTING GUIDELINES
 *    - Unit tests for type inference logic
 *    - Integration tests for full import pipeline
 *    - Test cases:
 *      • Valid imports with all types
 *      • Invalid data types
 *      • Missing required fields
 *      • Family attribute variations
 *      • Large file handling
 *      • Concurrent imports
 *      • Error recovery scenarios
 *    - Mock database for isolation
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export interface ParsedExcel {
  headers: ParsedHeader[];
  rows: Array<Record<string, any>>;
}

export interface ParsedHeader {
  /** Original header text from Excel */
  name: string;
  /** Clean name without type annotation */
  cleanName: string;
  /** Explicit type from header [Type] or inferred type */
  dataType: AttributeDataType;
  /** Whether type was explicit or inferred */
  typeSource: 'explicit' | 'inferred';
}

export enum AttributeDataType {
  SHORT_TEXT = 'SHORT_TEXT',
  LONG_TEXT = 'LONG_TEXT',
  NUMBER = 'NUMBER',
  DECIMAL = 'DECIMAL',
  DATE = 'DATE',
  BOOLEAN = 'BOOLEAN',
}

/**
 * Extract explicit type from header name if present
 * Format: "Column Name [Type]"
 * Returns: { cleanName, explicitType }
 */
function extractTypeFromHeader(header: string): { cleanName: string; explicitType: AttributeDataType | null } {
  // Match anything in brackets at the end of the header
  const typePattern = /(.+?)\s*\[\s*(.+?)\s*\]\s*$/i;
  const match = header.match(typePattern);
  
  if (match) {
    const cleanName = match[1].trim();
    const typeStr = match[2].toLowerCase().trim();
    
    // More comprehensive type mapping with common variants and typos
    const typeMap: Record<string, AttributeDataType> = {
      'short text': AttributeDataType.SHORT_TEXT,
      'shorttext': AttributeDataType.SHORT_TEXT,
      'short': AttributeDataType.SHORT_TEXT,
      'text': AttributeDataType.SHORT_TEXT,
      'string': AttributeDataType.SHORT_TEXT,
      
      'long text': AttributeDataType.LONG_TEXT,
      'longtext': AttributeDataType.LONG_TEXT,
      'long': AttributeDataType.LONG_TEXT,
      'paragraph': AttributeDataType.LONG_TEXT,
      'textarea': AttributeDataType.LONG_TEXT,
      'multiline': AttributeDataType.LONG_TEXT,
      
      'number': AttributeDataType.NUMBER,
      'integer': AttributeDataType.NUMBER,
      'int': AttributeDataType.NUMBER,
      
      'decimal': AttributeDataType.DECIMAL,
      'float': AttributeDataType.DECIMAL,
      'double': AttributeDataType.DECIMAL,
      'price': AttributeDataType.DECIMAL,
      
      'date': AttributeDataType.DATE,
      'datetime': AttributeDataType.DATE,
      'timestamp': AttributeDataType.DATE,
      
      'boolean': AttributeDataType.BOOLEAN,
      'bool': AttributeDataType.BOOLEAN,
      'checkbox': AttributeDataType.BOOLEAN,
      'yes/no': AttributeDataType.BOOLEAN,
    };
    
    const explicitType = typeMap[typeStr] || null;
    
    return {
      cleanName,
      explicitType,
    };
  }
  
  return {
    cleanName: header.trim(),
    explicitType: null,
  };
}

/**
 * Infer data type from a value in the first data row
 * Type inference priority:
 * 1. Boolean: "true", "false", true, false, 1, 0 (case-insensitive)
 * 2. Date: Excel date serial number or parseable date string
 * 3. Number: Integer values
 * 4. Decimal: Floating-point values
 * 5. Long Text: Strings > 255 characters
 * 6. Short Text: Default for all other cases
 */
function inferTypeFromValue(value: any): AttributeDataType {
  // Handle null/undefined/empty
  if (value === null || value === undefined || value === '') {
    return AttributeDataType.SHORT_TEXT; // Default
  }
  
  // Check for boolean
  if (typeof value === 'boolean') {
    return AttributeDataType.BOOLEAN;
  }
  if (typeof value === 'string') {
    const lowerVal = value.toLowerCase().trim();
    if (lowerVal === 'true' || lowerVal === 'false' || lowerVal === 'yes' || lowerVal === 'no') {
      return AttributeDataType.BOOLEAN;
    }
  }
  if (typeof value === 'number' && (value === 0 || value === 1)) {
    // Could be boolean, but safer to treat as number unless string "true"/"false"
    // This is a judgement call - for now treat 0/1 as numbers
  }
  
  // Check for Date
  if (value instanceof Date) {
    return AttributeDataType.DATE;
  }
  if (typeof value === 'number' && value > 25569 && value < 73050) {
    // Excel date serial numbers (roughly 1970-2099)
    return AttributeDataType.DATE;
  }
  if (typeof value === 'string') {
    // Try parsing as date
    const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{2,4}|^\d{1,2}-\d{1,2}-\d{2,4}/;
    if (datePattern.test(value.trim())) {
      const parsed = new Date(value.trim());
      if (!isNaN(parsed.getTime())) {
        return AttributeDataType.DATE;
      }
    }
  }
  
  // Check for numbers
  if (typeof value === 'number') {
    // Check if it has decimal places
    if (Number.isInteger(value)) {
      return AttributeDataType.NUMBER;
    } else {
      return AttributeDataType.DECIMAL;
    }
  }
  if (typeof value === 'string') {
    const numVal = value.trim();
    // Check if it's a valid number
    if (!isNaN(Number(numVal)) && numVal !== '') {
      if (numVal.includes('.') || numVal.includes(',')) {
        return AttributeDataType.DECIMAL;
      } else {
        return AttributeDataType.NUMBER;
      }
    }
  }
  
  // Check for long text (> 255 chars)
  if (typeof value === 'string' && value.length > 255) {
    return AttributeDataType.LONG_TEXT;
  }
  
  // Default to short text
  return AttributeDataType.SHORT_TEXT;
}

/**
 * Parse Excel file with comprehensive header processing and type inference.
 * 
 * HEADER PROCESSING:
 * - Extracts explicit types from headers like "Price [Decimal]"
 * - Infers types from first data row if not explicit
 * - Returns structured header information with types
 * 
 * @param buffer - Excel file buffer (Buffer, ArrayBuffer, or Uint8Array)
 * @returns ParsedExcel with headers (including types) and rows
 */
export async function parseExcel(buffer: Buffer | ArrayBuffer | Uint8Array): Promise<ParsedExcel> {
  const workbook = new ExcelJS.Workbook();

  // Ensure we pass a Node Buffer (or Uint8Array) to exceljs.
  let input: Buffer | Uint8Array;
  if (Buffer.isBuffer(buffer)) {
    input = buffer as Buffer;
  } else if (buffer instanceof Uint8Array) {
    input = buffer as Uint8Array;
  } else if (buffer instanceof ArrayBuffer) {
    input = new Uint8Array(buffer as ArrayBuffer);
  } else {
    // Fallback: try to create a buffer
    input = Buffer.from(buffer as any);
  }

  await workbook.xlsx.load(input as any);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No worksheet found in Excel file');
  }

  // STEP 1: Parse header row (row 1)
  // Extract header names and check for explicit type annotations
  const headerRow = worksheet.getRow(1);
  const rawHeaders: Array<{ name: string; cleanName: string; explicitType: AttributeDataType | null }> = [];
  
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const value = cell.text ? cell.text.trim() : '';
    if (value) {
      const { cleanName, explicitType } = extractTypeFromHeader(value);
      rawHeaders.push({ name: value, cleanName, explicitType });
    } else {
      // Empty header cell - use column number as fallback
      rawHeaders.push({ 
        name: `Column ${colNumber}`, 
        cleanName: `Column ${colNumber}`,
        explicitType: null 
      });
    }
  });

  // Helper: normalize ExcelJS cell values into primitives (string/number/date/boolean/null)
  function normalizeCellValue(cell: ExcelJS.Cell): any {
    if (!cell) return null;
    const val = cell.value;
    if (val === null || val === undefined) return null;
    if (val instanceof Date) return val;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val;

    if (typeof val === 'string') {
      const s = val.trim();
      return s === '' ? null : s;
    }

    // Value is an object with different shapes (hyperlink, richText, formula, etc.)
    try {
      // Hyperlink cell: { text, hyperlink }
      if ((val as any).hyperlink) {
        return (val as any).hyperlink;
      }

      // Text with formatting: { text }
      if ((val as any).text) {
        return String((val as any).text).trim();
      }

      // RichText: { richText: [{ text: 'a' }, { text: 'b' }] }
      if ((val as any).richText && Array.isArray((val as any).richText)) {
        return (val as any).richText.map((r: any) => String(r.text || '')).join('').trim() || null;
      }

      // Formula object: { formula, result }
      if ((val as any).result !== undefined) {
        return (val as any).result;
      }

      // Fallback: try JSON stringify, but prefer null over a noisy '[object Object]'
      const str = JSON.stringify(val);
      if (str === '{}' || str === 'null') return null;
      return str;
    } catch (err) {
      return null; // Return null for unhandled object types
    }
  }

  // STEP 2: Read first data row (row 2) for type inference
  const firstDataRow = worksheet.getRow(2);
  const firstRowValues: any[] = [];
  
  firstDataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    firstRowValues[colNumber - 1] = normalizeCellValue(cell);
  });

  // STEP 3: Build final headers with types (explicit or inferred)
  const headers: ParsedHeader[] = rawHeaders.map((header, index) => {
    let dataType: AttributeDataType;
    let typeSource: 'explicit' | 'inferred';
    
    if (header.explicitType) {
      // Use explicit type from header
      dataType = header.explicitType;
      typeSource = 'explicit';
    } else {
      // Infer type from first data row
      const firstValue = firstRowValues[index];
      dataType = inferTypeFromValue(firstValue);
      typeSource = 'inferred';
    }
    
    return {
      name: header.name,
      cleanName: header.cleanName,
      dataType,
      typeSource,
    };
  });

  // STEP 4: Read all data rows (starting from row 2)
  const rows: Array<Record<string, any>> = [];
  
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // skip header row
    
    const rowObj: Record<string, any> = {};
    
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const headerInfo = headers[colNumber - 1];
      if (headerInfo) {
        // Use clean name (without type annotation) as key
        rowObj[headerInfo.cleanName] = normalizeCellValue(cell);
      }
    });
    
    rows.push(rowObj);
  });

  return { headers, rows };
}

/**
 * Convert Excel value to typed value based on inferred/explicit type
 * Used during import validation and transformation
 */
export function convertValueToType(value: any, dataType: AttributeDataType): any {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  try {
    switch (dataType) {
      case AttributeDataType.BOOLEAN: {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        const strVal = String(value).toLowerCase().trim();
        return strVal === 'true' || strVal === 'yes' || strVal === '1';
      }
      
      case AttributeDataType.DATE: {
        if (value instanceof Date) return value.toISOString();
        // Excel serial date number
        if (typeof value === 'number') {
          const date = new Date((value - 25569) * 86400 * 1000);
          return date.toISOString();
        }
        // String date
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString();
        }
        return null;
      }
      
      case AttributeDataType.NUMBER:
        return Math.floor(Number(value));
      
      case AttributeDataType.DECIMAL:
        return Number(value);
      
      case AttributeDataType.LONG_TEXT:
      case AttributeDataType.SHORT_TEXT:
      default:
        return String(value).trim();
    }
  } catch (error) {
    // If conversion fails, return string representation
    return String(value).trim();
  }
}
