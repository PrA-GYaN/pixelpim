import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class ApiKeyService {
  constructor(private prisma: PrismaService) {}

  async generateKeys(userId: number) {
    const apiKey = `pk_${randomBytes(32).toString('hex')}`;
    const secretKey = `sk_${randomBytes(32).toString('hex')}`;

    await this.prisma.user.update({
      where: { id: userId },
      data: { apiKey, secretKey },
    });

    return { apiKey, secretKey };
  }

  async getKeys(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { apiKey: true, secretKey: true },
    });

    return user;
  }

  async regenerateKeys(userId: number) {
    return this.generateKeys(userId);
  }
}