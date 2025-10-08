import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
// import * as multer from 'multer';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configure multer for file uploads
  // app.use(multer({ dest: './uploads/temp' }).any());
  
  // Enable validation pipes globally
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Enable CORS
  app.enableCors();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
