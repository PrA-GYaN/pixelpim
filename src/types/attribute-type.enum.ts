export enum AttributeType {
  // String-like types
  STRING = 'STRING',
  TEXT = 'TEXT',
  EMAIL = 'EMAIL',
  URL = 'URL',
  PHONE = 'PHONE',
  COLOR = 'COLOR',

  // Numeric types
  INTEGER = 'INTEGER',
  NUMBER = 'NUMBER',
  FLOAT = 'FLOAT',
  CURRENCY = 'CURRENCY',
  PERCENTAGE = 'PERCENTAGE',

  // Boolean type
  BOOLEAN = 'BOOLEAN',

  // Date/Time types
  DATE = 'DATE',
  DATETIME = 'DATETIME',
  TIME = 'TIME',

  // Complex types
  JSON = 'JSON',
  ARRAY = 'ARRAY',
  
  // File types
  FILE = 'FILE',
  IMAGE = 'IMAGE',
  
  // Enum type
  ENUM = 'ENUM',
}
