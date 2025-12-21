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
      // Get existing family attributes
      const existingFamilyAttributes = await this.prisma.familyAttribute.findMany({
        where: { familyId: id },
        select: { id: true, attributeId: true, isRequired: true, additionalValue: true },
      });

      // console.log(`[Family Update] Existing FamilyAttributes:`, existingFamilyAttributes);

      // Create a map of existing attributes: attributeId -> familyAttribute
      const existingAttrMap = new Map(
        existingFamilyAttributes.map(fa => [fa.attributeId, fa])
      );

      // Build maps for incoming attributes
      const incomingAttrMap = new Map<number, { isRequired: boolean; additionalValue: string | null }>();
      
      for (const attr of allAttributes) {
        const isRequired = requiredAttributes.some(ra => ra.attributeId === attr.attributeId);
        const additionalValue = attr.additionalValue !== undefined ? String(attr.additionalValue) : null;
        incomingAttrMap.set(attr.attributeId, { isRequired, additionalValue });
      }

      // console.log(`[Family Update] Incoming attributes:`, Array.from(incomingAttrMap.entries()));

      // Categorize operations
      const toUpdate: Array<{ familyAttributeId: number; attributeId: number; isRequired: boolean; additionalValue: string | null }> = [];
      const toCreate: Array<{ attributeId: number; isRequired: boolean; additionalValue: string | null }> = [];
      const toDelete: Array<{ familyAttributeId: number; attributeId: number }> = [];

      // Check what needs to be updated or kept
      for (const [attributeId, incoming] of incomingAttrMap.entries()) {
        const existing = existingAttrMap.get(attributeId);
        
        if (existing) {
          // Attribute exists - check if it needs updating
          if (existing.isRequired !== incoming.isRequired || existing.additionalValue !== incoming.additionalValue) {
            toUpdate.push({
              familyAttributeId: existing.id,
              attributeId,
              isRequired: incoming.isRequired,
              additionalValue: incoming.additionalValue,
            });
          } else {
            // console.log(`[Family Update] Attribute ${attributeId} unchanged, skipping`);
          }
        } else {
          // New attribute - needs to be created
          toCreate.push({
            attributeId,
            isRequired: incoming.isRequired,
            additionalValue: incoming.additionalValue,
          });
        }
      }

      // Check what needs to be deleted
      for (const existing of existingFamilyAttributes) {
        if (!incomingAttrMap.has(existing.attributeId)) {
          toDelete.push({
            familyAttributeId: existing.id,
            attributeId: existing.attributeId,
          });
        }
      }

      // console.log(`[Family Update] Operations planned:`, {
      //   toUpdate: toUpdate.length,
      //   toCreate: toCreate.length,
      //   toDelete: toDelete.length,
      // });
      // console.log(`[Family Update] Details:`, { toUpdate, toCreate, toDelete });

      // Use a transaction to perform all operations
      return await this.prisma.$transaction(async (tx) => {
        // console.log(`[Family Update] Starting transaction`);

        // 1. Update the family name if needed
        if (name && name !== existingFamily.name) {
          // console.log(`[Family Update] Updating family name from "${existingFamily.name}" to "${name}"`);
          await tx.family.update({
            where: { id },
            data: { name },
          });
        }

        // 2. Update existing FamilyAttribute rows in place (PRESERVES familyAttributeId)
        for (const attr of toUpdate) {
          // console.log(`[Family Update] Updating FamilyAttribute ID ${attr.familyAttributeId} (attributeId: ${attr.attributeId})`);
          await tx.familyAttribute.update({
            where: { 
              familyId_attributeId: {
                familyId: id,
                attributeId: attr.attributeId,
              },
            },
            data: {
              isRequired: attr.isRequired,
              additionalValue: attr.additionalValue,
            },
          });
        }

        // 3. Create new FamilyAttribute rows
        for (const attr of toCreate) {
          // console.log(`[Family Update] Creating new FamilyAttribute for attributeId ${attr.attributeId}`);
          await tx.familyAttribute.create({
            data: {
              familyId: id,
              attributeId: attr.attributeId,
              isRequired: attr.isRequired,
              additionalValue: attr.additionalValue,
            },
          });
        }

        // 3.5. Link existing ProductAttributes to newly created FamilyAttributes
        if (toCreate.length > 0) {
          const newlyCreatedAttributeIds = toCreate.map(attr => attr.attributeId);
          await this.linkProductAttributesToNewFamilyAttributes(id, newlyCreatedAttributeIds, tx);
        }

        // 4. Delete removed FamilyAttribute rows (WARNING: This will cascade delete ProductAttributes!)
        if (toDelete.length > 0) {
          // console.log(`[Family Update] WARNING: Deleting ${toDelete.length} FamilyAttributes, which will CASCADE DELETE related ProductAttributes`);
          
          for (const attr of toDelete) {
            // Check if there are ProductAttributes that will be affected
            const affectedProducts = await tx.productAttribute.count({
              where: { familyAttributeId: attr.familyAttributeId },
            });
            
            if (affectedProducts > 0) {
              // console.log(`[Family Update] WARNING: Deleting FamilyAttribute ${attr.familyAttributeId} (attributeId: ${attr.attributeId}) will delete ${affectedProducts} ProductAttribute values`);
            }
            
            await tx.familyAttribute.delete({
              where: {
                familyId_attributeId: {
                  familyId: id,
                  attributeId: attr.attributeId,
                },
              },
            });
          }
        }

        // console.log(`[Family Update] Transaction completed successfully`);

        // 5. Fetch and return the updated family with all relations
        const updatedFamily = await tx.family.findUnique({
          where: { id },
          include: {
            familyAttributes: {
              include: {
                attribute: true,
              },
            },
          },
        });

        if (!updatedFamily) {
          throw new NotFoundException(`Family with ID ${id} not found`);
        }

        // console.log(`[Family Update] Final FamilyAttributes:`, updatedFamily.familyAttributes.map(fa => ({ id: fa.id, attributeId: fa.attributeId })));

        return updatedFamily;
      });
    } catch (error) {
      console.error(`[Family Update] Error during update:`, error);
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

  /**
   * Helper: Link existing custom ProductAttribute records to newly created FamilyAttribute records
   * This is called when a family is updated to add new attributes.
   * It finds all products using this family and links their existing custom attributes
   * to the corresponding FamilyAttribute records.
   */
  private async linkProductAttributesToNewFamilyAttributes(
    familyId: number,
    newlyCreatedAttributeIds: number[],
    tx: any
  ): Promise<void> {
    if (newlyCreatedAttributeIds.length === 0) {
      return;
    }

    // Get all products that use this family
    const productsWithFamily = await tx.product.findMany({
      where: { familyId },
      select: { id: true },
    });

    if (productsWithFamily.length === 0) {
      return;
    }

    const productIds = productsWithFamily.map(p => p.id);

    // Get the newly created FamilyAttributes for mapping
    const newFamilyAttributes = await tx.familyAttribute.findMany({
      where: {
        familyId,
        attributeId: { in: newlyCreatedAttributeIds },
      },
      select: {
        id: true,
        attributeId: true,
      },
    });

    // Create a map of attributeId -> familyAttributeId
    const attributeToFamilyMap = new Map(
      newFamilyAttributes.map(fa => [fa.attributeId, fa.id])
    );

    // Find existing ProductAttribute records that need to be linked
    const existingProductAttributes = await tx.productAttribute.findMany({
      where: {
        productId: { in: productIds },
        attributeId: { in: newlyCreatedAttributeIds },
        familyAttributeId: null, // Only link attributes that aren't already linked
      },
    });

    if (existingProductAttributes.length === 0) {
      return;
    }

    // Update each ProductAttribute to link it to the corresponding FamilyAttribute
    const updatePromises = existingProductAttributes.map(pa => {
      const familyAttributeId = attributeToFamilyMap.get(pa.attributeId);
      return tx.productAttribute.update({
        where: {
          productId_attributeId: {
            productId: pa.productId,
            attributeId: pa.attributeId,
          },
        },
        data: {
          familyAttributeId,
        },
      });
    });

    await Promise.all(updatePromises);

    console.log(
      `[Family Update] Linked ${existingProductAttributes.length} existing ProductAttributes to family ${familyId}`
    );
  }
}
