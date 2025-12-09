import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname, join, isAbsolute } from 'path';
import { promises as fsPromises } from 'fs';
import * as fs from 'fs';
import { Request, Response } from 'express';
import archiver from 'archiver';
import axios from 'axios';

export interface FileUploadResult {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
  url: string;
}

export interface FileUploadConfig {
  destination: string;
  maxSize?: number; // in bytes
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
}

export class FileUploadUtil {
  /**
   * Create multer storage configuration
   */
  static createStorage(destination: string) {
    return diskStorage({
      destination: (req, file, callback) => {
        // Ensure directory exists synchronously
        try {
          fs.mkdirSync(destination, { recursive: true });
          callback(null, destination);
        } catch (error) {
          callback(error, destination);
        }
      },
      filename: (req, file, callback) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        const filename = `${file.fieldname}-${uniqueSuffix}${ext}`;
        callback(null, filename);
      },
    });
  }

  /**
   * File filter function for multer
   */
  static createFileFilter(config: FileUploadConfig) {
    return (req: Request, file: Express.Multer.File, callback: any) => {
      // Check file size
      if (config.maxSize && file.size > config.maxSize) {
        return callback(
          new BadRequestException(`File size exceeds limit of ${config.maxSize} bytes`),
          false,
        );
      }

      // Check MIME type
      if (config.allowedMimeTypes && !config.allowedMimeTypes.includes(file.mimetype)) {
        return callback(
          new BadRequestException(
            `Invalid file type. Allowed types: ${config.allowedMimeTypes.join(', ')}`,
          ),
          false,
        );
      }

      // Check file extension
      if (config.allowedExtensions) {
        const fileExt = extname(file.originalname).toLowerCase();
        if (!config.allowedExtensions.includes(fileExt)) {
          return callback(
            new BadRequestException(
              `Invalid file extension. Allowed extensions: ${config.allowedExtensions.join(', ')}`,
            ),
            false,
          );
        }
      }

      callback(null, true);
    };
  }

  /**
   * Process uploaded file and return structured information
   */
  static processUploadedFile(
    file: Express.Multer.File,
    baseUrl: string = 'http://localhost:3000',
  ): FileUploadResult {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Create URL path relative to server
    const relativePath = file.path.replace(/\\/g, '/').replace(/^.*\/uploads\//, '/uploads/');
    const url = `${baseUrl}${relativePath}`;

    return {
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
      url,
    };
  }

  /**
   * Delete uploaded file
   */
  static async deleteFile(filePath: string): Promise<void> {
    try {
      await fsPromises.unlink(filePath);
    } catch (error) {
      console.error('Error deleting file:', error);
      // Don't throw error as file might already be deleted
    }
  }

  /**
   * Validate file before upload
   */
  static validateFile(file: Express.Multer.File, config: FileUploadConfig): void {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (config.maxSize && file.size > config.maxSize) {
      throw new BadRequestException(`File size exceeds limit of ${config.maxSize} bytes`);
    }

    if (config.allowedMimeTypes && !config.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${config.allowedMimeTypes.join(', ')}`,
      );
    }

    if (config.allowedExtensions) {
      const fileExt = extname(file.originalname).toLowerCase();
      if (!config.allowedExtensions.includes(fileExt)) {
        throw new BadRequestException(
          `Invalid file extension. Allowed extensions: ${config.allowedExtensions.join(', ')}`,
        );
      }
    }
  }

  /**
   * Get file size in human readable format
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get common file upload configurations
   */
  static getImageUploadConfig(): FileUploadConfig {
    return {
      destination: './uploads/images',
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    };
  }

  static getDocumentUploadConfig(): FileUploadConfig {
    return {
      destination: './uploads/documents',
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
      ],
      allowedExtensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'],
    };
  }

  static getAssetUploadConfig(): FileUploadConfig {
    return {
      destination: './uploads/assets',
      maxSize: 50 * 1024 * 1024, // 50MB
      allowedMimeTypes: [
        // Images
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        // Documents
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        // Videos
        'video/mp4',
        'video/webm',
        'video/ogg',
        // Audio
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
      ],
      allowedExtensions: [
        '.jpg',
        '.jpeg',
        '.png',
        '.gif',
        '.webp',
        '.svg',
        '.pdf',
        '.doc',
        '.docx',
        '.xls',
        '.xlsx',
        '.txt',
        '.mp4',
        '.webm',
        '.ogg',
        '.mp3',
        '.wav',
      ],
    };
  }

  /**
   * Download multiple files as a ZIP archive
   */
  static async downloadFilesAsZip(
    files: string[],
    res: Response,
    filename: string = 'assets.zip',
  ): Promise<void> {
    try {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(res);

      for (const url of files) {
        try {
          // Handle different URL/path formats:
          // - Full URLs (http(s)://) => use axios to fetch
          // - Data URLs (data:...) => decode and add
          // - Absolute or relative local file paths (/uploads/..., uploads/..., relative path) => read from disk
          let filePath: string | undefined;
          
          if (url.startsWith('http://') || url.startsWith('https://')) {
            // Full URL - fetch via HTTP (e.g., Cloudinary)
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            const fileName = url.split('/').pop() || 'file';
            archive.append(response.data, { name: fileName });
            continue;
          } else if (url.startsWith('data:')) {
            // Data URL (base64) => decode and append
            const match = url.match(/^data:(.+);base64,(.+)$/);
            if (match) {
              const [, mimeType, b64] = match;
              const csv = Buffer.from(b64, 'base64');
              const fileName = `file-${Date.now()}`;
              archive.append(csv, { name: fileName });
              continue;
            } else {
              console.warn(`Invalid data URL: ${url}`);
              continue;
            }
          } else if (url.startsWith('/uploads/')) {
            // Relative path with /uploads/ prefix - convert to file system path
            filePath = join(process.cwd(), url.replace(/^\//, ''));
          } else if (isAbsolute(url)) {
            // Absolute file path on disk
            filePath = url;
          } else if (url.startsWith('uploads/')) {
            // paths like uploads/foo
            filePath = join(process.cwd(), url);
          } else {
            // Already a relative path without leading slash
            filePath = join(process.cwd(), 'uploads', url);
          }

          // Read file from local file system
          const fileExists = await fsPromises.access(filePath).then(() => true).catch(() => false);
          if (!fileExists) {
            console.error(`File not found: ${filePath}`);
            continue;
          }

          const fileBuffer = await fsPromises.readFile(filePath);
          const fileName = url.split('/').pop() || 'file';
          archive.append(fileBuffer, { name: fileName });
        } catch (err) {
          console.error(`Failed to add file ${url} to archive:`, err);
          // Continue with other files
        }
      }

      await archive.finalize();
    } catch (error) {
      console.error('Error creating ZIP archive:', error);
      // If headers are already sent, we can't change them
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ error: 'Failed to create ZIP archive' });
      } else {
        // If headers are sent, just end the response
        res.end();
      }
    }
  }

}
