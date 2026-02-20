import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException, Logger, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { AttributeResponseDto } from './dto/attribute-response.dto';
import { AttributeFilterDto, AttributeGroupFilterDto, AttributeSortField, SortOrder, DateFilter } from './dto/attribute-filter.dto';
import { BulkDeleteAttributeDto } from './dto/bulk-delete-attribute.dto';
import { AttributeValueValidator } from './validators/attribute-value.validator';
import { PaginatedResponse, PaginationUtils } from '../common';
import type { Attribute } from '@prisma/client';
import { AttributeType } from '../types/attribute-type.enum';
import { UserAttributeType, storageTypeToUserType, userTypeToStorageType } from '../types/user-attribute-type.enum';

@Injectable()
export class AttributeService {
  private readonly logger = new Logger(AttributeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: AttributeValueValidator,
    private readonly notificationService: NotificationService,
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
      
      // Log notification
      await this.notificationService.logAttributeCreation(userId, result.name, result.id);
      
      return this.transformAttributeForResponse(result);
    } catch (error) {
      this.handleDatabaseError(error, 'create');
    }
  }

  async findAll(userId: number, page: number = 1, limit: number = 10, includeGroups = false): Promise<PaginatedResponse<AttributeResponseDto>> {
    try {
      this.logger.log(`Fetching attributes for user: ${userId}`);
      
      const whereCondition = { userId };
      const paginationOptions = PaginationUtils.createPrismaOptions(page, limit);

      const [attributes, total] = await Promise.all([
        this.prisma.attribute.findMany({
          where: whereCondition,
          ...paginationOptions,
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
        }),
        this.prisma.attribute.count({ where: whereCondition }),
      ]);
      
      const transformedAttributes = attributes.map(attr => this.transformAttributeForResponse(attr));
      
      return PaginationUtils.createPaginatedResponse(transformedAttributes, total, page, limit);
    } catch (error) {
      this.logger.error(`Failed to fetch attributes for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAllWithProductCounts(userId: number, page: number = 1, limit: number = 10): Promise<PaginatedResponse<AttributeResponseDto & { productCount: number }>> {
    try {
      this.logger.log(`Fetching attributes with product counts for user: ${userId}`);
      
      const whereCondition = { userId };
      const paginationOptions = PaginationUtils.createPrismaOptions(page, limit);

      const [attributes, total] = await Promise.all([
        this.prisma.attribute.findMany({
          where: whereCondition,
          ...paginationOptions,
          include: {
            _count: {
              select: { 
                products: {
                  where: {
                    product: {
                      userId: userId
                    }
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.attribute.count({ where: whereCondition }),
      ]);
      
      const transformedAttributes = attributes.map(attr => ({
        ...this.transformAttributeForResponse(attr),
        productCount: (attr as any)._count.products
      }));
      
      return PaginationUtils.createPaginatedResponse(transformedAttributes, total, page, limit);
    } catch (error) {
      this.logger.error(`Failed to fetch attributes with product counts for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAllWithFilters(userId: number, filters: AttributeFilterDto): Promise<PaginatedResponse<AttributeResponseDto>> {
    try {
      this.logger.log(`Fetching attributes with filters for user: ${userId}`, filters);
      
      // Build where condition
      const whereCondition: any = { userId };
      
      // Search filter
      if (filters.search) {
        whereCondition.name = {
          contains: filters.search,
          mode: 'insensitive'
        };
      }
      
      // User-friendly type filter
      if (filters.userFriendlyType) {
        const storageType = userTypeToStorageType(filters.userFriendlyType);
        if (storageType) {
          whereCondition.type = storageType;
        }
      }
      
      // Default value filter
      if (filters.hasDefaultValue !== undefined) {
        if (filters.hasDefaultValue === 'true') {
          whereCondition.defaultValue = { not: null };
        } else if (filters.hasDefaultValue === 'false') {
          whereCondition.defaultValue = null;
        }
      }
      
      // In groups filter
      if (filters.inGroups !== undefined) {
        if (filters.inGroups === 'true') {
          whereCondition.attributeGroups = { some: {} };
        } else if (filters.inGroups === 'false') {
          whereCondition.attributeGroups = { none: {} };
        }
      }
      
      // Date range filters
      if (filters.createdAfter) {
        whereCondition.createdAt = { gte: new Date(filters.createdAfter) };
      }
      if (filters.createdBefore) {
        whereCondition.createdAt = { 
          ...whereCondition.createdAt,
          lte: new Date(filters.createdBefore) 
        };
      }
      
      // Build order by
      let orderBy: any = {};
      
      if (filters.dateFilter) {
        orderBy = { createdAt: filters.dateFilter === DateFilter.LATEST ? 'desc' : 'asc' };
      } else if (filters.sortBy) {
        const sortField = filters.sortBy === AttributeSortField.TOTAL_ATTRIBUTES 
          ? { attributeGroups: { _count: filters.sortOrder || SortOrder.ASC } }
          : { [filters.sortBy]: filters.sortOrder || SortOrder.ASC };
        orderBy = sortField;
      } else {
        orderBy = { name: 'asc' };
      }
      
      const paginationOptions = PaginationUtils.createPrismaOptions(filters.page || 1, filters.limit || 10);

      const [attributes, total] = await Promise.all([
        this.prisma.attribute.findMany({
          where: whereCondition,
          ...paginationOptions,
          include: {
            attributeGroups: {
              include: {
                attributeGroup: {
                  select: { id: true, name: true, description: true }
                }
              }
            }
          },
          orderBy,
        }),
        this.prisma.attribute.count({ where: whereCondition }),
      ]);
      
      const transformedAttributes = attributes.map(attr => this.transformAttributeForResponse(attr));
      
      return PaginationUtils.createPaginatedResponse(
        transformedAttributes, 
        total, 
        filters.page || 1, 
        filters.limit || 10
      );
    } catch (error) {
      this.logger.error(`Failed to fetch attributes with filters for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAllGroupsWithFilters(userId: number, filters: AttributeGroupFilterDto): Promise<PaginatedResponse<any>> {
    try {
      this.logger.log(`Fetching attribute groups with filters for user: ${userId}`, filters);
      
      // Build where condition
      const whereCondition: any = { userId };
      
      // Search filter
      if (filters.search) {
        whereCondition.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } }
        ];
      }
      
      // Description filter
      if (filters.hasDescription !== undefined) {
        if (filters.hasDescription === 'true') {
          whereCondition.description = { not: null };
        } else if (filters.hasDescription === 'false') {
          whereCondition.description = null;
        }
      }
      
      // Date range filters
      if (filters.createdAfter) {
        whereCondition.createdAt = { gte: new Date(filters.createdAfter) };
      }
      if (filters.createdBefore) {
        whereCondition.createdAt = { 
          ...whereCondition.createdAt,
          lte: new Date(filters.createdBefore) 
        };
      }
      
      // Build order by
      let orderBy: any = {};
      
      if (filters.dateFilter) {
        orderBy = { createdAt: filters.dateFilter === DateFilter.LATEST ? 'desc' : 'asc' };
      } else if (filters.sortBy) {
        const sortField = filters.sortBy === AttributeSortField.TOTAL_ATTRIBUTES 
          ? { attributes: { _count: filters.sortOrder || SortOrder.ASC } }
          : { [filters.sortBy]: filters.sortOrder || SortOrder.ASC };
        orderBy = sortField;
      } else {
        orderBy = { name: 'asc' };
      }
      
      const paginationOptions = PaginationUtils.createPrismaOptions(filters.page || 1, filters.limit || 10);

      const [groups, total] = await Promise.all([
        this.prisma.attributeGroup.findMany({
          where: whereCondition,
          ...paginationOptions,
          include: {
            attributes: {
              include: {
                attribute: true
              }
            },
            _count: {
              select: { attributes: true }
            }
          },
          orderBy,
        }),
        this.prisma.attributeGroup.count({ where: whereCondition }),
      ]);
      
      // Filter by attribute count if specified
      let filteredGroups = groups;
      if (filters.minAttributes !== undefined || filters.maxAttributes !== undefined) {
        filteredGroups = groups.filter(group => {
          const count = group._count.attributes;
          if (filters.minAttributes !== undefined && count < filters.minAttributes) return false;
          if (filters.maxAttributes !== undefined && count > filters.maxAttributes) return false;
          return true;
        });
      }
      
      const transformedGroups = filteredGroups.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description,
        userId: group.userId,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        totalAttributes: group._count.attributes,
        attributes: group.attributes.map(attr => this.transformAttributeForResponse(attr.attribute))
      }));
      
      return PaginationUtils.createPaginatedResponse(
        transformedGroups, 
        total, 
        filters.page || 1, 
        filters.limit || 10
      );
    } catch (error) {
      this.logger.error(`Failed to fetch attribute groups with filters for user ${userId}: ${error.message}`, error.stack);
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
      
      // Log notification
      await this.notificationService.logAttributeUpdate(userId, result.name, result.id);
      
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
      // Verify ownership first and get the attribute name for notification
      const attribute = await this.findOne(id, userId);
      
      this.logger.log(`Deleting attribute: ${id} for user: ${userId}`);

      await this.prisma.attribute.delete({
        where: { id },
      });

      this.logger.log(`Successfully deleted attribute with ID: ${id}`);
      
      // Clear caches
      await this.invalidateUserCache(userId);
      await this.invalidateAttributeCache(id, userId);

      // Log notification
      await this.notificationService.logAttributeDeletion(userId, attribute.name);

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
    // Use the static factory method from the DTO
    const dto = AttributeResponseDto.fromEntity(attribute);
    
    // Parse the stored value using the validator
    dto.defaultValue = this.validator.parseStoredValue(
      attribute.type as AttributeType,
      attribute.defaultValue
    );
    
    return dto;
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

  async getAttributeSuggestions(productId: number, attributeId: number, query: string, userId: number): Promise<string[]> {
    try {
      this.logger.log(`Getting attribute suggestions for attribute ${attributeId}, query: ${query}, excluding product ${productId}, user: ${userId}`);

      // Optimize: Use direct database query with indexing support
      // This approach leverages Prisma's query optimization and database indexes
      const productAttributes = await this.prisma.productAttribute.findMany({
        where: {
          attributeId,
          value: {
            not: null,
            startsWith: query, // More efficient than regex for prefix matching
            mode: 'insensitive', // Case-insensitive search
          },
          product: {
            userId,
            id: { not: productId },
          },
        },
        select: {
          value: true,
        },
        distinct: ['value'], // Get unique values only
        take: 20, // Limit results for performance
      });

      // Extract unique values
      const suggestions = productAttributes
        .map(attr => attr.value)
        .filter((value): value is string => value !== null && value.trim() !== '');

      this.logger.log(`Found ${suggestions.length} suggestions`);
      return suggestions;
    } catch (error) {
      this.logger.error(`Failed to get attribute suggestions: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to fetch attribute suggestions');
    }
  }

  async bulkDelete(bulkDeleteDto: BulkDeleteAttributeDto, userId: number): Promise<{ deletedCount: number; message: string }> {
    try {
      let attributeIds: number[] = [];

      // If IDs are provided, use them directly
      if (bulkDeleteDto.ids && bulkDeleteDto.ids.length > 0) {
        attributeIds = bulkDeleteDto.ids;
        this.logger.log(`Bulk deleting ${attributeIds.length} attributes by IDs`);
      } 
      // Otherwise, use filters to find the IDs
      else if (bulkDeleteDto.filters) {
        this.logger.log(`Fetching attributes with filters for user: ${userId}`);
        this.logger.log('AttributeFilterDto', bulkDeleteDto.filters);
        
        const whereCondition: any = { userId };

        // Search filter
        if (bulkDeleteDto.filters.search) {
          whereCondition.name = { 
            contains: bulkDeleteDto.filters.search, 
            mode: 'insensitive' 
          };
        }

        // User-friendly type filter
        if (bulkDeleteDto.filters.userFriendlyType) {
          const storageType = userTypeToStorageType(bulkDeleteDto.filters.userFriendlyType as UserAttributeType);
          if (storageType) {
            whereCondition.type = storageType;
          }
        }

        // Build order by for consistency with the list view
        let orderBy: any = { createdAt: 'desc' }; // Default
        
        if (bulkDeleteDto.filters.sortBy && bulkDeleteDto.filters.sortOrder) {
          orderBy = { 
            [bulkDeleteDto.filters.sortBy]: bulkDeleteDto.filters.sortOrder 
          };
        }

        // Fetch ALL matching attributes (no pagination for bulk delete)
        const attributes = await this.prisma.attribute.findMany({
          where: whereCondition,
          select: { id: true },
          orderBy: orderBy
        });

        attributeIds = attributes.map(attr => attr.id);
        this.logger.log(`Found ${attributeIds.length} attributes matching filters`);
      }

      if (attributeIds.length === 0) {
        return { 
          deletedCount: 0, 
          message: 'No attributes to delete' 
        };
      }

      // Delete all attributes with the given IDs
      const deleteResult = await this.prisma.attribute.deleteMany({
        where: { 
          id: { in: attributeIds },
          userId // Ensure user owns the attributes
        }
      });

      // Clear cache for this user
      await this.invalidateUserCache(userId);

      this.logger.log(`Successfully deleted ${deleteResult.count} attribute(s)`);

      return { 
        deletedCount: deleteResult.count, 
        message: `Successfully deleted ${deleteResult.count} attribute(s)` 
      };
    } catch (error) {
      this.logger.error(`Failed to bulk delete: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to bulk delete attributes');
    }
  }
}


