import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AttributeModule } from './attribute/attribute.module';
import { AttributeGroupModule } from './attribute-group/attribute-group.module';
import { FamilyModule } from './family/family.module';
import { CategoryModule } from './category/category.module';
import { ProductModule } from './product/product.module';
import { AssetModule } from './asset/asset.module';
import { AssetGroupModule } from './asset-group/asset-group.module';
import { NotificationModule } from './notification/notification.module';
import { SupportModule } from './support/support.module';
import { IntegrationModule } from './integration/integration.module';
import { ApiKeyModule } from './api-key/api-key.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // ServeStaticModule.forRoot({
    //   rootPath: path.join(process.cwd(), 'uploads'),
    //   serveRoot: '/uploads',
    // }),
    PrismaModule, 
    AuthModule, 
    AttributeModule, 
    AttributeGroupModule, 
    FamilyModule, 
    CategoryModule, 
    ProductModule,
    AssetModule,
    AssetGroupModule,
    NotificationModule,
    SupportModule,
    IntegrationModule,
    ApiKeyModule,
    WebhookModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
