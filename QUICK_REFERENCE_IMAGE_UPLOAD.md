# 🚀 Image Upload Feature - Quick Reference

## ⚡ Quick Setup (30 seconds)

```bash
# 1. Install dependency (axios is already in package.json)
cd PixelPim_backend
npm install

# 2. Add to .env
echo 'INTERNAL_DOMAIN="localhost"' >> .env

# 3. Generate test file
npm run generate:sample-excel

# 4. Start server
npm run start:dev

# 5. Test import
# Upload test-files/products_with_images.xlsx via Excel import endpoint
```

## 📋 What It Does

✅ Downloads external image URLs from Excel
✅ Uploads to your internal assets API
✅ Updates product data with internal URLs
✅ Skips already-internal images
✅ Handles errors gracefully

## 🔧 Configuration (`.env`)

```bash
INTERNAL_DOMAIN="localhost"
IMPORT_ASSET_GROUP_ID=""  # Optional: organize imported images
```

## 📊 Excel Format

| SKU | Name | Image URL | Additional Images |
|-----|------|-----------|-------------------|
| SKU-001 | Product 1 | https://example.com/image.jpg | https://example.com/img1.jpg,https://example.com/img2.jpg |

**Supported formats for Additional Images:**
- Comma-separated: `url1,url2,url3`
- JSON array: `["url1","url2","url3"]`
- Single URL: `url1`

## 🎯 Testing

```bash
# Generate sample Excel
npm run generate:sample-excel

# File created at:
test-files/products_with_images.xlsx

# Contains 10 test products with:
# - External URLs (will be downloaded)
# - Internal URLs (will be skipped)
# - Invalid URLs (will be logged)
# - Various formats
```

## 📝 Logs to Watch

```
[ExcelImportService] Processing imageUrl for row 2: https://...
[ImageUploadHelper] Downloading image from URL: https://...
[ImageUploadHelper] Downloaded image: image.jpg (12345 bytes)
[ImageUploadHelper] Uploading image to: http://localhost:3000/...
[ImageUploadHelper] Successfully uploaded: /assets/12345/image.jpg
[ExcelImportService] Updated imageUrl for row 2: /assets/12345/image.jpg
```

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| Images not downloading | Check AssetService is properly injected |
| "[object Object]" error | Already fixed! Cell parser updated |
| Timeout errors | Large images (increase timeout) |
| Already internal | Working as expected (skips re-upload) |

## 📚 Documentation

- Full docs: `docs/IMAGE_UPLOAD_DURING_IMPORT.md`
- Test cases: `test/image-upload-during-import.http`
- Implementation: `IMAGE_UPLOAD_IMPLEMENTATION_SUMMARY.md`

## 💡 Key Features

- **In-Memory Processing**: No temp files
- **Direct Service Calls**: No HTTP overhead
- **Concurrent**: 3 images at once
- **Smart**: Skips internal URLs
- **Resilient**: Errors don't break import
- **Fast**: Parallel processing + direct calls

## 🎓 API Usage

```typescript
// In your code:
import { ImageUploadHelper } from '../utils/image-upload.helper';
import { AssetService } from '../asset/asset.service';

// Inject AssetService in constructor
constructor(private readonly assetService: AssetService) {}

// Single image
const url = await ImageUploadHelper.processImageUrlForImport(
  'https://example.com/image.jpg',
  this.assetService,
  userId,
  internalDomain,
  assetGroupId // optional
);

// Multiple images
const urls = await ImageUploadHelper.downloadAndUploadMultipleImages(
  ['url1', 'url2', 'url3'],
  this.assetService,
  userId,
  assetGroupId, // optional
  3 // max concurrent
);
```

## ✅ Status

**READY TO USE** - All features implemented and tested.

---

Need help? Check the full documentation in `docs/IMAGE_UPLOAD_DURING_IMPORT.md`
