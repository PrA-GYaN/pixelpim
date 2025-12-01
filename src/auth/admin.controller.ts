import { Controller, Post, Body, UseGuards, Get, Delete, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { User } from './decorators/user.decorator';
import { UserManagementService } from './user-management.service';
import { CreateOwnerDto } from './dto/create-owner.dto';
import { Role } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private userManagementService: UserManagementService) {}

  @Post('create-owner')
  @Roles(Role.ADMIN)
  async createOwner(@Body() createOwnerDto: CreateOwnerDto, @User() user: any) {
    return this.userManagementService.createOwner(createOwnerDto, user.id);
  }

  @Get('owners')
  @Roles(Role.ADMIN)
  async getAllOwners(@User() user: any) {
    return this.userManagementService.getAllOwners(user.id);
  }

  @Get('owners/:ownerId')
  @Roles(Role.ADMIN)
  async getOwnerById(@Param('ownerId', ParseIntPipe) ownerId: number, @User() user: any) {
    return this.userManagementService.getOwnerById(ownerId, user.id);
  }

  @Patch('owners/:ownerId')
  @Roles(Role.ADMIN)
  async updateOwner(
    @Param('ownerId', ParseIntPipe) ownerId: number,
    @Body() updateData: Partial<CreateOwnerDto>,
    @User() user: any,
  ) {
    return this.userManagementService.updateOwner(ownerId, updateData, user.id);
  }

  @Delete('owners/:ownerId')
  @Roles(Role.ADMIN)
  async deleteOwner(@Param('ownerId', ParseIntPipe) ownerId: number, @User() user: any) {
    return this.userManagementService.deleteOwner(ownerId, user.id);
  }
}
