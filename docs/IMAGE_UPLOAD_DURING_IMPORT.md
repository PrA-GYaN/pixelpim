# Image Upload During Excel Import

## Overview

This feature automatically downloads external image URLs from Excel imports and uploads them to your internal assets storage. When importing products from Excel files, any external image URLs (from `imageUrl` or `subImages` columns) are automatically:

1. **Downloaded** into memory (no temporary files)
2. **Uploaded** to your internal assets API
3. **Replaced** with the new internal asset URLs in the product data

## How It Works

### 1. Excel Import Flow

```
Excel File → Parse Data → Validate Rows → Process Images → Create Products
                                              ↓
                              External URL → Download → Upload → Internal URL
```

### 2. Image Processing Rules

- **External URLs**: Images from external domains are downloaded and uploaded to your assets
- **Internal URLs**: Images already hosted on your domain are left unchanged
- **Invalid URLs**: Non-URL values or invalid URLs are logged and skipped (original value kept)
- **Multiple Images**: The `subImages` field can contain multiple URLs (comma-separated or JSON array)
- **Concurrent Processing**: Multiple images are processed in parallel (max 3 concurrent) for performance

### 3. Supported Image Formats

- JPEG/JPG
- PNG
- GIF
- WebP
- SVG
- BMP
- TIFF

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Your internal domain (to avoid re-uploading existing assets)
INTERNAL_DOMAIN="localhost"

# Optional: Asset Group ID for organizing imported images
IMPORT_ASSET_GROUP_ID=""
```

### Production Configuration

For production, update the domain:

```bash
INTERNAL_DOMAIN="yourdomain.com"
```

## Excel File Format

### Example 1: Single Image URL

| SKU | Name | imageUrl | subImages |
|-----|------|----------|-----------|
| PROD-001 | Product 1 | https://example.com/image1.jpg | https://example.com/img2.jpg,https://example.com/img3.jpg |

### Example 2: JSON Array for subImages

| SKU | Name | imageUrl | subImages |
|-----|------|----------|-----------|
| PROD-001 | Product 1 | https://example.com/image1.jpg | ["https://example.com/img2.jpg","https://example.com/img3.jpg"] |

### Example 3: Already Internal URLs (Not Re-uploaded)

| SKU | Name | imageUrl |
|-----|------|----------|
| PROD-001 | Product 1 | https://yourdomain.com/assets/12345/product.jpg |

## Usage

### Standard Excel Import

1. Prepare Excel file with product data and external image URLs
2. Upload via the Excel import endpoint
3. Images are automatically processed during import
4. Check logs to see which images were successfully uploaded

### Column Mapping

Map these columns in your Excel import:

- `imageUrl` → Main product image
- `subImages` → Additional product images (comma-separated or JSON array)

## Implementation Details

### Core Components

1. **ImageUploadHelper** (`src/utils/image-upload.helper.ts`)
   - Downloads images from external URLs
   - Calls AssetService directly for uploads
   - Handles multiple concurrent uploads
   - Validates URLs and handles errors

2. **ExcelImportService** (`src/product/services/excel-import.service.ts`)
   - Integrates image processing into Excel import pipeline
   - Injects and uses AssetService
   - Calls `processImagesForProduct()` for each validated row
   - Updates product DTOs with uploaded asset URLs

3. **AssetService** (`src/asset/asset.service.ts`)
   - Core service for asset management
   - Handles file uploads to Cloudinary and local storage
   - Returns asset URLs for product references

### Error Handling

- **Download Failures**: Logged as warnings, original URL kept
- **Upload Failures**: Logged as warnings, original URL kept
- **Invalid URLs**: Skipped with warning, original value kept
- **Network Timeouts**: 30-second timeout for downloads and uploads
- **Size Limits**: 10MB max per image

## Logging

The feature provides detailed logging:

```
[ExcelImportService] Processing imageUrl for row 5: https://example.com/image.jpg
[ImageUploadHelper] Downloading image from URL: https://example.com/image.jpg
[ImageUploadHelper] Downloaded image: image.jpg (234567 bytes)
[ImageUploadHelper] Uploading image to: http://localhost:3000/api/assets/upload
[ImageUploadHelper] Successfully uploaded image: /assets/12345/image.jpg
[ExcelImportService] Updated imageUrl for row 5: /assets/12345/image.jpg
```

## Performance Considerations

### Batch Processing

Images are processed in batches:
- Max 3 concurrent downloads/uploads per product
- Prevents overwhelming the server
- Configurable via `maxConcurrent` parameter

### Memory Usage

- Images are downloaded into memory buffers
- No temporary files created on disk
- Memory is freed after each upload
- Suitable for typical product images (< 10MB)

### Import Speed

For 100 products with images:
- Without image processing: ~5-10 seconds
- With image processing: ~30-60 seconds (depends on image sizes and network)

## Troubleshooting

### Images Not Being Downloaded

1. **Check Service Injection**
   - Ensure AssetService is properly injected in ExcelImportService
   - Verify the module imports are correct

2. **Check Logs**
   - Look for "Processing imageUrl" messages
   - Check for error messages about failed downloads/uploads

### Authentication Issues

No longer applicable - we now use direct service calls instead of HTTP API calls.

### External URLs Not Working

1. **Firewall/Network Issues**: Ensure the server can access external URLs
2. **SSL/Certificate Issues**: Some servers may reject invalid SSL certificates
3. **Rate Limiting**: External servers may rate-limit downloads

### Images Already Exist

If you don't want to re-download images that are already in your system:
- The helper checks if the URL contains your `INTERNAL_DOMAIN`
- Already-internal URLs are skipped automatically

## API Reference

### ImageUploadHelper

```typescript
// Inject AssetService in your service constructor
constructor(private readonly assetService: AssetService) {}

// Process a single image URL
const uploadedUrl = await ImageUploadHelper.processImageUrlForImport(
  'https://example.com/image.jpg',
  this.assetService,
  userId,
  'localhost',
  assetGroupId // optional
);

// Process multiple images
const uploadedUrls = await ImageUploadHelper.downloadAndUploadMultipleImages(
  ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
  this.assetService,
  userId,
  assetGroupId, // optional
  3 // maxConcurrent
);

// Validate URL
const isValid = ImageUploadHelper.isValidImageUrl('https://example.com/image.jpg');
```

## Future Enhancements

Potential improvements:
- [ ] Resume failed image uploads in a retry queue
- [ ] Extract embedded images from Excel workbooks
- [ ] Support for image optimization/resizing during upload
- [ ] Progress tracking for image uploads in the UI
- [ ] Cache downloaded images to avoid re-downloading
- [ ] Support for cloud storage (S3, Azure Blob, etc.)
- [ ] Image validation (dimensions, format, file size)

## Dependencies

```json
{
  "axios": "^1.11.0"
}
```

Note: `form-data` is no longer needed as we use direct service calls instead of HTTP requests.

## License

Part of the PixelPIM backend system.
