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
import { FamilyService } from './family.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { UpdateFamilyDto } from './dto/update-family.dto';
import { FamilyResponseDto } from './dto/family-response.dto';
import { FamilyFilterDto } from './dto/family-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { User } from '../auth/decorators/user.decorator';
import { EffectiveUserId } from '../auth/decorators/effective-user-id.decorator';
import { PaginatedResponse } from '../common';

@Controller('families')
@UseGuards(JwtAuthGuard, OwnershipGuard, PermissionsGuard)
export class FamilyController {
  constructor(private readonly familyService: FamilyService) {}

  @Post()
  @RequirePermissions({ resource: 'families', action: 'create' })
  create(
    @Body() createFamilyDto: CreateFamilyDto,
    @User() user: any,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.familyService.create(createFamilyDto, effectiveUserId);
  }

  @Get()
  @RequirePermissions({ resource: 'families', action: 'read' })
  findAll(
    @User() user: any,
    @EffectiveUserId() effectiveUserId: number,
    @Query() filters: FamilyFilterDto,
  ): Promise<PaginatedResponse<FamilyResponseDto>> {
    // If no filters are provided, use the basic findAll method
    if (Object.keys(filters).length === 0 || 
        (Object.keys(filters).length === 2 && filters.page && filters.limit)) {
      const pageNum = filters.page || 1;
      const limitNum = filters.limit || 10;
      return this.familyService.findAll(effectiveUserId, pageNum, limitNum);
    }
    
    // Use the filtered search
    return this.familyService.findAllWithFilters(effectiveUserId, filters);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @User() user: any,
    @EffectiveUserId() effectiveUserId: number,
  ): Promise<FamilyResponseDto> {
    return this.familyService.findOne(id, effectiveUserId);
  }

  @Patch(':id')
  @RequirePermissions({ resource: 'families', action: 'update' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateFamilyDto: UpdateFamilyDto,
    @User() user: any,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.familyService.update(id, updateFamilyDto, effectiveUserId);
  }

  @Delete(':id')
  @RequirePermissions({ resource: 'families', action: 'delete' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @User() user: any,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.familyService.remove(id, effectiveUserId);
  }

  @Post(':id/attributes/:attributeId')
  @RequirePermissions({ resource: 'families', action: 'update' })
  addAttribute(
    @Param('id', ParseIntPipe) familyId: number,
    @Param('attributeId', ParseIntPipe) attributeId: number,
    @Query('isRequired') isRequired: string = 'false',
    @Query('additionalValue') additionalValue: string,
    @User() user: any,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.familyService.addAttribute(
      familyId,
      attributeId,
      isRequired === 'true',
      additionalValue,
      effectiveUserId,
    );
  }

  @Delete(':id/attributes/:attributeId')
  @RequirePermissions({ resource: 'families', action: 'update' })
  removeAttribute(
    @Param('id', ParseIntPipe) familyId: number,
    @Param('attributeId', ParseIntPipe) attributeId: number,
    @User() user: any,
    @EffectiveUserId() effectiveUserId: number,
  ) {
    return this.familyService.removeAttribute(familyId, attributeId, effectiveUserId);
  }
}
