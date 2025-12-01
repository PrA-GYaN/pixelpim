import { Injectable, ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOwnerDto } from './dto/create-owner.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { BulkAssignPermissionsDto } from './dto/bulk-assign-permissions.dto';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserManagementService {
  constructor(private prisma: PrismaService) {}

  // Admin creates Owner
  async createOwner(createOwnerDto: CreateOwnerDto, adminId: number) {
    const { email, fullname, password } = createOwnerDto;

    // Verify admin exists and has ADMIN role
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== Role.ADMIN) {
      throw new ForbiddenException('Only ADMIN can create OWNER users');
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create owner user
    const owner = await this.prisma.user.create({
      data: {
        email,
        fullname,
        password: hashedPassword,
        role: Role.OWNER,
        ownerId: null, // Owners don't have an ownerId
      },
    });

    return {
      id: owner.id,
      email: owner.email,
      fullname: owner.fullname,
      role: owner.role,
      createdAt: owner.createdAt,
    };
  }

  // Owner creates Staff
  async createStaff(createStaffDto: CreateStaffDto, ownerId: number) {
    const { email, fullname, password } = createStaffDto;

    // Verify owner exists and has OWNER role
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
    });

    if (!owner || owner.role !== Role.OWNER) {
      throw new ForbiddenException('Only OWNER can create STAFF users');
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create staff user
    const staff = await this.prisma.user.create({
      data: {
        email,
        fullname,
        password: hashedPassword,
        role: Role.STAFF,
        ownerId: ownerId, // Link staff to owner
      },
    });

    return {
      id: staff.id,
      email: staff.email,
      fullname: staff.fullname,
      role: staff.role,
      ownerId: staff.ownerId,
      createdAt: staff.createdAt,
    };
  }

  // Owner assigns permission to Staff
  async assignPermission(
    staffId: number,
    assignPermissionDto: AssignPermissionDto,
    ownerId: number,
  ) {
    const { resource, action, granted } = assignPermissionDto;

    // Verify owner
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
    });

    if (!owner || owner.role !== Role.OWNER) {
      throw new ForbiddenException('Only OWNER can assign permissions');
    }

    // Verify staff user exists and belongs to this owner
    const staff = await this.prisma.user.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      throw new NotFoundException('Staff user not found');
    }

    if (staff.role !== Role.STAFF) {
      throw new BadRequestException('Permissions can only be assigned to STAFF users');
    }

    if (staff.ownerId !== ownerId) {
      throw new ForbiddenException('You can only assign permissions to your own staff members');
    }

    // Create or update permission
    const permission = await this.prisma.userPermission.upsert({
      where: {
        userId_resource_action: {
          userId: staffId,
          resource,
          action,
        },
      },
      update: {
        granted: granted ?? true,
      },
      create: {
        userId: staffId,
        resource,
        action,
        granted: granted ?? true,
      },
    });

    return permission;
  }

  // Owner bulk assigns permissions to Staff
  async bulkAssignPermissions(
    staffId: number,
    bulkAssignDto: BulkAssignPermissionsDto,
    ownerId: number,
  ) {
    const { permissions } = bulkAssignDto;

    // Verify owner
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
    });

    if (!owner || owner.role !== Role.OWNER) {
      throw new ForbiddenException('Only OWNER can assign permissions');
    }

    // Verify staff user exists and belongs to this owner
    const staff = await this.prisma.user.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      throw new NotFoundException('Staff user not found');
    }

    if (staff.role !== Role.STAFF) {
      throw new BadRequestException('Permissions can only be assigned to STAFF users');
    }

    if (staff.ownerId !== ownerId) {
      throw new ForbiddenException('You can only assign permissions to your own staff members');
    }

    // Create or update permissions in a transaction
    const updatedPermissions = await this.prisma.$transaction(
      permissions.map((perm) =>
        this.prisma.userPermission.upsert({
          where: {
            userId_resource_action: {
              userId: staffId,
              resource: perm.resource,
              action: perm.action,
            },
          },
          update: {
            granted: perm.granted ?? true,
          },
          create: {
            userId: staffId,
            resource: perm.resource,
            action: perm.action,
            granted: perm.granted ?? true,
          },
        }),
      ),
    );

    return {
      message: 'Permissions assigned successfully',
      permissions: updatedPermissions,
    };
  }

  // Get staff permissions
  async getStaffPermissions(staffId: number, requesterId: number, requesterRole: Role) {
    const staff = await this.prisma.user.findUnique({
      where: { id: staffId },
      include: {
        permissions: true,
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff user not found');
    }

    // ADMIN can view all, OWNER can view their staff, STAFF can view own
    if (requesterRole === Role.ADMIN) {
      return staff.permissions;
    } else if (requesterRole === Role.OWNER) {
      if (staff.ownerId !== requesterId) {
        throw new ForbiddenException('You can only view permissions of your own staff members');
      }
      return staff.permissions;
    } else if (requesterRole === Role.STAFF) {
      if (staff.id !== requesterId) {
        throw new ForbiddenException('You can only view your own permissions');
      }
      return staff.permissions;
    }

    throw new ForbiddenException('Access denied');
  }

  // Get all staff members for an owner
  async getMyStaff(ownerId: number) {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
    });

    if (!owner || owner.role !== Role.OWNER) {
      throw new ForbiddenException('Only OWNER can view their staff members');
    }

    const staffMembers = await this.prisma.user.findMany({
      where: {
        ownerId: ownerId,
        role: Role.STAFF,
      },
      select: {
        id: true,
        email: true,
        fullname: true,
        role: true,
        ownerId: true,
        createdAt: true,
      },
    });

    return staffMembers;
  }

  // Remove permission from staff
  async removePermission(
    staffId: number,
    resource: string,
    action: string,
    ownerId: number,
  ) {
    // Verify owner
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
    });

    if (!owner || owner.role !== Role.OWNER) {
      throw new ForbiddenException('Only OWNER can remove permissions');
    }

    // Verify staff user exists and belongs to this owner
    const staff = await this.prisma.user.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      throw new NotFoundException('Staff user not found');
    }

    if (staff.ownerId !== ownerId) {
      throw new ForbiddenException('You can only manage permissions for your own staff members');
    }

    // Delete the permission
    await this.prisma.userPermission.deleteMany({
      where: {
        userId: staffId,
        resource,
        action,
      },
    });

    return { message: 'Permission removed successfully' };
  }

  // Admin operations for managing owners
  async getAllOwners(adminId: number) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== Role.ADMIN) {
      throw new ForbiddenException('Only ADMIN can view all owners');
    }

    const owners = await this.prisma.user.findMany({
      where: {
        role: Role.OWNER,
      },
      select: {
        id: true,
        email: true,
        fullname: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            staffMembers: true,
            products: true,
            assets: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return owners;
  }

  async getOwnerById(ownerId: number, adminId: number) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== Role.ADMIN) {
      throw new ForbiddenException('Only ADMIN can view owner details');
    }

    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId, role: Role.OWNER },
      select: {
        id: true,
        email: true,
        fullname: true,
        role: true,
        createdAt: true,
        staffMembers: {
          select: {
            id: true,
            email: true,
            fullname: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            products: true,
            assets: true,
            categories: true,
            families: true,
          },
        },
      },
    });

    if (!owner) {
      throw new NotFoundException('Owner not found');
    }

    return owner;
  }

  async updateOwner(ownerId: number, updateData: Partial<CreateOwnerDto>, adminId: number) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== Role.ADMIN) {
      throw new ForbiddenException('Only ADMIN can update owners');
    }

    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId, role: Role.OWNER },
    });

    if (!owner) {
      throw new NotFoundException('Owner not found');
    }

    // Prepare update data
    const dataToUpdate: any = {};
    if (updateData.email) dataToUpdate.email = updateData.email;
    if (updateData.fullname) dataToUpdate.fullname = updateData.fullname;
    if (updateData.password) {
      dataToUpdate.password = await bcrypt.hash(updateData.password, 10);
    }

    const updatedOwner = await this.prisma.user.update({
      where: { id: ownerId },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        fullname: true,
        role: true,
        createdAt: true,
      },
    });

    return updatedOwner;
  }

  async deleteOwner(ownerId: number, adminId: number) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== Role.ADMIN) {
      throw new ForbiddenException('Only ADMIN can delete owners');
    }

    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId, role: Role.OWNER },
    });

    if (!owner) {
      throw new NotFoundException('Owner not found');
    }

    // Delete the owner (cascade will delete staff and all related data)
    await this.prisma.user.delete({
      where: { id: ownerId },
    });

    return { message: 'Owner deleted successfully' };
  }

  // Owner operations for managing staff
  async deleteStaff(staffId: number, ownerId: number) {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
    });

    if (!owner || owner.role !== Role.OWNER) {
      throw new ForbiddenException('Only OWNER can delete staff members');
    }

    const staff = await this.prisma.user.findUnique({
      where: { id: staffId, role: Role.STAFF },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    if (staff.ownerId !== ownerId) {
      throw new ForbiddenException('You can only delete your own staff members');
    }

    await this.prisma.user.delete({
      where: { id: staffId },
    });

    return { message: 'Staff member deleted successfully' };
  }

  async updateStaff(staffId: number, updateData: Partial<CreateStaffDto>, ownerId: number) {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
    });

    if (!owner || owner.role !== Role.OWNER) {
      throw new ForbiddenException('Only OWNER can update staff members');
    }

    const staff = await this.prisma.user.findUnique({
      where: { id: staffId, role: Role.STAFF },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    if (staff.ownerId !== ownerId) {
      throw new ForbiddenException('You can only update your own staff members');
    }

    // Prepare update data
    const dataToUpdate: any = {};
    if (updateData.email) dataToUpdate.email = updateData.email;
    if (updateData.fullname) dataToUpdate.fullname = updateData.fullname;
    if (updateData.password) {
      dataToUpdate.password = await bcrypt.hash(updateData.password, 10);
    }

    const updatedStaff = await this.prisma.user.update({
      where: { id: staffId },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        fullname: true,
        role: true,
        ownerId: true,
        createdAt: true,
      },
    });

    return updatedStaff;
  }
}
