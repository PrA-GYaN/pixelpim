import { Controller, Post, Body, UseGuards, Get, Param, Delete, ParseIntPipe, Query, Patch } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { User } from './decorators/user.decorator';
import { UserManagementService } from './user-management.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { BulkAssignPermissionsDto } from './dto/bulk-assign-permissions.dto';
import { Role } from '@prisma/client';

@Controller('owner')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OwnerController {
  constructor(private userManagementService: UserManagementService) {}

  @Post('create-staff')
  @Roles(Role.OWNER)
  async createStaff(@Body() createStaffDto: CreateStaffDto, @User() user: any) {
    return this.userManagementService.createStaff(createStaffDto, user.id);
  }

  @Post('staff/:staffId/permissions')
  @Roles(Role.OWNER)
  async assignPermission(
    @Param('staffId', ParseIntPipe) staffId: number,
    @Body() assignPermissionDto: AssignPermissionDto,
    @User() user: any,
  ) {
    return this.userManagementService.assignPermission(staffId, assignPermissionDto, user.id);
  }

  @Post('staff/:staffId/permissions/bulk')
  @Roles(Role.OWNER)
  async bulkAssignPermissions(
    @Param('staffId', ParseIntPipe) staffId: number,
    @Body() bulkAssignDto: BulkAssignPermissionsDto,
    @User() user: any,
  ) {
    return this.userManagementService.bulkAssignPermissions(staffId, bulkAssignDto, user.id);
  }

  @Get('staff/:staffId/permissions')
  @Roles(Role.OWNER, Role.ADMIN, Role.STAFF)
  async getStaffPermissions(
    @Param('staffId', ParseIntPipe) staffId: number,
    @User() user: any,
  ) {
    return this.userManagementService.getStaffPermissions(staffId, user.id, user.role);
  }

  @Get('my-staff')
  @Roles(Role.OWNER)
  async getMyStaff(@User() user: any) {
    return this.userManagementService.getMyStaff(user.id);
  }

  @Delete('staff/:staffId/permissions')
  @Roles(Role.OWNER)
  async removePermission(
    @Param('staffId', ParseIntPipe) staffId: number,
    @Query('resource') resource: string,
    @Query('action') action: string,
    @User() user: any,
  ) {
    return this.userManagementService.removePermission(staffId, resource, action, user.id);
  }

  @Patch('staff/:staffId')
  @Roles(Role.OWNER)
  async updateStaff(
    @Param('staffId', ParseIntPipe) staffId: number,
    @Body() updateData: Partial<CreateStaffDto>,
    @User() user: any,
  ) {
    return this.userManagementService.updateStaff(staffId, updateData, user.id);
  }

  @Delete('staff/:staffId')
  @Roles(Role.OWNER)
  async deleteStaff(@Param('staffId', ParseIntPipe) staffId: number, @User() user: any) {
    return this.userManagementService.deleteStaff(staffId, user.id);
  }
}
