import axios from 'axios';
import { Logger } from '@nestjs/common';
import { AssetService } from '../asset/asset.service';

/**
 * Helper class for downloading images from URLs and uploading them to the assets API.
 * Used during Excel import to convert external image URLs into internal asset URLs.
 */
export class ImageUploadHelper {
  private static readonly logger = new Logger(ImageUploadHelper.name);

  /**
   * Downloads an image from a URL into memory (Buffer) and uploads it to the assets service.
   * No file system usage - everything happens in memory.
   * 
   * @param imageUrl - The external URL of the image to download
   * @param assetService - The AssetService instance to use for uploading
   * @param userId - User ID to associate with the uploaded asset
   * @param assetGroupId - Optional asset group ID to organize the image
   * @param retries - Number of retry attempts for failed downloads (default: 2)
   * @returns The uploaded asset data including the URL
   */
  static async downloadAndUploadImageInMemory(
    imageUrl: string,
    assetService: AssetService,
    userId: number,
    assetGroupId?: number,
    retries: number = 3
  ): Promise<any> {
    let lastError: any;
    
    // Try downloading with retries
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          // Longer delay for Cloudflare challenges - they need time to verify
          const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000); // 2s, 4s, 8s, max 10s
          this.logger.log(`Retry attempt ${attempt} for: ${imageUrl} (waiting ${delay}ms)`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          this.logger.log(`Downloading image from URL: ${imageUrl}`);
        }

        // 1. Download image as Buffer with enhanced headers to bypass bot protection
        // Randomize some headers to appear more like different browsers
        const userAgents = [
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        ];
        const userAgent = userAgents[attempt % userAgents.length];
        
