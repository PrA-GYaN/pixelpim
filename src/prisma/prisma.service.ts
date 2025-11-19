import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma';
import { productAttributeStatusExtension } from '../middleware/statusTrigger';
import { softDeleteMiddleware } from '../middleware/softDeleteMiddleware';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    // Apply extensions
    Object.assign(this, this.$extends(productAttributeStatusExtension));
    
    // Apply soft-delete middleware
    this.$use(softDeleteMiddleware);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}