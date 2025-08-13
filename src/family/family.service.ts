import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { UpdateFamilyDto } from './dto/update-family.dto';
import { AttributeValueValidator } from '../attribute/validators/attribute-value.validator';
import { AttributeType } from '../types/attribute-type.enum';
import type { Family } from '../../generated/prisma';

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
                isRequired: attr.isRequired ?? true,
                additionalValue: attr.additionalValue !== undefined ? String(attr.additionalValue) : null,
              })),
              ...otherAttributes.map(attr => ({
                attributeId: attr.attributeId,
                isRequired: attr.isRequired ?? false,
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

  async findAll(userId: number): Promise<any[]> {
    const families = await this.prisma.family.findMany({
      where: { userId },
      include: {
        familyAttributes: {
          include: {
            attribute: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return families.map(family => ({
      id: family.id,
      name: family.name,
      userId: family.userId,
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
  }

  async findOne(id: number, userId: number): Promise<any> {
    const family = await this.prisma.family.findUnique({
      where: { id },
      include: {
        familyAttributes: {
          include: {
            attribute: true,
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
                  isRequired: attr.isRequired ?? true,
                  additionalValue: attr.additionalValue !== undefined ? String(attr.additionalValue) : null,
                })),
                ...otherAttributes.map(attr => ({
                  attributeId: attr.attributeId,
                  isRequired: attr.isRequired ?? false,
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
