import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API key missing');
    }

    const user = await this.prisma.user.findUnique({
      where: { apiKey: apiKey },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid API key');
    }

    request.user = user;
    return true;
  }
}