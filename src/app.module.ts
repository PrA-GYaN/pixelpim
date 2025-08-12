import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AttributeModule } from './attribute/attribute.module';
import { AttributeGroupModule } from './attribute-group/attribute-group.module';
import { FamilyModule } from './family/family.module';

@Module({
  imports: [PrismaModule, AuthModule, AttributeModule, AttributeGroupModule, FamilyModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
