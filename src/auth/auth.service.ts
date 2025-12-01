import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async sendOtp(sendOtpDto: SendOtpDto) {
    const { email } = sendOtpDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // Set expiration time (10 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Delete any existing OTPs for this email and type
    await this.prisma.otp.deleteMany({
      where: {
        email,
        type: 'registration',
      },
    });

    // Create new OTP record
    await this.prisma.otp.create({
      data: {
        email,
        code: otp,
        type: 'registration',
        expiresAt,
      },
    });

    // Send OTP email
    await this.emailService.sendOtpEmail(email, otp);

    return {
      message: 'OTP sent successfully to your email',
      email,
    };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { email, otp } = verifyOtpDto;

    // Find the OTP record
    const otpRecord = await this.prisma.otp.findFirst({
      where: {
        email,
        code: otp,
        type: 'registration',
        verified: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpRecord) {
      throw new BadRequestException('Invalid OTP');
    }

    // Check if OTP is expired
    if (new Date() > otpRecord.expiresAt) {
      throw new BadRequestException('OTP has expired');
    }

    // Mark OTP as verified
    await this.prisma.otp.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    });

    return {
      message: 'OTP verified successfully',
      email,
    };
  }

  async signup(signupDto: SignupDto) {
    const { email, fullname, password, otp } = signupDto;

    // First verify that the OTP was verified
    const verifiedOtp = await this.prisma.otp.findFirst({
      where: {
        email,
        code: otp,
        type: 'registration',
        verified: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!verifiedOtp) {
      throw new BadRequestException('Invalid or unverified OTP. Please verify your OTP first.');
    }

    // Check if OTP is expired (even though it's verified, double-check)
    if (new Date() > verifiedOtp.expiresAt) {
      throw new BadRequestException('OTP has expired');
    }

    // Check if user already exists (double-check)
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        fullname,
        password: hashedPassword,
      },
    });

    // Delete the used OTP
    await this.prisma.otp.delete({
      where: { id: verifiedOtp.id },
    });

    // Generate JWT token
    const payload = { 
      sub: user.id, 
      email: user.email,
      role: user.role,
      ownerId: user.ownerId 
    };
    const token = this.jwtService.sign(payload);

    return {
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        fullname: user.fullname,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('User Account does not exist');
    }

    // Check if user is a Google user (no password)
    if (user.provider === 'google' && !user.password) {
      throw new UnauthorizedException('Please use Google login for this account');
    }

    // Check if password exists for local users
    if (!user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    const payload = { 
      sub: user.id, 
      email: user.email,
      role: user.role,
      ownerId: user.ownerId 
    };
    const token = this.jwtService.sign(payload);

    return {
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        fullname: user.fullname,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  async validateUser(userId: number) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullname: true,
        role: true,
        ownerId: true,
        createdAt: true,
      },
    });
  }

  async validateGoogleUser(googleUser: {
    googleId: string;
    email: string;
    fullname: string;
  }) {
    // Check if user already exists by Google ID
    let user = await this.prisma.user.findUnique({
      where: { googleId: googleUser.googleId },
    });

    if (user) {
      return user;
    }

    // Check if user exists by email (for linking accounts)
    user = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    if (user) {
      // Link Google account to existing user
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: googleUser.googleId,
          provider: 'google',
        },
      });
      return user;
    }

    // Create new user with Google account
    user = await this.prisma.user.create({
      data: {
        email: googleUser.email,
        fullname: googleUser.fullname,
        googleId: googleUser.googleId,
        provider: 'google',
      },
    });

    return user;
  }

  async googleLogin(user: any) {
    const payload = { 
      sub: user.id, 
      email: user.email,
      role: user.role,
      ownerId: user.ownerId 
    };
    const token = this.jwtService.sign(payload);

    return {
      message: 'Google login successful',
      user: {
        id: user.id,
        email: user.email,
        fullname: user.fullname,
        provider: user.provider,
        createdAt: user.createdAt,
      },
      token,
    };
  }
}
