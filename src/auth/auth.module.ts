import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AdminController } from './admin.controller';
import { OwnerController } from './owner.controller';
import { EmailService } from './email.service';
import { UserManagementService } from './user-management.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { OwnershipGuard } from './guards/ownership.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [AuthController, AdminController, OwnerController],
  providers: [
    AuthService, 
    EmailService, 
    UserManagementService,
    JwtStrategy, 
    GoogleStrategy,
    RolesGuard,
    PermissionsGuard,
    OwnershipGuard,
  ],
  exports: [AuthService, RolesGuard, PermissionsGuard, OwnershipGuard],
})
export class AuthModule {}
