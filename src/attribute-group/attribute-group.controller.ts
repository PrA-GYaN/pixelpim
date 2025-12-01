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
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { User } from '../auth/decorators/user.decorator';
import { EffectiveUserId } from '../auth/decorators/effective-user-id.decorator';
import { PaginatedResponse } from '../common';

@Controller('attribute-groups')
@UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
export class AttributeGroupController {
  constructor(private readonly attributeGroupService: AttributeGroupService) {}

  @Post()
  @RequirePermissions({ resource: 'attribute-groups', action: 'create' })
  create(
    @Body() createAttributeGroupDto: CreateAttributeGroupDto,
    @User() user: any,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.attributeGroupService.create(createAttributeGroupDto, effectiveUserId);
  }

  @Get()
  @RequirePermissions({ resource: 'attribute-groups', action: 'read' })
  findAll(
    @User() user: any,
    @EffectiveUserId() effectiveUserId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    
    return this.attributeGroupService.findAll(effectiveUserId, pageNum, limitNum);
  }

  @Get(':id')
  @RequirePermissions({ resource: 'attribute-groups', action: 'read' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @User() user: any,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.attributeGroupService.findOne(id, effectiveUserId);
  }

  @Patch(':id')
  @RequirePermissions({ resource: 'attribute-groups', action: 'update' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAttributeGroupDto: UpdateAttributeGroupDto,
    @User() user: any,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.attributeGroupService.update(id, updateAttributeGroupDto, effectiveUserId);
  }

  @Delete(':id')
  @RequirePermissions({ resource: 'attribute-groups', action: 'delete' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @User() user: any,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.attributeGroupService.remove(id, effectiveUserId);
  }

  @Post(':id/attributes/:attributeId')
  @RequirePermissions({ resource: 'attribute-groups', action: 'update' })
  addAttributeToGroup(
    @Param('id', ParseIntPipe) id: number,
    @Param('attributeId', ParseIntPipe) attributeId: number,
    @Body() body: { required?: boolean; defaultValue?: any },
    @User() user: any,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.attributeGroupService.addAttributeToGroup(
      id,
      attributeId,
      effectiveUserId,
      body.required,
      body.defaultValue,
    );
  }

  @Delete(':id/attributes/:attributeId')
  @RequirePermissions({ resource: 'attribute-groups', action: 'update' })
  removeAttributeFromGroup(
    @Param('id', ParseIntPipe) id: number,
    @Param('attributeId', ParseIntPipe) attributeId: number,
    @User() user: any,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.attributeGroupService.removeAttributeFromGroup(id, attributeId, effectiveUserId);
  }
}
