import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttributeGroupDto } from './dto/create-attribute-group.dto';
import { UpdateAttributeGroupDto } from './dto/update-attribute-group.dto';
import { PaginatedResponse, PaginationUtils } from '../common';

@Injectable()
export class AttributeGroupService {
  constructor(private prisma: PrismaService) {}

  async create(createAttributeGroupDto: CreateAttributeGroupDto, userId: number) {
    const { attributes, ...groupData } = createAttributeGroupDto;

    // Validate that all attributes exist and belong to the user
    const attributeIds = attributes.map(attr => attr.attributeId);
    const existingAttributes = await this.prisma.attribute.findMany({
      where: { 
        id: { in: attributeIds },
        userId: userId // Only user's own attributes
      },
    });

    if (existingAttributes.length !== attributeIds.length) {
      const foundIds = existingAttributes.map(attr => attr.id);
      const missingIds = attributeIds.filter(id => !foundIds.includes(id));
      throw new BadRequestException(`Attributes with IDs ${missingIds.join(', ')} not found or not accessible`);
    }

    try {
      const result = await this.prisma.attributeGroup.create({
        data: {
          ...groupData,
          userId,
          attributes: {
            create: attributes.map(attr => ({
              attributeId: attr.attributeId,
              required: attr.required ?? false,
              defaultValue: attr.defaultValue,
            })),
          },
        },
        select: {
          id: true,
          name: true,
          description: true,
          userId: true,
          attributes: {
            select: {
              id: true,
              attribute: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  userId: true,
                },
              },
            },
          },
        },
      });
      return result;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Attribute group with this name already exists');
      }
      throw error;
    }
  }

  async findAll(userId: number, page: number = 1, limit: number = 10) {
    const whereCondition = { userId };
    const paginationOptions = PaginationUtils.createPrismaOptions(page, limit);

    const [attributeGroups, total] = await Promise.all([
      this.prisma.attributeGroup.findMany({
        where: whereCondition,
        ...paginationOptions,
        select: {
          id: true,
          name: true,
          description: true,
          userId: true,
          attributes: {
            select: {
              id: true,
              attribute: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  userId: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.attributeGroup.count({ where: whereCondition }),
    ]);

    return PaginationUtils.createPaginatedResponse(attributeGroups, total, page, limit);
  }

  async findOne(id: number, userId: number) {
    const attributeGroup = await this.prisma.attributeGroup.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        userId: true,
        attributes: {
          select: {
            id: true,
            attribute: {
              select: {
                id: true,
                name: true,
                type: true,
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!attributeGroup) {
      throw new NotFoundException(`Attribute group with ID ${id} not found`);
    }

    if (attributeGroup.userId !== userId) {
      throw new ForbiddenException('You can only access your own attribute groups');
    }

    return attributeGroup;
  }

  async update(id: number, updateAttributeGroupDto: UpdateAttributeGroupDto, userId: number) {
    await this.findOne(id, userId); // Check if exists and user owns it

    const { attributes, ...groupData } = updateAttributeGroupDto;

    if (attributes) {
      // Validate that all attributes exist and belong to the user
      const attributeIds = attributes.map(attr => attr.attributeId);
      const existingAttributes = await this.prisma.attribute.findMany({
        where: { 
          id: { in: attributeIds },
          userId: userId // Only user's own attributes
        },
      });

      if (existingAttributes.length !== attributeIds.length) {
        const foundIds = existingAttributes.map(attr => attr.id);
        const missingIds = attributeIds.filter(id => !foundIds.includes(id));
        throw new BadRequestException(`Attributes with IDs ${missingIds.join(', ')} not found or not accessible`);
      }

      // Delete existing attribute relationships and create new ones
      await this.prisma.attributeGroupAttribute.deleteMany({
        where: { attributeGroupId: id },
      });
    }

    try {
      return await this.prisma.attributeGroup.update({
        where: { id },
        data: {
          ...groupData,
          ...(attributes && {
            attributes: {
              create: attributes.map(attr => ({
                attributeId: attr.attributeId,
                required: attr.required ?? false,
                defaultValue: attr.defaultValue,
              })),
            },
          }),
        },
        select: {
          id: true,
          name: true,
          description: true,
          userId: true,
          attributes: {
            select: {
              id: true,
              attribute: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  userId: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Attribute group with this name already exists');
      }
      throw error;
    }
  }

  async remove(id: number, userId: number) {
    await this.findOne(id, userId); // Check if exists and user owns it

    await this.prisma.attributeGroup.delete({
      where: { id },
    });

    return { message: `Attribute group with ID ${id} has been deleted` };
  }

  async addAttributeToGroup(groupId: number, attributeId: number, userId: number, required: boolean = false, defaultValue?: any) {
    // Check if group exists and user owns it
    await this.findOne(groupId, userId);

    // Check if attribute exists and user owns it
    const attribute = await this.prisma.attribute.findUnique({
      where: { id: attributeId },
    });

    if (!attribute) {
      throw new NotFoundException(`Attribute with ID ${attributeId} not found`);
    }

    if (attribute.userId !== userId) {
      throw new ForbiddenException('You can only use your own attributes');
    }

    // Check if attribute is already in the group
    const existing = await this.prisma.attributeGroupAttribute.findUnique({
      where: {
        attributeId_attributeGroupId: {
          attributeId,
          attributeGroupId: groupId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Attribute is already in this group');
    }

    return await this.prisma.attributeGroupAttribute.create({
      data: {
        attributeId,
        attributeGroupId: groupId,
        required,
        defaultValue,
      },
      select: {
        id: true,
        attribute: {
          select: {
            id: true,
            name: true,
            type: true,
            userId: true,
          },
        },
      },
    });
  }

  async removeAttributeFromGroup(groupId: number, attributeId: number, userId: number) {
    // Check if group exists and user owns it
    await this.findOne(groupId, userId);

    const attributeGroupAttribute = await this.prisma.attributeGroupAttribute.findUnique({
      where: {
        attributeId_attributeGroupId: {
          attributeId,
          attributeGroupId: groupId,
        },
      },
    });

    if (!attributeGroupAttribute) {
      throw new NotFoundException('Attribute not found in this group');
    }

    await this.prisma.attributeGroupAttribute.delete({
      where: {
        attributeId_attributeGroupId: {
          attributeId,
          attributeGroupId: groupId,
        },
      },
    });

    return { message: 'Attribute removed from group successfully' };
  }
}
