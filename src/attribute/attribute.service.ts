import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import type { Attribute, AttributeType } from '../../generated/prisma';

@Injectable()
export class AttributeService {
  private readonly logger = new Logger(AttributeService.name);
  private readonly validatorCache = new Map<AttributeType, (value: any) => any>();

  constructor(private prisma: PrismaService) {
    // Pre-populate validator cache for better performance
    this.initializeValidatorCache();
  }

  private initializeValidatorCache(): void {
    const validators = this.getValidatorMap();
    Object.entries(validators).forEach(([type, validator]) => {
      this.validatorCache.set(type as AttributeType, validator);
    });
  }

  async create(createAttributeDto: CreateAttributeDto, userId: number): Promise<Attribute> {
    try {
      this.logger.log(`Creating attribute: ${createAttributeDto.name} for user: ${userId}`);
      
      // Sanitize and process the default value based on type
      const processedDefaultValue = this.processDefaultValue(createAttributeDto.type, createAttributeDto.defaultValue);
      
      const result = await this.prisma.attribute.create({
        data: {
          name: createAttributeDto.name,
          type: createAttributeDto.type as AttributeType,
          defaultValue: processedDefaultValue,
          userId,
        },
      });
      
      this.logger.log(`Successfully created attribute with ID: ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to create attribute: ${error.message}`, error.stack);
      
      // Handle Prisma-specific errors
      if (error.code === 'P2002') {
        throw new ConflictException('Attribute with this name already exists');
      }
      
      if (error.code === 'P2000') {
        throw new BadRequestException('The provided value is too long for the database field');
      }
      
      if (error.code === 'P2005') {
        throw new BadRequestException('The value stored in the database is invalid for the field type');
      }
      
      if (error.code === 'P2006') {
        throw new BadRequestException('The provided value is not valid for this field');
      }
      
      if (error.code === 'P2007') {
        throw new BadRequestException('Data validation error');
      }
      
      // Re-throw known exceptions
      if (error.status) {
        throw error;
      }
      
      // Log and re-throw unknown errors
      this.logger.error(`Unexpected error creating attribute: ${error.message}`);
      throw error;
    }
  }

  private processDefaultValue(type: AttributeType, defaultValue: any): any {
    if (defaultValue === undefined || defaultValue === null) {
      return null;
    }

    // Use cached validator for better performance
    const validator = this.validatorCache.get(type);
    
    if (!validator) {
      this.logger.warn(`Unknown attribute type: ${type}, returning value as-is`);
      return defaultValue;
    }

    try {
      return validator(defaultValue);
    } catch (error) {
      this.logger.error(`Error processing default value for type ${type}: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to process default value for type ${type}: ${error.message}`);
    }
  }

  private getValidatorMap(): Record<AttributeType, (value: any) => any> {
    return {
      // String-like types
      STRING: this.validateString,
      TEXT: this.validateString,
      EMAIL: this.validateEmail,
      URL: this.validateUrl,
      PHONE: this.validateString,
      COLOR: this.validateColor,

      // Numeric types
      INTEGER: this.validateInteger,
      NUMBER: this.validateNumber,
      FLOAT: this.validateNumber,
      CURRENCY: this.validateNumber,
      PERCENTAGE: this.validatePercentage,

      // Boolean type
      BOOLEAN: this.validateBoolean,

      // Date/Time types
      DATE: this.validateDateTime,
      DATETIME: this.validateDateTime,
      TIME: this.validateDateTime,

      // Complex types
      JSON: this.validateJson,
      ARRAY: this.validateArray,
      
      // File types (treat as strings for now)
      FILE: this.validateString,
      IMAGE: this.validateString,
      
      // Enum type (treat as string for now)
      ENUM: this.validateString,
    };
  }

  private readonly validateString = (value: any): string => {
    return String(value);
  };

  private readonly validateEmail = (value: any): string => {
    const emailStr = String(value);
    // Basic email validation - you could enhance this with a proper regex
    if (emailStr && !emailStr.includes('@')) {
      this.logger.warn(`Invalid email format: ${emailStr}`);
    }
    return emailStr;
  };

