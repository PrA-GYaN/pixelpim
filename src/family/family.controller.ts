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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../auth/decorators/user.decorator';
import { PaginatedResponse } from '../common';

@Controller('families')
@UseGuards(JwtAuthGuard)
export class FamilyController {
  constructor(private readonly familyService: FamilyService) {}

  @Post()
  create(@Body() createFamilyDto: CreateFamilyDto, @User() user: any) {
    return this.familyService.create(createFamilyDto, user.id);
  }

  @Get()
  findAll(
    @User() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedResponse<FamilyResponseDto>> {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    
    return this.familyService.findAll(user.id, pageNum, limitNum);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @User() user: any): Promise<FamilyResponseDto> {
    return this.familyService.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateFamilyDto: UpdateFamilyDto,
    @User() user: any,
  ) {
    return this.familyService.update(id, updateFamilyDto, user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @User() user: any) {
    return this.familyService.remove(id, user.id);
  }

  @Post(':id/attributes/:attributeId')
  addAttribute(
    @Param('id', ParseIntPipe) familyId: number,
    @Param('attributeId', ParseIntPipe) attributeId: number,
    @Query('isRequired') isRequired: string = 'false',
    @Query('additionalValue') additionalValue: string,
    @User() user: any,
  ) {
    return this.familyService.addAttribute(
      familyId,
      attributeId,
      isRequired === 'true',
      additionalValue,
      user.id,
    );
  }

  @Delete(':id/attributes/:attributeId')
  removeAttribute(
    @Param('id', ParseIntPipe) familyId: number,
    @Param('attributeId', ParseIntPipe) attributeId: number,
    @User() user: any,
  ) {
    return this.familyService.removeAttribute(familyId, attributeId, user.id);
  }
}
