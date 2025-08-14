import { BadRequestException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

export interface CloudinaryUploadResult {
  public_id: string;
  version: number;
  signature: string;
  width?: number;
  height?: number;
  format: string;
  resource_type: string;
  created_at: string;
  tags?: string[];
  bytes: number;
  type: string;
  etag: string;
  placeholder?: boolean;
  url: string;
  secure_url: string;
  access_mode?: string;
  original_filename?: string;
}

export interface CloudinaryConfig {
  cloud_name: string;
  api_key: string;
  api_secret: string;
  secure?: boolean;
}

export interface CloudinaryUploadOptions {
  folder?: string;
  public_id?: string;
  resource_type?: 'image' | 'video' | 'raw' | 'auto';
  allowed_formats?: string[];
  max_file_size?: number; // in bytes
  quality?: string | number;
  transformation?: any[];
  tags?: string[];
}

export class CloudinaryUtil {
  private static isConfigured = false;

  /**
   * Configure Cloudinary with credentials
   */
  static configure(config: CloudinaryConfig): void {
    cloudinary.config({
      cloud_name: config.cloud_name,
      api_key: config.api_key,
      api_secret: config.api_secret,
      secure: config.secure ?? true,
    });
    this.isConfigured = true;
  }

  /**
   * Configure Cloudinary from environment variables
   */
  static configureFromEnv(): void {
    const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
    const api_key = process.env.CLOUDINARY_API_KEY;
    const api_secret = process.env.CLOUDINARY_API_SECRET;

    if (!cloud_name || !api_key || !api_secret) {
      console.error('Cloudinary environment variables:', {
        CLOUDINARY_CLOUD_NAME: !!cloud_name,
        CLOUDINARY_API_KEY: !!api_key,
        CLOUDINARY_API_SECRET: !!api_secret,
      });
      throw new Error(
        'Cloudinary configuration missing. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.',
      );
    }

    this.configure({
      cloud_name,
      api_key,
      api_secret,
    });
  }

  /**
   * Ensure Cloudinary is configured before use
   */
  private static ensureConfigured(): void {
    if (!this.isConfigured) {
      this.configureFromEnv();
    }
  }

  /**
   * Upload file buffer to Cloudinary
   */
  static async uploadBuffer(
    buffer: Buffer,
    originalName: string,
    options: CloudinaryUploadOptions = {},
  ): Promise<CloudinaryUploadResult> {
    this.ensureConfigured();

    return new Promise((resolve, reject) => {
      const uploadOptions: any = {
        resource_type: options.resource_type || 'auto',
        folder: options.folder || 'assets',
        public_id: options.public_id,
        allowed_formats: options.allowed_formats,
        max_file_size: options.max_file_size,
        quality: options.quality,
        transformation: options.transformation,
        tags: options.tags,
        use_filename: true,
        unique_filename: true,
        filename_override: originalName,
      };

      // Remove undefined values
      Object.keys(uploadOptions).forEach(
        (key) => uploadOptions[key] === undefined && delete uploadOptions[key],
      );

      const stream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            reject(new BadRequestException(`Upload failed: ${error.message}`));
          } else if (result) {
            resolve(result as CloudinaryUploadResult);
          } else {
            reject(new BadRequestException('Upload failed: No result returned'));
          }
        },
      );

      // Convert buffer to stream and pipe to Cloudinary
      const bufferStream = new Readable();
      bufferStream.push(buffer);
      bufferStream.push(null);
      bufferStream.pipe(stream);
    });
  }

  /**
   * Upload file from multer to Cloudinary
   */
  static async uploadFile(
    file: Express.Multer.File,
    options: CloudinaryUploadOptions = {},
  ): Promise<CloudinaryUploadResult> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file if options provided
    if (options.max_file_size && file.size > options.max_file_size) {
      throw new BadRequestException(`File size exceeds limit of ${options.max_file_size} bytes`);
    }

    if (options.allowed_formats) {
      const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
      if (!fileExtension || !options.allowed_formats.includes(fileExtension)) {
        throw new BadRequestException(
          `Invalid file format. Allowed formats: ${options.allowed_formats.join(', ')}`,
        );
      }
    }

    return this.uploadBuffer(file.buffer, file.originalname, options);
  }

  /**
   * Delete file from Cloudinary
   */
  static async deleteFile(public_id: string, resource_type: string = 'image'): Promise<any> {
    this.ensureConfigured();

    try {
      const result = await cloudinary.uploader.destroy(public_id, {
        resource_type,
      });
      return result;
    } catch (error) {
      console.error('Error deleting file from Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Get optimized URL for an image
   */
  static getOptimizedUrl(
    public_id: string,
    options: {
      width?: number;
      height?: number;
      crop?: string;
      quality?: string | number;
      format?: string;
    } = {},
  ): string {
    this.ensureConfigured();

    return cloudinary.url(public_id, {
      width: options.width,
      height: options.height,
      crop: options.crop || 'limit',
      quality: options.quality || 'auto',
      format: options.format || 'auto',
      fetch_format: 'auto',
      secure: true,
    });
  }

  /**
   * Generate thumbnail URL
   */
  static getThumbnailUrl(
    public_id: string,
    width: number = 300,
    height: number = 300,
  ): string {
    return this.getOptimizedUrl(public_id, {
      width,
      height,
      crop: 'fill',
      quality: 'auto',
    });
  }

  /**
   * Get file info from Cloudinary
   */
  static async getFileInfo(public_id: string): Promise<any> {
    this.ensureConfigured();

    try {
      const result = await cloudinary.api.resource(public_id, {
        resource_type: 'auto',
      });
      return result;
    } catch (error) {
      console.error('Error getting file info from Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Get predefined upload options for different asset types
   */
  static getImageUploadOptions(): CloudinaryUploadOptions {
    return {
      folder: 'pixelpim/images',
      resource_type: 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      max_file_size: 10 * 1024 * 1024, // 10MB
      quality: 'auto',
      tags: ['image', 'pixelpim'],
    };
  }

  static getDocumentUploadOptions(): CloudinaryUploadOptions {
    return {
      folder: 'pixelpim/documents',
      resource_type: 'raw',
      allowed_formats: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'],
      max_file_size: 20 * 1024 * 1024, // 20MB
      tags: ['document', 'pixelpim'],
    };
  }

  static getVideoUploadOptions(): CloudinaryUploadOptions {
    return {
      folder: 'pixelpim/videos',
      resource_type: 'video',
      allowed_formats: ['mp4', 'webm', 'ogg', 'mov', 'avi'],
      max_file_size: 100 * 1024 * 1024, // 100MB
      quality: 'auto',
      tags: ['video', 'pixelpim'],
    };
  }

  static getAssetUploadOptions(): CloudinaryUploadOptions {
    return {
      folder: 'pixelpim/assets',
      resource_type: 'auto',
      max_file_size: 50 * 1024 * 1024, // 50MB
      quality: 'auto',
      tags: ['asset', 'pixelpim'],
    };
  }

  /**
   * Format file size in human readable format
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Extract public_id from Cloudinary URL
   */
  static extractPublicIdFromUrl(url: string): string {
    const matches = url.match(/\/v\d+\/(.+)\./);
    return matches ? matches[1] : '';
  }
}