  private readonly validateUrl = (value: any): string => {
    const urlStr = String(value);
    // Basic URL validation
    if (urlStr && !urlStr.match(/^https?:\/\//)) {
      this.logger.warn(`URL should start with http:// or https://: ${urlStr}`);
    }
    return urlStr;
  };

  private readonly validateColor = (value: any): string => {
    const colorStr = String(value);
    // Basic color validation (hex, rgb, color names)
    if (colorStr && !colorStr.match(/^(#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|[a-zA-Z]+)$/)) {
      this.logger.warn(`Invalid color format: ${colorStr}`);
    }
    return colorStr;
  };

  private readonly validateInteger = (value: any): number => {
    if (typeof value === 'number' && Number.isInteger(value)) {
      return value;
    }
    
    const intValue = parseInt(String(value), 10);
    if (isNaN(intValue)) {
      throw new BadRequestException(`Cannot convert "${value}" to integer`);
    }
    return intValue;
  };

  private readonly validateNumber = (value: any): number => {
    if (typeof value === 'number' && !isNaN(value)) {
      return value;
    }
    
    const numValue = parseFloat(String(value));
    if (isNaN(numValue)) {
      throw new BadRequestException(`Cannot convert "${value}" to number`);
    }
    return numValue;
  };

  private readonly validatePercentage = (value: any): number => {
    const numValue = this.validateNumber(value);
    // Allow percentages from 0 to 100 or 0 to 1 (decimal)
    if (numValue < 0 || numValue > 100) {
      this.logger.warn(`Percentage value ${numValue} is outside typical range (0-100)`);
    }
    return numValue;
  };

  private readonly validateBoolean = (value: any): boolean => {
    if (typeof value === 'boolean') {
      return value;
    }
    
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase().trim();
      if (['true', '1', 'yes', 'on'].includes(lowerValue)) return true;
      if (['false', '0', 'no', 'off', ''].includes(lowerValue)) return false;
      throw new BadRequestException(`Cannot convert string "${value}" to boolean`);
    }
    
    if (typeof value === 'number') {
      return Boolean(value);
    }
    
    throw new BadRequestException(`Cannot convert "${value}" (${typeof value}) to boolean`);
  };

  private readonly validateDateTime = (value: any): string => {
    if (typeof value === 'string') {
      // Try to parse the date to validate it
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new BadRequestException(`Invalid date format: "${value}"`);
      }
      return value; // Keep as string for Prisma JSON field
    }
    
    if (value instanceof Date) {
      return value.toISOString();
    }
    
    if (typeof value === 'number') {
      // Assume timestamp
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new BadRequestException(`Invalid timestamp: ${value}`);
      }
      return date.toISOString();
    }
    
    return String(value);
  };

  private readonly validateJson = (value: any): any => {
    if (typeof value === 'object' && value !== null) {
      try {
        // Validate by attempting to stringify
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
        throw new BadRequestException(`Invalid JSON string: "${value}"`);
      }
    }
    
    // For primitive types, wrap them in a simple object or return as-is
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
      
      // Split by comma and trim whitespace
      return value.split(',').map(item => {
        const trimmed = item.trim();
        // Try to parse numbers and booleans
        if (!isNaN(Number(trimmed))) {
          return Number(trimmed);
        }
        if (trimmed.toLowerCase() === 'true') return true;
        if (trimmed.toLowerCase() === 'false') return false;
        return trimmed;
      });
    }
    
    // For single values, wrap in array
    return [value];
  };

  async findAll(userId: number): Promise<Attribute[]> {
    try {
      this.logger.log(`Fetching all attributes for user: ${userId}`);
      return await this.prisma.attribute.findMany({
        where: { userId },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      this.logger.error(`Failed to fetch attributes for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findOne(id: number, userId: number): Promise<Attribute> {
    try {
      this.logger.log(`Fetching attribute: ${id} for user: ${userId}`);
      
      const attribute = await this.prisma.attribute.findUnique({
        where: { id },
        include: {
          attributeGroups: {
            include: {
              attributeGroup: true,
            },
          },
        },
      });

      if (!attribute) {
        throw new NotFoundException(`Attribute with ID ${id} not found`);
      }

      if (attribute.userId !== userId) {
        throw new ForbiddenException('You can only access your own attributes');
      }

      return attribute;
    } catch (error) {
      if (error.status) {
        throw error; // Re-throw HTTP exceptions
      }
      
      this.logger.error(`Failed to fetch attribute ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async update(id: number, updateAttributeDto: UpdateAttributeDto, userId: number): Promise<Attribute> {
    try {
      // Check if exists and user owns it
      const existingAttribute = await this.findOne(id, userId);
      
      this.logger.log(`Updating attribute: ${id} for user: ${userId}`);
      
      // Process the default value if it's being updated
      let processedDefaultValue = updateAttributeDto.defaultValue;
      if (updateAttributeDto.defaultValue !== undefined) {
        const typeToUse = updateAttributeDto.type || existingAttribute.type;
        processedDefaultValue = this.processDefaultValue(typeToUse as AttributeType, updateAttributeDto.defaultValue);
      }

      const result = await this.prisma.attribute.update({
        where: { id },
        data: {
          ...(updateAttributeDto.name && { name: updateAttributeDto.name }),
          ...(updateAttributeDto.type && { type: updateAttributeDto.type as AttributeType }),
          ...(processedDefaultValue !== undefined && { defaultValue: processedDefaultValue }),
        },
      });
      
      this.logger.log(`Successfully updated attribute with ID: ${id}`);
      return result;
    } catch (error) {
      if (error.status) {
        throw error; // Re-throw HTTP exceptions
      }
      
      if (error.code === 'P2002') {
        throw new ConflictException('Attribute with this name already exists');
      }
      
      if (error.code === 'P2000') {
        throw new BadRequestException('The provided value is too long for the database field');
      }
      
      this.logger.error(`Failed to update attribute ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async remove(id: number, userId: number): Promise<{ message: string }> {
    try {
      // Check if exists and user owns it
      await this.findOne(id, userId);
      
      this.logger.log(`Deleting attribute: ${id} for user: ${userId}`);

      await this.prisma.attribute.delete({
        where: { id },
      });

      this.logger.log(`Successfully deleted attribute with ID: ${id}`);
      return { message: `Attribute with ID ${id} has been deleted` };
    } catch (error) {
      if (error.status) {
        throw error; // Re-throw HTTP exceptions
      }
      
      this.logger.error(`Failed to delete attribute ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
