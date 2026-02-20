import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AttributeService } from './attribute.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { AttributeFilterDto, AttributeGroupFilterDto } from './dto/attribute-filter.dto';
import { BulkDeleteAttributeDto } from './dto/bulk-delete-attribute.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { User } from '../auth/decorators/user.decorator';
import { EffectiveUserId } from '../auth/decorators/effective-user-id.decorator';
import { UserAttributeType, getAvailableUserTypes, USER_TO_STORAGE_TYPE_MAP } from '../types/user-attribute-type.enum';
import { PaginatedResponse } from '../common';

@Controller('attributes')
@UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
export class AttributeController {
  private readonly logger = new Logger(AttributeController.name);

  constructor(private readonly attributeService: AttributeService) {}

  @Get('types')
  getAvailableTypes() {
    return {
      userFriendlyTypes: getAvailableUserTypes(),
      typeMapping: USER_TO_STORAGE_TYPE_MAP,
      description: 'Available attribute types for creating attributes. Use the user-friendly types in your frontend.'
    };
  }

  @Post()
  @RequirePermissions({ resource: 'attributes', action: 'create' })
  async create(
    @Body() createAttributeDto: CreateAttributeDto,
    @User() user: any,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    try {
      this.logger.log(`Creating attribute: ${JSON.stringify(createAttributeDto)} for user: ${user.id}`);
      
      // Basic pre-validation (the service will handle detailed validation and conversion)
      this.validateBasicInput(createAttributeDto);
      
      return await this.attributeService.create(createAttributeDto, effectiveUserId);
    } catch (error) {
      return this.handleError(error, 'creating');
    }
  }

  private validateBasicInput(dto: CreateAttributeDto): void {
    if (!dto.name?.trim()) {
      throw new BadRequestException('Attribute name cannot be empty');
    }
    
    if (!dto.type) {
      throw new BadRequestException('Attribute type is required');
    }
  }

  private handleError(error: any, operation: string): never {
    this.logger.error(`Error ${operation} attribute: ${error.message}`, error.stack);
    
    // Handle specific known errors
    if (error.name === 'ValidationError' || error.message.includes('validation')) {
      throw new BadRequestException(`Validation error: ${error.message}`);
    }
    
    // Handle Prisma errors that weren't caught in service
    if (error.code) {
      const prismaErrorMessages = {
        'P2000': 'The provided value is too long for the database field',
        'P2001': 'Record not found',
        'P2002': 'A record with this unique constraint already exists',
        'P2003': 'Foreign key constraint failed',
        'P2004': 'A constraint failed on the database',
        'P2005': 'The value stored in the database is invalid for the field type',
        'P2006': 'The provided value is not valid for this field',
        'P2007': 'Data validation error',
      };
      
      const message = prismaErrorMessages[error.code];
      if (message) {
        throw new BadRequestException(message);
      }
      
      this.logger.error(`Unhandled Prisma error code: ${error.code}`);
      throw new InternalServerErrorException('Database operation failed');
    }
    
    // Re-throw known HTTP exceptions
    if (error.status) {
      throw error;
    }
    
    // Fallback for unknown errors
    throw new InternalServerErrorException(`An unexpected error occurred while ${operation} the attribute`);
  }

  @Get()
  @RequirePermissions({ resource: 'attributes', action: 'read' })
  async findAll(
    @User() user: any,
    @EffectiveUserId() effectiveUserId: number,
    @Query() filters: AttributeFilterDto,
  ) {
    try {
      // If no filters are provided, use the basic findAll method
      if (Object.keys(filters).length === 0 || 
          (Object.keys(filters).length === 2 && filters.page && filters.limit)) {
        const pageNum = filters.page || 1;
        const limitNum = filters.limit || 10;
        return await this.attributeService.findAll(effectiveUserId, pageNum, limitNum);
      }
      
      // Use the filtered search
      return await this.attributeService.findAllWithFilters(effectiveUserId, filters);
    } catch (error) {
      return this.handleError(error, 'fetching');
    }
  }

  @Get('with-product-counts')
  @RequirePermissions({ resource: 'attributes', action: 'read' })
  async findAllWithProductCounts(
    @User() user: any,
    @EffectiveUserId() effectiveUserId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const pageNum = page ? parseInt(page) : 1;
      const limitNum = limit ? parseInt(limit) : 10;
      return await this.attributeService.findAllWithProductCounts(effectiveUserId, pageNum, limitNum);
    } catch (error) {
      return this.handleError(error, 'fetching attributes with product counts');
    }
  }

  @Get('groups')
  @RequirePermissions({ resource: 'attributes', action: 'read' })
  async findAllGroups(
    @User() user: any,
    @EffectiveUserId() effectiveUserId: number,
    @Query() filters: AttributeGroupFilterDto,
  ) {
    try {
      return await this.attributeService.findAllGroupsWithFilters(effectiveUserId, filters);
    } catch (error) {
      return this.handleError(error, 'fetching attribute groups');
    }
  }

  @Get('attribute-suggestions')
  @RequirePermissions({ resource: 'attributes', action: 'update' })
  async getAttributeSuggestions(
    @Query('productId', ParseIntPipe) productId: number,
    @Query('attributeId', ParseIntPipe) attributeId: number,
    @Query('query') query: string,
    @User() user: any,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    try {
      if (!query || query.length < 2) {
        return { suggestions: [] };
      }

      return await this.attributeService.getAttributeSuggestions(productId, attributeId, query, effectiveUserId);
    } catch (error) {
      return this.handleError(error, 'fetching attribute suggestions');
    }
  }

  @Get(':id')
  @RequirePermissions({ resource: 'attributes', action: 'read' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @User() user: any,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    try {
      return await this.attributeService.findOne(id, effectiveUserId);
    } catch (error) {
      return this.handleError(error, 'fetching');
    }
  }

  @Patch(':id')
  @RequirePermissions({ resource: 'attributes', action: 'update' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAttributeDto: UpdateAttributeDto,
    @User() user: any,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    try {
      this.logger.log(`Updating attribute ${id}: ${JSON.stringify(updateAttributeDto)} for user: ${user.id}`);
      
      return await this.attributeService.update(id, updateAttributeDto, effectiveUserId);
    } catch (error) {
      return this.handleError(error, 'updating');
    }
  }

  @Delete(':id')
  @RequirePermissions({ resource: 'attributes', action: 'delete' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @User() user: any,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    try {
      return await this.attributeService.remove(id, effectiveUserId);
    } catch (error) {
      return this.handleError(error, 'deleting');
    }
  }

  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'attributes', action: 'delete' })
  async bulkDelete(
    @Body() bulkDeleteDto: BulkDeleteAttributeDto,
    @User() user: any,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    try {
      this.logger.log(`Bulk deleting attributes for user: ${user.id}`);
      return await this.attributeService.bulkDelete(bulkDeleteDto, effectiveUserId);
    } catch (error) {
      return this.handleError(error, 'bulk deleting');
    }
  }
}
