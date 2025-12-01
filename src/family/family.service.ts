import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { UpdateFamilyDto } from './dto/update-family.dto';
import { FamilyResponseDto } from './dto/family-response.dto';
import { FamilyFilterDto, FamilySortField, SortOrder, DateFilter } from './dto/family-filter.dto';
import { AttributeValueValidator } from '../attribute/validators/attribute-value.validator';
import { AttributeType } from '../types/attribute-type.enum';
import { PaginatedResponse, PaginationUtils } from '../common';
import type { Family } from '@prisma/client';

@Injectable()
export class FamilyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attributeValidator: AttributeValueValidator
  ) {}

  async create(createFamilyDto: CreateFamilyDto, userId: number): Promise<Family> {
    const { name, requiredAttributes = [], otherAttributes = [] } = createFamilyDto;

    // Check if family name already exists for this user
    const existingFamily = await this.prisma.family.findUnique({
      where: {
        name_userId: {
          name,
          userId,
        },
      },
    });

    if (existingFamily) {
      throw new ConflictException('Family with this name already exists');
    }

    // Validate that all attribute IDs exist and belong to the user
    const allAttributeIds = [
      ...requiredAttributes.map(attr => attr.attributeId),
      ...otherAttributes.map(attr => attr.attributeId),
    ];

    const allAttributes = [
      ...requiredAttributes,
      ...otherAttributes,
    ];

    if (allAttributeIds.length > 0) {
      const attributesFromDb = await this.prisma.attribute.findMany({
        where: {
          id: { in: allAttributeIds },
          userId,
        },
      });

      if (attributesFromDb.length !== allAttributeIds.length) {
        throw new BadRequestException('One or more attributes not found or do not belong to you');
      }

      // Validate additionalValue for each attribute
      for (const attr of allAttributes) {
        const dbAttr = attributesFromDb.find(a => a.id === attr.attributeId);
        if (dbAttr && attr.additionalValue !== undefined) {
          this.attributeValidator.validate(dbAttr.type as AttributeType, attr.additionalValue);
        }
      }
    }

    // Check for duplicate attribute IDs
    const uniqueAttributeIds = new Set(allAttributeIds);
    if (uniqueAttributeIds.size !== allAttributeIds.length) {
      throw new BadRequestException('Duplicate attribute IDs found');
    }

    try {
      return await this.prisma.family.create({
        data: {
          name,
          userId,
          familyAttributes: {
            create: [
                ...requiredAttributes.map(attr => ({
                  attributeId: attr.attributeId,
                  isRequired: true,
                  additionalValue: attr.additionalValue !== undefined ? String(attr.additionalValue) : null,
                })),
                ...otherAttributes.map(attr => ({
                  attributeId: attr.attributeId,
                  isRequired: false,
                  additionalValue: attr.additionalValue !== undefined ? String(attr.additionalValue) : null,
                })),
            ],
          },
        },
        include: {
          familyAttributes: {
            include: {
              attribute: true,
            },
          },
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Family with this name already exists');
      }
      throw error;
    }
  }

  async findAll(userId: number, page: number = 1, limit: number = 10): Promise<PaginatedResponse<FamilyResponseDto>> {
    const whereCondition = { userId };
    const paginationOptions = PaginationUtils.createPrismaOptions(page, limit);

    const [families, total] = await Promise.all([
      this.prisma.family.findMany({
        where: whereCondition,
        ...paginationOptions,
        include: {
          familyAttributes: {
            include: {
              attribute: true,
            },
          },
          _count: {
            select: {
              products: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.family.count({ where: whereCondition }),
    ]);

    const familyResponseDtos = families.map(family => ({
      id: family.id,
      name: family.name,
      userId: family.userId,
      createdAt: family.createdAt,
      updatedAt: family.updatedAt,
      productCount: family._count.products,
      familyAttributes: family.familyAttributes.map(fa => ({
        id: fa.id,
        isRequired: fa.isRequired,
        additionalValue: this.attributeValidator.parseStoredValue(fa.attribute.type as AttributeType, fa.additionalValue),
        attribute: {
          id: fa.attribute.id,
          name: fa.attribute.name,
          type: fa.attribute.type,
          defaultValue: this.attributeValidator.parseStoredValue(fa.attribute.type as AttributeType, fa.attribute.defaultValue),
          userId: fa.attribute.userId,
        },
      })),
    }));

    return PaginationUtils.createPaginatedResponse(familyResponseDtos, total, page, limit);
  }

  async findAllWithFilters(userId: number, filters: FamilyFilterDto): Promise<PaginatedResponse<FamilyResponseDto>> {
    // Build where condition
    const whereCondition: any = { userId };
    
    // Search filter
    if (filters.search) {
      whereCondition.name = {
        contains: filters.search,
        mode: 'insensitive'
      };
    }
    
    // Attribute filters
    if (filters.attributeIds && filters.attributeIds.length > 0) {
      if (filters.attributeFilter === 'all') {
        // Family must contain ALL specified attributes
        whereCondition.familyAttributes = {
          every: {
            attributeId: { in: filters.attributeIds }
          }
        };
      } else {
        // Family must contain ANY of the specified attributes (default)
        whereCondition.familyAttributes = {
          some: {
            attributeId: { in: filters.attributeIds }
          }
        };
      }
    }
    
    // Has products filter
    if (filters.hasProducts !== undefined) {
      if (filters.hasProducts === 'true') {
        whereCondition.products = { some: {} };
      } else if (filters.hasProducts === 'false') {
        whereCondition.products = { none: {} };
      }
    }
    
    // Has required attributes filter
    if (filters.hasRequiredAttributes !== undefined) {
      if (filters.hasRequiredAttributes === 'true') {
        whereCondition.familyAttributes = {
          ...whereCondition.familyAttributes,
          some: { isRequired: true }
        };
      } else if (filters.hasRequiredAttributes === 'false') {
        whereCondition.familyAttributes = {
          ...whereCondition.familyAttributes,
          none: { isRequired: true }
        };
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
      switch (filters.sortBy) {
        case FamilySortField.TOTAL_PRODUCTS:
          orderBy = { products: { _count: filters.sortOrder || SortOrder.ASC } };
          break;
        case FamilySortField.TOTAL_ATTRIBUTES:
          orderBy = { familyAttributes: { _count: filters.sortOrder || SortOrder.ASC } };
          break;
        default:
          orderBy = { [filters.sortBy]: filters.sortOrder || SortOrder.ASC };
      }
    } else {
      orderBy = { name: 'asc' };
    }
    
    const paginationOptions = PaginationUtils.createPrismaOptions(filters.page || 1, filters.limit || 10);

    const [families, total] = await Promise.all([
      this.prisma.family.findMany({
        where: whereCondition,
        ...paginationOptions,
        include: {
          familyAttributes: {
            include: {
              attribute: true,
            },
          },
          _count: {
            select: {
              products: true,
              familyAttributes: true,
            },
          },
        },
        orderBy,
      }),
      this.prisma.family.count({ where: whereCondition }),
    ]);

    // Filter by counts if specified
    let filteredFamilies = families;
    if (filters.minProducts !== undefined || filters.maxProducts !== undefined ||
        filters.minAttributes !== undefined || filters.maxAttributes !== undefined) {
      filteredFamilies = families.filter(family => {
        const productCount = family._count.products;
        const attributeCount = family._count.familyAttributes;
        
        if (filters.minProducts !== undefined && productCount < filters.minProducts) return false;
        if (filters.maxProducts !== undefined && productCount > filters.maxProducts) return false;
        if (filters.minAttributes !== undefined && attributeCount < filters.minAttributes) return false;
        if (filters.maxAttributes !== undefined && attributeCount > filters.maxAttributes) return false;
        
        return true;
      });
    }

    const familyResponseDtos = filteredFamilies.map(family => ({
      id: family.id,
      name: family.name,
      userId: family.userId,
      createdAt: family.createdAt,
      updatedAt: family.updatedAt,
      productCount: family._count.products,
      totalAttributes: family._count.familyAttributes,
      familyAttributes: family.familyAttributes.map(fa => ({
        id: fa.id,
        isRequired: fa.isRequired,
        additionalValue: this.attributeValidator.parseStoredValue(fa.attribute.type as AttributeType, fa.additionalValue),
        attribute: {
          id: fa.attribute.id,
          name: fa.attribute.name,
          type: fa.attribute.type,
          defaultValue: this.attributeValidator.parseStoredValue(fa.attribute.type as AttributeType, fa.attribute.defaultValue),
          userId: fa.attribute.userId,
        },
      })),
    }));

    return PaginationUtils.createPaginatedResponse(
      familyResponseDtos, 
      total, 
      filters.page || 1, 
      filters.limit || 10
    );
  }

  async findOne(id: number, userId: number): Promise<FamilyResponseDto> {
    const family = await this.prisma.family.findUnique({
      where: { id },
      include: {
        familyAttributes: {
          include: {
            attribute: true,
          },
        },
        products: {
          select: {
            id: true,
            name: true,
            sku: true,
            status: true,
            imageUrl: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!family) {
      throw new NotFoundException(`Family with ID ${id} not found`);
    }

    if (family.userId !== userId) {
      throw new ForbiddenException('You can only access your own families');
    }

    return {
      id: family.id,
      name: family.name,
      userId: family.userId,
      createdAt: family.createdAt,
      updatedAt: family.updatedAt,
      products: family.products.map(product => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        status: product.status,
        imageUrl: product.imageUrl,
      })),
      familyAttributes: family.familyAttributes.map(fa => ({
        id: fa.id,
        isRequired: fa.isRequired,
        additionalValue: this.attributeValidator.parseStoredValue(fa.attribute.type as AttributeType, fa.additionalValue),
        attribute: {
          id: fa.attribute.id,
          name: fa.attribute.name,
          type: fa.attribute.type,
          defaultValue: this.attributeValidator.parseStoredValue(fa.attribute.type as AttributeType, fa.attribute.defaultValue),
          userId: fa.attribute.userId,
        },
      })),
    };
  }

  async update(id: number, updateFamilyDto: UpdateFamilyDto, userId: number): Promise<Family> {
    const existingFamily = await this.findOne(id, userId);
    
    const { name, requiredAttributes = [], otherAttributes = [] } = updateFamilyDto;

    // If name is being updated, check for conflicts
    if (name && name !== existingFamily.name) {
      const conflictingFamily = await this.prisma.family.findUnique({
        where: {
          name_userId: {
            name,
            userId,
          },
        },
      });

      if (conflictingFamily) {
        throw new ConflictException('Family with this name already exists');
      }
    }

    // Validate attributes if provided
    const allAttributeIds = [
      ...requiredAttributes.map(attr => attr.attributeId),
      ...otherAttributes.map(attr => attr.attributeId),
    ];
    
    const allAttributes = [
      ...requiredAttributes,
      ...otherAttributes,
    ];

    if (allAttributeIds.length > 0) {
      const attributesFromDb = await this.prisma.attribute.findMany({
        where: {
          id: { in: allAttributeIds },
          userId,
        },
      });

      if (attributesFromDb.length !== allAttributeIds.length) {
        throw new BadRequestException('One or more attributes not found or do not belong to you');
      }

      // Validate additionalValue for each attribute
      for (const attr of allAttributes) {
        const dbAttr = attributesFromDb.find(a => a.id === attr.attributeId);
        if (dbAttr && attr.additionalValue !== undefined) {
          this.attributeValidator.validate(dbAttr.type as AttributeType, attr.additionalValue);
        }
      }

      // Check for duplicate attribute IDs
      const uniqueAttributeIds = new Set(allAttributeIds);
      if (uniqueAttributeIds.size !== allAttributeIds.length) {
        throw new BadRequestException('Duplicate attribute IDs found');
      }
    }

    try {
      return await this.prisma.family.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(allAttributeIds.length > 0 && {
            familyAttributes: {
              deleteMany: {},
              create: [
                  ...requiredAttributes.map(attr => ({
                    attributeId: attr.attributeId,
                    isRequired: true,
                    additionalValue: attr.additionalValue !== undefined ? String(attr.additionalValue) : null,
                  })),
                  ...otherAttributes.map(attr => ({
                    attributeId: attr.attributeId,
                    isRequired: false,
                    additionalValue: attr.additionalValue !== undefined ? String(attr.additionalValue) : null,
                  })),
              ],
            },
          }),
        },
        include: {
          familyAttributes: {
            include: {
              attribute: true,
            },
          },
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Family with this name already exists');
      }
      throw error;
    }
  }

  async remove(id: number, userId: number): Promise<{ message: string }> {
    await this.findOne(id, userId); // Check if exists and user owns it

    await this.prisma.family.delete({
      where: { id },
    });

    return { message: `Family with ID ${id} has been deleted` };
  }

  async addAttribute(familyId: number, attributeId: number, isRequired: boolean, additionalValue: any, userId: number) {
    const family = await this.findOne(familyId, userId);

    // Check if attribute exists and belongs to user
    const attribute = await this.prisma.attribute.findUnique({
      where: { id: attributeId },
    });

    if (!attribute || attribute.userId !== userId) {
      throw new BadRequestException('Attribute not found or does not belong to you');
    }

    // Validate the additional value
    if (additionalValue !== undefined) {
      this.attributeValidator.validate(attribute.type as AttributeType, additionalValue);
    }

    // Check if attribute is already assigned to family
    const existingFamilyAttribute = await this.prisma.familyAttribute.findUnique({
      where: {
        familyId_attributeId: {
          familyId,
          attributeId,
        },
      },
    });

    if (existingFamilyAttribute) {
      throw new ConflictException('Attribute is already assigned to this family');
    }

    return await this.prisma.familyAttribute.create({
      data: {
        familyId,
        attributeId,
        isRequired,
        additionalValue: additionalValue !== undefined ? String(additionalValue) : null,
      },
      include: {
        attribute: true,
      },
    });
  }

  async removeAttribute(familyId: number, attributeId: number, userId: number) {
    await this.findOne(familyId, userId); // Check if family exists and user owns it

    const familyAttribute = await this.prisma.familyAttribute.findUnique({
      where: {
        familyId_attributeId: {
          familyId,
          attributeId,
        },
      },
    });

    if (!familyAttribute) {
      throw new NotFoundException('Attribute is not assigned to this family');
    }

    await this.prisma.familyAttribute.delete({
      where: {
        familyId_attributeId: {
          familyId,
          attributeId,
        },
      },
    });

    return { message: 'Attribute removed from family successfully' };
  }
}
