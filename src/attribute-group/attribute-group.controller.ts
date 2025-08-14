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
  Query,
} from '@nestjs/common';
import { AttributeGroupService } from './attribute-group.service';
import { CreateAttributeGroupDto } from './dto/create-attribute-group.dto';
import { UpdateAttributeGroupDto } from './dto/update-attribute-group.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../auth/decorators/user.decorator';
import { PaginatedResponse } from '../common';

@Controller('attribute-groups')
@UseGuards(JwtAuthGuard)
export class AttributeGroupController {
  constructor(private readonly attributeGroupService: AttributeGroupService) {}

  @Post()
  create(@Body() createAttributeGroupDto: CreateAttributeGroupDto, @User() user: any) {
    return this.attributeGroupService.create(createAttributeGroupDto, user.id);
  }

  @Get()
  findAll(
    @User() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    
    return this.attributeGroupService.findAll(user.id, pageNum, limitNum);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.attributeGroupService.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAttributeGroupDto: UpdateAttributeGroupDto,
    @User() user: any,
  ) {
    return this.attributeGroupService.update(id, updateAttributeGroupDto, user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.attributeGroupService.remove(id, user.id);
  }

  @Post(':id/attributes/:attributeId')
  addAttributeToGroup(
    @Param('id', ParseIntPipe) id: number,
    @Param('attributeId', ParseIntPipe) attributeId: number,
    @Body() body: { required?: boolean; defaultValue?: any },
    @User() user: any,
  ) {
    return this.attributeGroupService.addAttributeToGroup(
      id,
      attributeId,
      user.id,
      body.required,
      body.defaultValue,
    );
  }

  @Delete(':id/attributes/:attributeId')
  removeAttributeFromGroup(
    @Param('id', ParseIntPipe) id: number,
    @Param('attributeId', ParseIntPipe) attributeId: number,
    @User() user: any,
  ) {
    return this.attributeGroupService.removeAttributeFromGroup(id, attributeId, user.id);
  }
}
