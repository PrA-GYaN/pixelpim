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
} from '@nestjs/common';
import { AttributeService } from './attribute.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../auth/decorators/user.decorator';

@Controller('attributes')
@UseGuards(JwtAuthGuard)
export class AttributeController {
  private readonly logger = new Logger(AttributeController.name);

  constructor(private readonly attributeService: AttributeService) {}

  @Post()
  async create(@Body() createAttributeDto: CreateAttributeDto, @User() user: any) {
    try {
      this.logger.log(`Creating attribute: ${JSON.stringify(createAttributeDto)} for user: ${user.id}`);
      
      // Basic pre-validation (the service will handle detailed validation and conversion)
      this.validateBasicInput(createAttributeDto);
      
      return await this.attributeService.create(createAttributeDto, user.id);
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
  async findAll(@User() user: any) {
    try {
      return await this.attributeService.findAll(user.id);
    } catch (error) {
      return this.handleError(error, 'fetching');
    }
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    try {
      return await this.attributeService.findOne(id, user.id);
    } catch (error) {
      return this.handleError(error, 'fetching');
    }
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAttributeDto: UpdateAttributeDto,
    @User() user: any,
  ) {
    try {
      this.logger.log(`Updating attribute ${id}: ${JSON.stringify(updateAttributeDto)} for user: ${user.id}`);
      
      return await this.attributeService.update(id, updateAttributeDto, user.id);
    } catch (error) {
      return this.handleError(error, 'updating');
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    try {
      return await this.attributeService.remove(id, user.id);
    } catch (error) {
      return this.handleError(error, 'deleting');
    }
  }
}