        const response = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': userAgent,
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'image',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Referer': new URL(imageUrl).origin + '/',
            // Don't send cache control headers on retry - act more natural
            ...(attempt === 0 ? {} : { 'Cache-Control': 'max-age=0' }),
          },
          timeout: 45000, // 45 second timeout (longer for slow responses)
          maxContentLength: 10 * 1024 * 1024, // 10MB max
          maxRedirects: 5, // Follow redirects
          validateStatus: (status) => status >= 200 && status < 300, // Only accept 2xx responses
        });

        const buffer = Buffer.from(response.data);
        
        // Validate that we actually got image data, not an HTML error page
        const contentType = response.headers['content-type'] || '';
        if (!contentType.startsWith('image/') && buffer.length > 0) {
          // Check if it looks like HTML (common with Cloudflare blocks)
          const firstBytes = buffer.toString('utf8', 0, Math.min(200, buffer.length));
          const lowerFirstBytes = firstBytes.toLowerCase();
          
          if (lowerFirstBytes.includes('<!doctype') || lowerFirstBytes.includes('<html')) {
            // Check for Cloudflare challenge page
            if (lowerFirstBytes.includes('just a moment') || lowerFirstBytes.includes('checking your browser')) {
              throw new Error(`Cloudflare challenge detected - retry needed`);
            }
            throw new Error(`Received HTML instead of image data - possible bot protection`);
          }
        }
        
        // Extract filename from URL or generate one
        const urlFilename = imageUrl.split('/').pop()?.split('?')[0];
        const extension = this.getExtensionFromContentType(response.headers['content-type']) || 
                         this.getExtensionFromUrl(imageUrl) || 
                         'jpg';
        const filename = urlFilename || `image-${Date.now()}.${extension}`;
        const assetName = filename.replace(/\.[^.]+$/, ''); // Remove extension for asset name

        this.logger.log(`Downloaded image: ${filename} (${buffer.length} bytes)`);

        // 2. Upload to asset service directly
        const multerFile: Express.Multer.File = {
          fieldname: 'file',
          originalname: filename,
          encoding: '7bit',
          mimetype: response.headers['content-type'] || 'image/jpeg',
          buffer: buffer,
          size: buffer.length,
          stream: null as any,
          destination: '',
          filename: filename,
          path: '',
        };

        this.logger.log(`Uploading image to asset service`);

        const uploadResult = await assetService.create(
          {
            name: assetName,
            assetGroupId: assetGroupId,
          },
          multerFile,
          userId
        );

        this.logger.log(`Successfully uploaded image: ${uploadResult.url || uploadResult.filePath}`);

        return uploadResult;
        
      } catch (error: any) {
        lastError = error;
        
        if (axios.isAxiosError(error)) {
          if (error.response) {
            this.logger.warn(
              `Attempt ${attempt + 1}/${retries + 1} failed for ${imageUrl}: ${error.response.status} ${error.response.statusText}`
            );
            
            // Log response data for HTML responses (Cloudflare blocks, etc.)
            if (error.response.data) {
              const contentType = error.response.headers['content-type'] || '';
              if (contentType.includes('text/html')) {
                const htmlPreview = Buffer.from(error.response.data).toString('utf8', 0, 200);
                this.logger.debug(`HTML response preview: ${htmlPreview}...`);
              }
            }
          } else if (error.request) {
            this.logger.warn(`Attempt ${attempt + 1}/${retries + 1} - No response from ${imageUrl}: ${error.message}`);
          } else {
            this.logger.warn(`Attempt ${attempt + 1}/${retries + 1} - Request setup error for ${imageUrl}: ${error.message}`);
          }
        } else {
          this.logger.warn(`Attempt ${attempt + 1}/${retries + 1} - Unexpected error for ${imageUrl}: ${error.message}`);
        }
        
        // Determine if we should retry
        let shouldRetry = true;
        if (axios.isAxiosError(error) && error.response) {
          const status = error.response.status;
          // Always retry 403 (Cloudflare) and 429 (rate limit)
          // Don't retry other 4xx errors (404, 400, 401, etc.)
          if (status >= 400 && status < 500 && status !== 403 && status !== 429) {
            this.logger.warn(`Not retrying ${imageUrl} due to client error ${status}`);
            shouldRetry = false;
          }
        } else if (error.message && error.message.includes('Cloudflare challenge')) {
          // Always retry Cloudflare challenges
          this.logger.log(`Cloudflare challenge detected, will retry with longer delay`);
          shouldRetry = true;
        }
        
        if (!shouldRetry) {
          break;
        }
        
        // Continue to next retry attempt
        if (attempt < retries) {
          continue;
        }
      }
    }
    
    // All retries failed
    if (axios.isAxiosError(lastError)) {
      if (lastError.response) {
        this.logger.error(
          `Failed to upload image from ${imageUrl} after ${retries + 1} attempts: ${lastError.response.status} ${lastError.response.statusText}`
        );
      } else if (lastError.request) {
        this.logger.error(`No response received when processing ${imageUrl} after ${retries + 1} attempts: ${lastError.message}`);
      } else {
        this.logger.error(`Error setting up request for ${imageUrl}: ${lastError.message}`);
      }
    } else {
      this.logger.error(`Unexpected error processing image ${imageUrl} after ${retries + 1} attempts:`, lastError?.message);
    }
    throw lastError;
  }

  /**
   * Downloads and uploads multiple images in parallel.
   * Returns an array of results in the same order as input URLs.
   * 
   * @param imageUrls - Array of external image URLs to download
   * @param assetService - The AssetService instance to use for uploading
   * @param userId - User ID to associate with uploaded assets
   * @param assetGroupId - Optional asset group ID to organize images
   * @param maxConcurrent - Maximum number of concurrent downloads/uploads (default: 3)
   * @returns Array of upload results (or null for failed uploads)
   */
  static async downloadAndUploadMultipleImages(
    imageUrls: string[],
    assetService: AssetService,
    userId: number,
    assetGroupId?: number,
    maxConcurrent: number = 3
  ): Promise<Array<any | null>> {
    if (!imageUrls || imageUrls.length === 0) {
      return [];
    }

    this.logger.log(`Processing ${imageUrls.length} images with max ${maxConcurrent} concurrent uploads`);

    const results: Array<any | null> = [];
    
    // Process in batches to avoid overwhelming the server
    for (let i = 0; i < imageUrls.length; i += maxConcurrent) {
      const batch = imageUrls.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async (url) => {
        try {
          return await this.downloadAndUploadImageInMemory(url, assetService, userId, assetGroupId);
        } catch (error) {
          this.logger.warn(`Failed to process image ${url}, continuing with next images`);
          return null; // Return null for failed uploads
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const successCount = results.filter(r => r !== null).length;
    this.logger.log(`Completed processing ${imageUrls.length} images: ${successCount} successful, ${imageUrls.length - successCount} failed`);

    return results;
  }

  /**
   * Helper to extract file extension from content-type header
   */
  private static getExtensionFromContentType(contentType: string | undefined): string | null {
    if (!contentType) return null;

    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'image/bmp': 'bmp',
      'image/tiff': 'tiff',
    };

    return mimeToExt[contentType.toLowerCase()] || null;
  }

  /**
   * Helper to extract file extension from URL
   */
  private static getExtensionFromUrl(url: string): string | null {
    try {
      const pathname = new URL(url).pathname;
      const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
      return match ? match[1].toLowerCase() : null;
    } catch {
      return null;
    }
  }

  /**
   * Validates if a string is a valid HTTP/HTTPS URL
   */
  static isValidImageUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Processes an imageUrl field during Excel import:
   * - If it's already a valid URL to your assets, returns it unchanged
   * - If it's an external URL, downloads and uploads it, returns the new asset URL
   * - If it's invalid or empty, returns null
   * 
   * @param imageUrl - The image URL from Excel (could be external or internal)
   * @param assetService - The AssetService instance to use for uploading
   * @param userId - User ID
   * @param internalDomain - Your internal domain (e.g., 'yourdomain.com') to detect already-uploaded images
   * @param assetGroupId - Optional asset group ID to organize the image
   * @param keepOriginalOnFailure - If true, returns the original URL when download fails (default: false)
   * @returns The final image URL to store in the product (or null)
   */
  static async processImageUrlForImport(
    imageUrl: string | null | undefined,
    assetService: AssetService,
    userId: number,
    internalDomain: string,
    assetGroupId?: number,
    keepOriginalOnFailure: boolean = false
  ): Promise<string | null> {
    if (!imageUrl || typeof imageUrl !== 'string') {
      return null;
    }

    const trimmed = imageUrl.trim();
    if (!trimmed) {
      return null;
    }

    // Check if it's a valid URL
    if (!this.isValidImageUrl(trimmed)) {
      this.logger.warn(`Invalid image URL: ${trimmed}`);
      return null;
    }

    // Check if it's already an internal asset URL (don't re-upload)
    if (trimmed.includes(internalDomain)) {
      this.logger.log(`Image URL is already internal: ${trimmed}`);
      return trimmed;
    }

    // External URL - download and upload
    try {
      const uploadResult = await this.downloadAndUploadImageInMemory(
        trimmed,
        assetService,
        userId,
        assetGroupId
      );

      // Return the uploaded asset URL
      return uploadResult.url || uploadResult.filePath || uploadResult.assetUrl || null;
    } catch (error) {
      this.logger.error(`Failed to process external image URL ${trimmed}:`, error);
      
      // If configured to keep original URL on failure, return it
      if (keepOriginalOnFailure) {
        this.logger.warn(`Keeping original URL due to download failure: ${trimmed}`);
        return trimmed;
      }
      
      return null; // Return null if upload fails and not keeping original
    }
  }
}
