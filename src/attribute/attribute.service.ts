import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import type { Attribute } from '../../generated/prisma';

@Injectable()
export class AttributeService {
  constructor(private prisma: PrismaService) {}

  async create(createAttributeDto: CreateAttributeDto, userId: number): Promise<Attribute> {
    try {
      return await this.prisma.attribute.create({
        data: {
          name: createAttributeDto.name,
          type: createAttributeDto.type,
          defaultValue: createAttributeDto.defaultValue,
          userId,
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Attribute with this name already exists');
      }
      throw error;
    }
  }

  async findAll(userId: number): Promise<Attribute[]> {
    return await this.prisma.attribute.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number, userId: number): Promise<Attribute> {
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
  }

  async update(id: number, updateAttributeDto: UpdateAttributeDto, userId: number): Promise<Attribute> {
    await this.findOne(id, userId); // Check if exists and user owns it

    try {
      return await this.prisma.attribute.update({
        where: { id },
        data: {
          ...(updateAttributeDto.name && { name: updateAttributeDto.name }),
          ...(updateAttributeDto.type && { type: updateAttributeDto.type }),
          ...(updateAttributeDto.defaultValue !== undefined && { defaultValue: updateAttributeDto.defaultValue }),
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Attribute with this name already exists');
      }
      throw error;
    }
  }

  async remove(id: number, userId: number): Promise<{ message: string }> {
    await this.findOne(id, userId); // Check if exists and user owns it

    await this.prisma.attribute.delete({
      where: { id },
    });

    return { message: `Attribute with ID ${id} has been deleted` };
  }
}
