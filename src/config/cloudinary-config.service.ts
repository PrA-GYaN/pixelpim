import { Injectable, OnModuleInit } from '@nestjs/common';
import { CloudinaryUtil } from '../utils/cloudinary.util';

@Injectable()
export class CloudinaryConfigService implements OnModuleInit {
  onModuleInit() {
    try {
      // Configure Cloudinary when the module initializes
      CloudinaryUtil.configureFromEnv();
      console.log('Cloudinary configured successfully');
    } catch (error) {
      console.error('Failed to configure Cloudinary:', error.message);
      // Don't throw here to prevent app from crashing
      // The error will be thrown when actually trying to use Cloudinary
    }
  }
}
