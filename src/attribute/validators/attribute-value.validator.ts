import { BadRequestException, Injectable } from '@nestjs/common';
import { AttributeType } from '../../types/attribute-type.enum';

@Injectable()
export class AttributeValueValidator {
  private readonly validators = new Map<AttributeType, (value: any) => any>();

  constructor() {
    this.initializeValidators();
  }

  private initializeValidators(): void {
    // String-like types
    this.validators.set(AttributeType.STRING, this.validateString);
    this.validators.set(AttributeType.TEXT, this.validateString);
    this.validators.set(AttributeType.HTML, this.validateHtml);
    this.validators.set(AttributeType.EMAIL, this.validateEmail);
    this.validators.set(AttributeType.URL, this.validateUrl);
    this.validators.set(AttributeType.PHONE, this.validatePhone);
    this.validators.set(AttributeType.COLOR, this.validateColor);

    // Numeric types
    this.validators.set(AttributeType.INTEGER, this.validateInteger);
    this.validators.set(AttributeType.NUMBER, this.validateNumber);
    this.validators.set(AttributeType.FLOAT, this.validateFloat);
    this.validators.set(AttributeType.CURRENCY, this.validateCurrency);
    this.validators.set(AttributeType.PERCENTAGE, this.validatePercentage);

    // Boolean type
    this.validators.set(AttributeType.BOOLEAN, this.validateBoolean);

    // Date/Time types
    this.validators.set(AttributeType.DATE, this.validateDate);
    this.validators.set(AttributeType.DATETIME, this.validateDateTime);
    this.validators.set(AttributeType.TIME, this.validateTime);

    // Complex types
    this.validators.set(AttributeType.JSON, this.validateJson);
    this.validators.set(AttributeType.ARRAY, this.validateArray);

    // File types
    this.validators.set(AttributeType.FILE, this.validateString);
    this.validators.set(AttributeType.IMAGE, this.validateString);

    // Enum type
    this.validators.set(AttributeType.ENUM, this.validateString);
  }

  validate(type: AttributeType, value: any): any {
    if (value === null || value === undefined) {
      return null;
    }

    const validator = this.validators.get(type);
    if (!validator) {
      throw new BadRequestException(`Unsupported attribute type: ${type}`);
    }

    return validator(value);
  }

  validateAndStringify(type: AttributeType, value: any): string | null {
    const validated = this.validate(type, value);
    if (validated === null) return null;
    
    return typeof validated === 'object' ? JSON.stringify(validated) : String(validated);
  }

  parseStoredValue(type: AttributeType, storedValue: string | null): any {
    if (storedValue === null || storedValue === undefined) {
      return null;
    }

    try {
      return this.validate(type, storedValue);
    } catch (error) {
      // If validation fails during parsing, return the stored value
      return storedValue;
    }
  }

  // Validators
  private readonly validateString = (value: any): string => {
    return String(value).trim();
  };

  private readonly validateHtml = (value: any): string => {
    const htmlStr = String(value).trim();
    // Basic HTML validation - check for script tags and potentially dangerous content
    if (htmlStr.includes('<script') || htmlStr.includes('javascript:')) {
      throw new BadRequestException('HTML content contains potentially dangerous elements');
    }
    return htmlStr;
  };

  private readonly validateEmail = (value: any): string => {
    const emailStr = String(value).trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (emailStr && !emailRegex.test(emailStr)) {
      throw new BadRequestException(`Invalid email format: ${emailStr}`);
    }
    return emailStr;
  };

  private readonly validateUrl = (value: any): string => {
    const urlStr = String(value).trim();
    
    if (urlStr) {
      try {
        new URL(urlStr);
      } catch {
        throw new BadRequestException(`Invalid URL format: ${urlStr}`);
      }
    }
    return urlStr;
  };

  private readonly validatePhone = (value: any): string => {
    const phoneStr = String(value).trim();
    // Basic phone validation - accepts various formats
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    
    if (phoneStr && !phoneRegex.test(phoneStr.replace(/[\s\-\(\)]/g, ''))) {
      throw new BadRequestException(`Invalid phone format: ${phoneStr}`);
    }
    return phoneStr;
  };

  private readonly validateColor = (value: any): string => {
    const colorStr = String(value).trim();
    const colorRegex = /^(#[0-9a-fA-F]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)|[a-zA-Z]+)$/;
    
    if (colorStr && !colorRegex.test(colorStr)) {
      throw new BadRequestException(`Invalid color format: ${colorStr}`);
    }
    return colorStr;
  };

  private readonly validateInteger = (value: any): number => {
    const num = Number(value);
    if (!Number.isInteger(num) || isNaN(num)) {
      throw new BadRequestException(`Value must be a valid integer: ${value}`);
    }
    return num;
  };

  private readonly validateNumber = (value: any): number => {
    const num = Number(value);
    if (isNaN(num)) {
      throw new BadRequestException(`Value must be a valid number: ${value}`);
    }
    return num;
  };

  private readonly validateFloat = (value: any): number => {
    return this.validateNumber(value);
  };

  private readonly validateCurrency = (value: any): number => {
    const num = this.validateNumber(value);
    return Math.round(num * 100) / 100; // Round to 2 decimal places
  };

  private readonly validatePercentage = (value: any): number => {
    const num = this.validateNumber(value);
    if (num < 0 || num > 100) {
      throw new BadRequestException(`Percentage must be between 0 and 100: ${num}`);
    }
    return num;
  };

  private readonly validateBoolean = (value: any): boolean => {
    if (typeof value === 'boolean') {
      return value;
    }
    
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase().trim();
      if (['true', '1', 'yes', 'on'].includes(lowerValue)) return true;
      if (['false', '0', 'no', 'off', ''].includes(lowerValue)) return false;
      throw new BadRequestException(`Cannot convert "${value}" to boolean`);
    }
    
    if (typeof value === 'number') {
      return Boolean(value);
    }
    
    throw new BadRequestException(`Cannot convert "${value}" to boolean`);
  };

  private readonly validateDate = (value: any): string => {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid date: ${value}`);
    }
    return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
  };

  private readonly validateDateTime = (value: any): string => {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid datetime: ${value}`);
    }
    return date.toISOString();
  };

  private readonly validateTime = (value: any): string => {
    const timeStr = String(value);
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
    
    if (!timeRegex.test(timeStr)) {
      throw new BadRequestException(`Invalid time format (use HH:MM or HH:MM:SS): ${timeStr}`);
    }
    return timeStr;
  };

  private readonly validateJson = (value: any): any => {
    if (typeof value === 'object' && value !== null) {
      try {
        JSON.stringify(value);
        return value;
      } catch (error) {
        throw new BadRequestException(`Invalid JSON object: ${error.message}`);
      }
    }
    
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        throw new BadRequestException(`Invalid JSON string: ${value}`);
      }
    }
    
    return value;
  };

  private readonly validateArray = (value: any): any[] => {
    if (Array.isArray(value)) {
      return value;
    }
    
    if (typeof value === 'string') {
      // Try JSON parsing first
      if (value.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            return parsed;
          }
        } catch {
          // Fall through to comma splitting
        }
      }
      
      // Split by comma and parse each item
      return value.split(',').map(item => {
        const trimmed = item.trim();
        if (trimmed === '') return '';
        
        // Try to parse as number
        const num = Number(trimmed);
        if (!isNaN(num)) return num;
        
        // Try to parse as boolean
        if (trimmed.toLowerCase() === 'true') return true;
        if (trimmed.toLowerCase() === 'false') return false;
        
        return trimmed;
      });
    }
    
    // For single values, wrap in array
    return [value];
  };
}
