import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Logger } from '@nestjs/common';

/**
 * Configuration for thumbnail generation
 */
export interface ThumbnailConfig {
  width?: number;
  height?: number;
  quality?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

/**
 * Result of thumbnail generation
 */
export interface ThumbnailResult {
  success: boolean;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  error?: string;
}

/**
 * Utility class for generating image thumbnails
 */
export class ThumbnailUtil {
  private static readonly logger = new Logger(ThumbnailUtil.name);

  // Default thumbnail configuration
  private static readonly DEFAULT_CONFIG: ThumbnailConfig = {
    width: 300,
    quality: 80,
    fit: 'inside', // Maintain aspect ratio
  };

  // Supported image formats for thumbnail generation
  private static readonly SUPPORTED_FORMATS = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
  ];

  /**
   * Check if a file is a supported image type
   */
  static isImageFile(mimeType: string): boolean {
    return this.SUPPORTED_FORMATS.includes(mimeType.toLowerCase());
  }

  /**
   * Generate a thumbnail filename from the original filename
   * Example: image.jpg -> image_thumb.jpg
   */
  static generateThumbnailFilename(originalFilename: string): string {
    const ext = path.extname(originalFilename);
    const basename = path.basename(originalFilename, ext);
    return `${basename}_thumb${ext}`;
  }

  /**
   * Generate thumbnail from a file buffer
   * 
   * @param buffer - Original image buffer
   * @param originalFilename - Original filename (used to determine thumbnail name)
   * @param destinationDir - Directory where thumbnail will be saved
   * @param config - Thumbnail generation options
   * @returns Promise with thumbnail result
   */
  static async generateThumbnail(
    buffer: Buffer,
    originalFilename: string,
    destinationDir: string,
    config: ThumbnailConfig = {}
  ): Promise<ThumbnailResult> {
    try {
      // Merge with default config
      const finalConfig = { ...this.DEFAULT_CONFIG, ...config };

      // Generate thumbnail filename
      const thumbnailFilename = this.generateThumbnailFilename(originalFilename);
      const thumbnailPath = path.join(destinationDir, thumbnailFilename);

      this.logger.log(`Generating thumbnail: ${thumbnailFilename}`);

      // Create Sharp instance
      const sharpInstance = sharp(buffer);

      // Get image metadata to check validity
      const metadata = await sharpInstance.metadata();
      
      if (!metadata.width || !metadata.height) {
        throw new Error('Invalid image: Unable to read dimensions');
      }

      this.logger.log(`Original image dimensions: ${metadata.width}x${metadata.height}`);

      // Resize options
      const resizeOptions: any = {
        width: finalConfig.width,
        height: finalConfig.height,
        fit: finalConfig.fit,
        withoutEnlargement: true, // Don't enlarge if image is smaller
      };

      // Prepare Sharp instance with resize
      let processedImage = sharpInstance.resize(resizeOptions);

      // Optimize based on format
      const format = metadata.format?.toLowerCase();
      
      if (format === 'png') {
        // Preserve PNG format with optimization
        processedImage = processedImage.png({ quality: finalConfig.quality, compressionLevel: 9 });
      } else if (format === 'webp') {
        // Preserve WebP format
        processedImage = processedImage.webp({ quality: finalConfig.quality });
      } else {
        // Convert to JPEG for all other formats (including JPEG, GIF)
        processedImage = processedImage.jpeg({ quality: finalConfig.quality });
      }

      // Generate thumbnail
      await processedImage.toFile(thumbnailPath);

      this.logger.log(`Thumbnail generated successfully: ${thumbnailPath}`);

      // Calculate relative path for URL
      const relativeFilePath = path.relative(
        path.join(process.cwd(), 'uploads'),
        thumbnailPath
      ).replace(/\\/g, '/');

      return {
        success: true,
        thumbnailPath,
        thumbnailUrl: `/uploads/${relativeFilePath}`,
      };

    } catch (error: any) {
      this.logger.error(`Failed to generate thumbnail: ${error.message}`, error.stack);
      
      return {
        success: false,
        error: error.message || 'Unknown error during thumbnail generation',
      };
    }
  }

  /**
   * Generate thumbnail from an existing file path
   * 
   * @param sourceFilePath - Path to the source image file
   * @param destinationDir - Directory where thumbnail will be saved (defaults to same as source)
   * @param config - Thumbnail generation options
   * @returns Promise with thumbnail result
   */
  static async generateThumbnailFromFile(
    sourceFilePath: string,
    destinationDir?: string,
    config: ThumbnailConfig = {}
  ): Promise<ThumbnailResult> {
    try {
      // Read the file
      const buffer = await fs.readFile(sourceFilePath);
      
      // Use source directory if destination not specified
      const targetDir = destinationDir || path.dirname(sourceFilePath);
      const originalFilename = path.basename(sourceFilePath);

      return await this.generateThumbnail(
        buffer,
        originalFilename,
        targetDir,
        config
      );

    } catch (error: any) {
      this.logger.error(`Failed to read file for thumbnail generation: ${error.message}`);
      
      return {
        success: false,
        error: error.message || 'Failed to read source file',
      };
    }
  }

  /**
   * Delete a thumbnail file
   * Safely handles cleanup of thumbnail files
   */
  static async deleteThumbnail(thumbnailPath: string): Promise<boolean> {
    try {
      await fs.unlink(thumbnailPath);
      this.logger.log(`Thumbnail deleted: ${thumbnailPath}`);
      return true;
    } catch (error: any) {
      this.logger.warn(`Failed to delete thumbnail: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if image dimensions require thumbnail generation
   * Returns false if image is already small enough
   */
  static async shouldGenerateThumbnail(
    buffer: Buffer,
    maxWidth: number = 300,
    maxHeight: number = 300
  ): Promise<boolean> {
    try {
      const metadata = await sharp(buffer).metadata();
      
      if (!metadata.width || !metadata.height) {
        return false;
      }

      return metadata.width > maxWidth || metadata.height > maxHeight;
    } catch (error) {
      this.logger.warn('Failed to check image dimensions, will generate thumbnail anyway');
      return true;
    }
  }
}
