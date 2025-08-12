import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException, Logger, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { AttributeResponseDto } from './dto/attribute-response.dto';
import { AttributeValueValidator } from './validators/attribute-value.validator';
import type { Attribute } from '../../generated/prisma';
import { AttributeType } from '../types/attribute-type.enum';

@Injectable()
export class AttributeService {
  private readonly logger = new Logger(AttributeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: AttributeValueValidator,
    @Optional() @Inject('CACHE_MANAGER') private cacheManager?: any
  ) {}

  async create(createAttributeDto: CreateAttributeDto, userId: number): Promise<AttributeResponseDto> {
    try {
      this.logger.log(`Creating attribute: ${createAttributeDto.name} for user: ${userId}`);
      
      // Validate and process the default value
      const processedDefaultValue = this.validator.validateAndStringify(
        createAttributeDto.type, 
        createAttributeDto.defaultValue
      );
      
      const result = await this.prisma.attribute.create({
        data: {
          name: createAttributeDto.name,
          type: createAttributeDto.type,
          defaultValue: processedDefaultValue,
          userId,
        },
      });
      
      this.logger.log(`Successfully created attribute with ID: ${result.id}`);
      
      // Clear cache for this user
      await this.invalidateUserCache(userId);
      
      return this.transformAttributeForResponse(result);
    } catch (error) {
      this.handleDatabaseError(error, 'create');
    }
  }

  async findAll(userId: number, includeGroups = false): Promise<AttributeResponseDto[]> {
    try {
      const cacheKey = `attributes:user:${userId}:groups:${includeGroups}`;
      
      // Try to get from cache first
      if (this.cacheManager) {
        const cached = await this.cacheManager.get(cacheKey) as AttributeResponseDto[];
        if (cached) {
          this.logger.log(`Returning cached attributes for user: ${userId}`);
          return cached;
        }
      }

      this.logger.log(`Fetching attributes for user: ${userId}`);
      
      const attributes = await this.prisma.attribute.findMany({
        where: { userId },
        include: includeGroups ? {
          attributeGroups: {
            include: {
              attributeGroup: {
                select: { id: true, name: true, description: true }
              }
            }
          }
        } : undefined,
        orderBy: { createdAt: 'desc' },
      });
      
      const transformedAttributes = attributes.map(attr => this.transformAttributeForResponse(attr));
      
      // Cache the result
      if (this.cacheManager) {
        await this.cacheManager.set(cacheKey, transformedAttributes, 300); // 5 minutes
      }
      
      return transformedAttributes;
    } catch (error) {
      this.logger.error(`Failed to fetch attributes for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findOne(id: number, userId: number): Promise<AttributeResponseDto> {
    try {
      const cacheKey = `attribute:${id}:user:${userId}`;
      
      // Try cache first
      if (this.cacheManager) {
        const cached = await this.cacheManager.get(cacheKey) as AttributeResponseDto;
        if (cached) {
          return cached;
        }
      }

      this.logger.log(`Fetching attribute: ${id} for user: ${userId}`);
      
      const attribute = await this.prisma.attribute.findFirst({
        where: { 
          id,
          userId // Ensure user owns the attribute
        },
        include: {
          attributeGroups: {
            include: {
              attributeGroup: {
                select: { id: true, name: true, description: true }
              }
            }
          }
        }
      });

      if (!attribute) {
        throw new NotFoundException(`Attribute with ID ${id} not found or access denied`);
      }

      const transformed = this.transformAttributeForResponse(attribute);
      
      // Cache the result
      if (this.cacheManager) {
        await this.cacheManager.set(cacheKey, transformed, 300); // 5 minutes
      }
      
      return transformed;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      this.logger.error(`Failed to fetch attribute ${id}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch attribute');
    }
  }

  async update(id: number, updateAttributeDto: UpdateAttributeDto, userId: number): Promise<AttributeResponseDto> {
    try {
      // Verify ownership first
      await this.findOne(id, userId);
      
      this.logger.log(`Updating attribute: ${id} for user: ${userId}`);
      
      // Prepare update data
      const updateData: any = {};
      
      if (updateAttributeDto.name !== undefined) {
        updateData.name = updateAttributeDto.name;
      }
      
      if (updateAttributeDto.type !== undefined) {
        updateData.type = updateAttributeDto.type;
      }
      
      if (updateAttributeDto.defaultValue !== undefined) {
        // Get the current or new type for validation
        const typeForValidation = updateAttributeDto.type || await this.getAttributeType(id);
        updateData.defaultValue = this.validator.validateAndStringify(
          typeForValidation,
          updateAttributeDto.defaultValue
        );
      }

      const result = await this.prisma.attribute.update({
        where: { id },
        data: updateData,
      });
      
      this.logger.log(`Successfully updated attribute with ID: ${id}`);
      
      // Clear caches
      await this.invalidateUserCache(userId);
      await this.invalidateAttributeCache(id, userId);
      
      return this.transformAttributeForResponse(result);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.handleDatabaseError(error, 'update');
    }
  }

  async remove(id: number, userId: number): Promise<{ message: string }> {
    try {
      // Verify ownership first
      await this.findOne(id, userId);
      
      this.logger.log(`Deleting attribute: ${id} for user: ${userId}`);

      await this.prisma.attribute.delete({
        where: { id },
      });

      this.logger.log(`Successfully deleted attribute with ID: ${id}`);
      
      // Clear caches
      await this.invalidateUserCache(userId);
      await this.invalidateAttributeCache(id, userId);

      return { message: `Attribute successfully deleted` };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      this.logger.error(`Failed to delete attribute ${id}: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to delete attribute');
    }
  }

  // Helper methods
  private transformAttributeForResponse(attribute: any): AttributeResponseDto {
    return {
      ...attribute,
      type: attribute.type as AttributeType,
      defaultValue: this.validator.parseStoredValue(
        attribute.type as AttributeType,
        attribute.defaultValue
      )
    };
  }

  private async getAttributeType(id: number): Promise<AttributeType> {
    const attribute = await this.prisma.attribute.findUnique({
      where: { id },
      select: { type: true }
    });
    
    if (!attribute) {
      throw new NotFoundException(`Attribute with ID ${id} not found`);
    }
    
    return attribute.type as AttributeType;
  }

  private handleDatabaseError(error: any, operation: string): never {
    this.logger.error(`Failed to ${operation} attribute: ${error.message}`, error.stack);
    
    // Handle Prisma-specific errors
    if (error.code === 'P2002') {
      throw new ConflictException('An attribute with this name already exists');
    }
    
    if (error.code === 'P2000') {
      throw new BadRequestException('The provided value is too long');
    }
    
    if (error.code === 'P2025') {
      throw new NotFoundException('Attribute not found');
    }
    
    // Re-throw known HTTP exceptions
    if (error.status) {
      throw error;
    }
    
    // Default error
    throw new BadRequestException(`Failed to ${operation} attribute`);
  }

  private async invalidateUserCache(userId: number): Promise<void> {
    if (!this.cacheManager) return;
    
    try {
      const keys = [
        `attributes:user:${userId}:groups:true`,
        `attributes:user:${userId}:groups:false`
      ];
      
      await Promise.all(keys.map(key => this.cacheManager.del(key)));
    } catch (error) {
      this.logger.warn(`Failed to clear user cache: ${error.message}`);
    }
  }

  private async invalidateAttributeCache(id: number, userId: number): Promise<void> {
    if (!this.cacheManager) return;
    
    try {
      await this.cacheManager.del(`attribute:${id}:user:${userId}`);
    } catch (error) {
      this.logger.warn(`Failed to clear attribute cache: ${error.message}`);
    }
  }
}


