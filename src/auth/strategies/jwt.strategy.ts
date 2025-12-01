import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    });
  }

  async validate(payload: any) {
    const user = await this.authService.validateUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    
    // Calculate effective user ID for data isolation
    // ADMIN: null (can access all data)
    // OWNER: their own ID
    // STAFF: their owner's ID
    let effectiveUserId: number | null = null;
    if (user.role === 'OWNER') {
      effectiveUserId = user.id;
    } else if (user.role === 'STAFF') {
      effectiveUserId = user.ownerId;
    }
    // ADMIN gets null, which means unrestricted access
    
    return {
      id: user.id,
      email: user.email,
      fullname: user.fullname,
      role: user.role,
      ownerId: user.ownerId,
      createdAt: user.createdAt,
      effectiveUserId, // Add effective user ID directly to user object
    };
  }
}
