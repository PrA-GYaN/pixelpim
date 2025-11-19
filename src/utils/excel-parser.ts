import ExcelJS from 'exceljs';

export interface ParsedExcel {
  headers: string[];
  rows: Array<Record<string, any>>;
}

/**
 * parseExcel - reads the first worksheet from an Excel buffer and returns an array of rows
 * where each row is a key/value map keyed by header names.
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
    throw new Error('No worksheet found');
  }

  // Header row (first non-empty row)
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const value = cell.text ? cell.text.trim() : '';
    headers.push(value);
  });

  // Read rows starting at row 2
  const rows: Array<Record<string, any>> = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const rowObj: Record<string, any> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1] || `Column ${colNumber}`;
      rowObj[header] = cell.value;
    });
    rows.push(rowObj);
  });

  return { headers, rows };
}
