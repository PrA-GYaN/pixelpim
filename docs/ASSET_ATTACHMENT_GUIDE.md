# Asset Attachment System - Complete Guide

## Overview

The Asset Attachment system automatically links assets from your Digital Assets library to products during import using an intelligent filename pattern classification system. This eliminates manual URL management and automatically organizes images into main images, sub-images, and assets based on their filenames.

---

## Filename Pattern Classification System

The system uses strict filename pattern matching to decide where each image should be assigned:

### 1. Main Image (product.mainImageUrl)

**When to use:** Primary product image displayed prominently

**Filename Patterns:**
- `SKU.ext` - Exact SKU match
- `SKU_image.ext` - SKU with "image" suffix
- `SKU-image.ext` - SKU with "image" suffix (hyphen separator)
- `SKU.image.ext` - SKU with "image" suffix (dot separator)
- `SKU_main.ext`, `SKU_primary.ext`, `SKU_front.ext` - Common main image suffixes

**Rules:**
- Case-insensitive matching
- Only image files (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`, `.svg`)
- Automatically sets as `product.mainImageUrl`
- **NOT** added to `product.assets[]`

**Examples:**
```
Product SKU: PROD-123

✓ Main images:
  - PROD-123.jpg
  - PROD-123_image.png
  - PROD-123-main.jpg
  - PROD-123.primary.webp
  - prod-123_front.jpeg

✗ NOT main images:
  - PROD-123_SubImage.jpg (contains "subimage")
  - PROD-123_Assets.jpg (contains "assets")
  - PROD-123[Detail].jpg (different pattern)
```

---

### 2. Sub-Images (product.subImages[])

**When to use:** Additional product images displayed in gallery/carousel

**Filename Patterns:**
- `SKU_SubImage.ext`
- `SKU_subimage.ext`
- `SKU SubImage.ext` (space separator)
- `SKU-SubImage.ext` (hyphen separator)
- `SKU.SubImage.ext` (dot separator)
- `SKU[SubImage].ext` (bracket notation)
- Any filename containing "subimage" or "sub" (case-insensitive) after the SKU

**Rules:**
- Case-insensitive matching for "subimage", "sub-image", "sub_image", "sub"
- Leading/trailing spaces, hyphens, underscores, or brackets are normalized
- Added to `product.subImages[]` array
- **NOT** added to `product.assets[]` (to avoid duplication)

**Examples:**
```
Product SKU: PROD-123

✓ Sub-images:
  - PROD-123_SubImage.jpg
  - PROD-123_subimage1.png
  - PROD-123 SubImage.jpg
  - PROD-123-SubImage2.webp
  - PROD-123.SubImage.jpeg
  - PROD-123[SubImage].jpg
  - PROD-123_sub.jpg
  - PROD-123-sub-1.png

✗ NOT sub-images:
  - PROD-123.jpg (main image - exact match)
  - PROD-123_Assets.jpg (contains "assets")
  - PROD-123[Detail].jpg (no "sub" keyword)
```

---

### 3. Assets (product.assets[])

**When to use:** Additional files (PDFs, videos, technical documents) or images that should only be in assets

**Filename Patterns:**
- `SKU_Assets.ext`
- `SKU_assets.ext`
- `SKU Assets.ext` (space separator)
- `SKU-Assets.ext` (hyphen separator)
- `SKU[Assets].ext` (bracket notation)
- Any filename containing "asset" or "assets" (case-insensitive) after the SKU
- **Default:** Any other pattern that doesn't match main or sub-image rules (e.g., `SKU[Detail1].ext`)

**Rules:**
- Case-insensitive matching
- Supports all file types (images, PDFs, videos, documents)
- Attached to `product.assets[]` only
- **NOT** set as main image or added to subImages
- Default classification for unmatched patterns

**Examples:**
```
Product SKU: PROD-123

✓ Assets:
  - PROD-123_Assets.jpg
  - PROD-123_asset1.pdf
  - PROD-123 Assets.mp4
  - PROD-123-Assets.zip
  - PROD-123[Assets].jpg
  - PROD-123[Detail1].jpg (default classification)
  - PROD-123[Manual].pdf (default classification)
  - PROD-123_spec.docx (default classification)

✗ NOT assets (classified differently):
  - PROD-123.jpg (main image)
  - PROD-123_SubImage.jpg (sub-image)
```

---

## Classification Priority

When a filename matches multiple patterns, classification follows this priority:

1. **Main Image** - Highest priority (exact SKU match or "image", "main", "primary", "front" keywords)
2. **Sub-Image** - Medium priority (contains "subimage", "sub-image", "sub_image", or "sub")
3. **Asset** - Default/lowest priority (contains "asset"/"assets" OR any other pattern)

---

## How It Works

### Import Flow

```
1. User imports Excel with product data
   ↓
2. Product created with SKU
   ↓
3. CLASSIFICATION: System scans Digital Assets for filename patterns
   - Finds assets starting with SKU
   - Classifies each based on filename pattern
   ↓
4. MAIN IMAGE: Exact SKU match or "image" pattern
   - Finds: PROD-123.jpg or PROD-123_image.jpg
   - Action: Set as product.mainImageUrl (if no imageUrl provided)
   ↓
5. SUB-IMAGES: Files containing "subimage" or "sub"
   - Finds: PROD-123_SubImage1.jpg, PROD-123[SubImage].jpg
   - Action: Add to product.subImages[]
   ↓
6. ASSETS: Files containing "asset"/"assets" or other patterns
   - Finds: PROD-123[Detail1].jpg, PROD-123_Assets.pdf
   - Action: Attach to product.assets[]
   ↓
7. Product fully configured with all assets organized correctly
```

### Asset Attachment

**All matched assets are attached via the `ProductAsset` relationship:**
- Enables tracking of which assets belong to which products
- Allows assets to be shared across multiple products
- Provides API access to all product assets: `GET /products/{id}/assets`

**Display vs Attachment:**
- **Images** → Attached AND displayed (imageUrl/subImages fields)
- **Non-images** → Attached only (accessible via API, not displayed in image fields)

---

## Excel Configuration

### Minimal Setup (Main Image Only)

**No Excel columns needed!**

```excel
| SKU       | Name           | Price |
|-----------|----------------|-------|
| PROD-001  | Product One    | 29.99 |
| PROD-002  | Product Two    | 39.99 |
```

**Requirements:**
- Upload `PROD-001.jpg` and `PROD-002.jpg` to Digital Assets
- Import Excel
- Main images automatically set

---

### Automatic Setup (Main + Sub-Images + Assets)

**Still no Excel columns needed!**

```excel
| SKU       | Name           | Price |
|-----------|----------------|-------|
| PROD-001  | Product One    | 29.99 |
```

**Digital Assets uploads:**
```
PROD-001.jpg          → Main image (automatic)
PROD-001[Back].jpg    → Sub-image (automatic)
PROD-001[Side].jpg    → Sub-image (automatic)
PROD-001[Manual].pdf  → Asset (automatic)
```

**Result:** All assets automatically attached without any Excel configuration!

---

### With Sub-Images (Method 1: Automatic)

**No Excel configuration needed:**

```excel
| SKU       | Name        | Price |
|-----------|-------------|-------|
| PROD-001  | Product One | 29.99 |
| PROD-002  | Product Two | 39.99 |
```

**Digital Assets uploads:**
```
PROD-001.jpg              → Main image
PROD-001[Detail1].jpg     → Sub-image
PROD-001[Detail2].jpg     → Sub-image

PROD-002.jpg              → Main image
PROD-002[Back].jpg        → Sub-image
PROD-002[Side].jpg        → Sub-image
```

**Result:** All images automatically attached based on naming!

---

### With Sub-Images (Method 2: Manual via Excel)

**Add `subImages` column with patterns (for assets NOT named with SKU prefix):**

```excel
| SKU       | Name        | subImages                                    |
|-----------|-------------|----------------------------------------------|
| PROD-001  | Product One | PROD-001[Detail1],PROD-001[Detail2]          |
| PROD-002  | Product Two | PROD-002[Back],PROD-002[Side]                |
```

**Requirements:**
- Upload main images: `PROD-001.jpg`, `PROD-002.jpg`
- Upload sub-images: `Detail1.jpg`, `Detail2.jpg`, `Back.jpg`, `Side.jpg`
- The patterns refer to assets named without SKU prefix
- Import Excel
- Main images set automatically, sub-images from Excel patterns

---

### With All Asset Types

**Include documents, videos, etc. in `subImages` column:**

```excel
| SKU       | Name        | subImages                                                  |
|-----------|-------------|------------------------------------------------------------|
| PROD-001  | Product One | PROD-001[Detail],PROD-001[Manual],PROD-001[Video]          |
```

**Requirements:**
- Upload: `PROD-001.jpg` (main), `Detail.jpg`, `Manual.pdf`, `Video.mp4`
- Import Excel
- Main image automatic, Detail.jpg displayed, Manual.pdf and Video.mp4 attached

---

### Overriding Automatic Matching

**Use `imageUrl` column to provide explicit URL:**

```excel
| SKU       | Name        | imageUrl                           | subImages              |
|-----------|-------------|------------------------------------|------------------------|
| PROD-001  | Product One | https://cdn.example.com/main.jpg   | PROD-001[Detail]       |
```

**Result:** External URL used for main image, automatic matching skipped, patterns still work for sub-images

---

## Complete Examples

### Example 1: Simple Product

**Digital Assets:**
```
LAPTOP-001.jpg
```

**Excel:**
```excel
| SKU        | Name          | Price  |
|------------|---------------|--------|
| LAPTOP-001 | Gaming Laptop | 999.00 |
```

**Result:**
- Main image: `LAPTOP-001.jpg` ✅
- Sub-images: None
- Attached assets: LAPTOP-001.jpg

---

### Example 2: Product with Sub-Images (Automatic)

**Digital Assets:**
```
SHIRT-RED.jpg
SHIRT-RED[Back].jpg
SHIRT-RED[Side].jpg
```

**Excel:**
```excel
| SKU       | Name       |
|-----------|------------|
| SHIRT-RED | Red Shirt  |
```

**Result:**
- Main image: `SHIRT-RED.jpg` ✓ (automatic exact match)
- Sub-images: `SHIRT-RED[Back].jpg`, `SHIRT-RED[Side].jpg` ✓ (automatic pattern detection)
- Attached assets: All 3 images
- **No Excel configuration needed!**

---

### Example 3: Product with Documents (Automatic)

**Digital Assets:**
```
PROD-123.jpg
PROD-123[Detail].jpg
PROD-123[Manual].pdf
PROD-123[Specs].docx
PROD-123[Video].mp4
```

**Excel:**
```excel
| SKU      | Name    |
|----------|---------|  
| PROD-123 | Product |
```

**Result:**
- Main image: `PROD-123.jpg` ✅ (displayed)
- Sub-images: `PROD-123[Detail].jpg` ✅ (displayed)
- Attached assets: Manual.pdf, Specs.docx, Video.mp4 ✅ (attached, not displayed)
- Access documents via API: `GET /products/{id}/assets`
- **Everything automatic - no Excel columns needed!**

---

### Example 4: Product Variants (Automatic)

**Digital Assets:**
```
SHIRT-RED.jpg
SHIRT-RED[Back].jpg
SHIRT-RED[Side].jpg
SHIRT-BLUE.jpg
SHIRT-BLUE[Back].jpg
SHIRT-BLUE[Side].jpg
```

**Excel:**
```excel
| SKU        | Name       |
|------------|------------|
| SHIRT-RED  | Red Shirt  |
| SHIRT-BLUE | Blue Shirt |
```

**Result:**
- SHIRT-RED: Main `SHIRT-RED.jpg`, Sub `SHIRT-RED[Back].jpg`, `SHIRT-RED[Side].jpg`
- SHIRT-BLUE: Main `SHIRT-BLUE.jpg`, Sub `SHIRT-BLUE[Back].jpg`, `SHIRT-BLUE[Side].jpg`
- **Fully automatic for all variants!**

---

### Example 5: Mixed Naming Approaches

**Digital Assets:**
```
PROD-456.jpg
PROD-456[Detail1].jpg      (automatic - has SKU in name)
PROD-456[Manual].pdf        (automatic - has SKU in name)
CloseupPhoto.jpg            (manual - no SKU in name)
```

**Excel:**
```excel
| SKU      | Name    | subImages               |
|----------|---------|-------------------------|
| PROD-456 | Product | PROD-456[CloseupPhoto]  |
```

**Result:**
- Main image: `PROD-456.jpg` ✓ (automatic)
- Sub-images: `PROD-456[Detail1].jpg` ✓ (automatic), `CloseupPhoto.jpg` ✓ (manual from Excel)
- Attached assets: Manual.pdf ✓ (automatic)
- **Combines automatic and manual approaches!**

---

## Asset Types Reference

### Supported Image Formats
**Automatically detected and displayed:**
- `.jpg` / `.jpeg`
- `.png`
- `.gif`
- `.webp`
- `.bmp`
- `.svg`

**Behavior:**
- Added to `imageUrl` or `subImages` fields
- Visible in product gallery/display
- Attached via ProductAsset relationship

### Supported Document Formats
**Attached but not displayed:**
- `.pdf` - PDF documents
- `.doc` / `.docx` - Word documents
- `.xls` / `.xlsx` - Excel spreadsheets
- `.ppt` / `.pptx` - PowerPoint presentations
- `.txt` - Text files

**Behavior:**
- Attached via ProductAsset relationship
- Accessible via API: `GET /products/{id}/assets`
- Not added to imageUrl/subImages (not displayable)

### Supported Video Formats
**Attached but not displayed:**
- `.mp4`
- `.avi`
- `.mov`
- `.webm`
- `.mkv`

**Behavior:**
- Attached via ProductAsset relationship
- Accessible via API
- Not added to imageUrl/subImages

### Other File Types
**Any file type in Digital Assets can be attached:**
- Archive files (`.zip`, `.rar`)
- CAD files (`.dwg`, `.dxf`)
- 3D models (`.obj`, `.fbx`)
- Any other format

---

## Best Practices

### 1. Asset Naming Convention

> 📖 **For detailed filename pattern rules, see [IMAGE_CLASSIFICATION_GUIDE.md](./IMAGE_CLASSIFICATION_GUIDE.md)**

**For main images:**
```
✓ Use exact SKU: PROD-123.jpg
✓ Or use pattern: PROD-123_image.jpg, PROD-123_main.jpg
✗ Avoid: PROD-123_SubImage.jpg (will be classified as sub-image)
```

**For sub-images:**
```
✓ Use subimage patterns: PROD-123_SubImage1.jpg, PROD-123[SubImage].jpg
✓ Short form: PROD-123_sub.jpg, PROD-123_sub-1.jpg
✓ Various separators: PROD-123-SubImage.jpg, PROD-123.SubImage.jpg
✗ Avoid: PROD-123[Detail].jpg (will be classified as asset)
```

**For assets (documents, videos, or non-gallery images):**
```
✓ Use asset patterns: PROD-123_Assets.pdf, PROD-123[Assets].jpg
✓ Or any other pattern: PROD-123[Detail1].jpg, PROD-123[Manual].pdf
✓ Generic suffixes: PROD-123_spec.docx, PROD-123_datasheet.xlsx
✗ Avoid subimage keywords: PROD-123_SubImage_Assets.jpg (will be sub-image)
```

### 2. Upload Strategy

**Recommended order:**
1. Upload all assets to Digital Assets first
2. **Name files using classification patterns (easiest)**
3. Then import products from Excel
4. System automatically classifies and assigns based on filenames
5. Verify attachments after import

**Naming strategies:**
- **Automatic (recommended):** Use classification patterns → No Excel config needed
- **Explicit keywords:** Use "SubImage", "Assets" in filenames for clarity
- **Consistent separators:** Stick to one separator type (_, -, [, etc.)

### 3. Excel Column Usage

**Zero-configuration approach (RECOMMENDED):**
- Required: `SKU`, `Name`
- Asset naming: Use classification patterns in Digital Assets
- System handles everything automatically based on filenames

**Manual control approach:**
- Add `imageUrl` column to override automatic main image
- Add `subImages` column for explicit image URLs
- Not needed if using filename classification

### 4. Testing Workflow

**Start small:**
1. Upload 2-3 test assets with different patterns
2. Import 2-3 test products
3. Verify automatic classification works correctly
4. Check main image, sub-images, and assets are assigned correctly
5. Scale up to full import

### 5. Classification Priority

Remember the classification order:
1. **Main Image** - Exact SKU or "image/main/primary/front" keywords
2. **Sub-Image** - "subimage" or "sub" keywords
3. **Asset** - "asset/assets" keywords or any other pattern (default)

---

## Troubleshooting

### Main Image Not Attached

**Check:**
1. ✓ Filename starts with exact SKU (e.g., `PROD-123.jpg`)
2. ✓ No "SubImage" or "Assets" keywords in filename
3. ✓ Asset is an image file format
4. ✓ Asset exists in Digital Assets for your user
5. ✓ Asset is not soft-deleted
6. ✓ No `imageUrl` column in Excel (would override automatic matching)

**Logs:**
```
[ProductService] Auto-attaching assets for SKU: PROD-123
[ProductService] Found exact match asset for main image: PROD-123.jpg
[ProductService] Set main image for product 456 to asset 123
```

### Sub-Images Not Attached

**For automatic filename-based classification:**
1. ✓ Filename contains "SubImage" or "sub" keyword (case-insensitive)
2. ✓ Filename starts with product SKU
3. ✓ Asset is an image file format
4. ✓ Asset exists in Digital Assets for your user
5. ✓ Asset is not soft-deleted

**Examples:**
```
✓ PROD-123_SubImage1.jpg    → Added to subImages
✓ PROD-123-sub.jpg          → Added to subImages
✗ PROD-123[Detail].jpg      → Classified as asset (no "sub" keyword)
```

**Logs:**
```
[ProductService] Classified asset as subimage: PROD-123_SubImage1.jpg
[ProductService] Adding to subImages: PROD-123_SubImage1.jpg
```
4. ✓ No typos in identifier name
5. ✓ Brackets are present: `[` and `]`

**Common mistakes:**
```
❌ PROD-123Detail1        (missing brackets)
❌ PROD-123[Detail 1]     (space in identifier)
❌ PROD-123[detail1       (missing closing bracket)
✅ PROD-123[Detail1]      (correct)
```

**Logs for automatic detection:**
```
[ProductService] Auto-scanning for SKU[Identifier] pattern assets for SKU: PROD-123
[ProductService] Found SKU pattern asset: PROD-123[Detail1] (PROD-123[Detail1])
[ProductService] Auto-attached asset 789 to product 456 via automatic pattern detection
[ProductService] Added 2 sub-images to product 456 via automatic SKU pattern scanning
[ProductService] Auto-scanning complete: attached 3 assets to product 456 for SKU: PROD-123
```

**Logs for Excel-based patterns:**
```
[ProductService] Found 2 SKU patterns in subImages: PROD-123[Detail1], PROD-123[Detail2]
[ProductService] Processing SKU pattern: PROD-123[Detail1]
[ProductService] Found matching asset: Detail1 (ID: 789, Type: image) for identifier: Detail1
[ProductService] Attached asset 789 to product 456
```

### Asset Not Found

**Check:**
1. ✓ Asset uploaded to Digital Assets library
2. ✓ Asset name matches identifier exactly (case-insensitive)
3. ✓ Asset belongs to the correct user
4. ✓ Asset not deleted

**Logs:**
```
[ProductService] No asset found matching identifier: MissingImage
```

**Solution:** Upload asset with correct name or fix identifier in Excel

### Pattern Not Detected

**Check:**
1. ✓ Brackets present: `SKU[Identifier]`
2. ✓ Identifier contains only alphanumeric, hyphens, underscores
3. ✓ No spaces in identifier
4. ✓ Column name is `subImages` or `imageUrl`

**Validation:**
```javascript
// Valid patterns
PROD-123[Image1]      ✅
SKU-ABC[Detail_1]     ✅
PRODUCT[Sub-Image]    ✅

// Invalid patterns
PROD-123[Image 1]     ❌ (space)
PROD-123[Image@1]     ❌ (special char)
PROD-123[            ❌ (incomplete)
```

---

## API Access

### Get Product with Assets

```http
GET /products/{productId}
```

**Response includes:**
```json
{
  "id": 123,
  "sku": "PROD-123",
  "name": "Product Name",
  "imageUrl": "/uploads/user123/PROD-123.jpg",
  "subImages": [
    "/uploads/user123/Detail1.jpg",
    "/uploads/user123/Detail2.jpg"
  ],
  "assets": [
    {
      "id": 456,
      "name": "PROD-123",
      "fileName": "PROD-123.jpg",
      "filePath": "/uploads/user123/PROD-123.jpg",
      "fileType": "image/jpeg"
    },
    {
      "id": 457,
      "name": "Manual",
      "fileName": "Manual.pdf",
      "filePath": "/uploads/user123/Manual.pdf",
      "fileType": "application/pdf"
    }
  ]
}
```

### Get All Product Assets

```http
GET /products/{productId}/assets
```

**Returns all attached assets including non-images**

---

## Performance Considerations

### Efficient Querying
- Assets queried once per product import
- In-memory filtering by identifier
- Duplicate attachment checks prevent redundancy

### Bulk Import
- Supports hundreds/thousands of products
- Pattern processing doesn't block import
- Failures logged but don't break import

### Optimization Tips
1. Clean up unused assets periodically
2. Use consistent naming conventions
3. Test with small batches first
4. Monitor logs during large imports

---

## Security & Permissions

### User Isolation
- Users can only access their own assets
- Assets scoped by userId in database
- No cross-user asset attachment possible

### Pattern Validation
- All patterns validated before processing
- Prevents injection attacks
- Invalid patterns logged and skipped

### Error Handling
- Missing assets don't break imports
- Errors logged with details
- Products created even if assets not found

---

## Summary

### Quick Reference

| Feature | Pattern Example | Classification | Automatic |
|---------|-----------------|----------------|-----------|
| Main Image | `SKU.jpg`, `SKU_image.jpg` | Main Image | ✅ Yes |
| Sub-Images | `SKU_SubImage.jpg`, `SKU[SubImage].jpg` | Sub-Image | ✅ Yes |
| Assets | `SKU_Assets.pdf`, `SKU[Detail].jpg` | Asset | ✅ Yes |

### Key Rules

1. **Main images:** Exact SKU match or "image/main/primary/front" keywords → Sets `product.mainImageUrl`
2. **Sub-images:** Contains "subimage" or "sub" keywords → Added to `product.subImages[]`
3. **Assets:** Contains "asset/assets" keywords OR default for other patterns → Attached to `product.assets[]`
4. **All file types supported:** Images, PDFs, videos, documents, etc.
5. **Case-insensitive matching:** `PROD-123` matches `prod-123.jpg`, `PROD-123_SubImage.jpg`
6. **Classification priority:** Main Image > Sub-Image > Asset
7. **Zero configuration:** Assets classified automatically based on filenames
8. **Error tolerant:** Missing or mismatched assets don't break imports

### Workflow

**Recommended Workflow (Filename-Based Classification):**
```
1. Upload assets to Digital Assets with classification patterns
   - Main: PROD-123.jpg or PROD-123_image.jpg
   - Sub: PROD-123_SubImage1.jpg, PROD-123_sub-front.jpg
   - Assets: PROD-123[Detail1].jpg, PROD-123_Assets.pdf

2. Create Excel
   - Required: SKU column only
   - No imageUrl or subImages columns needed

3. Import
   - System automatically classifies based on filenames
   - Main images → product.mainImageUrl
   - Sub-images → product.subImages[]
   - Assets → product.assets[]

4. Verify
   - Check product details
   - All assets classified and attached correctly
```

**Alternative Workflow (Manual URLs in Excel):**
```
1. Upload assets to Digital Assets
   - Any naming convention

2. Create Excel
   - Add: imageUrl column with main image URL
   - Add: subImages column with comma-separated URLs or JSON array

3. Import
   - System uses explicit URLs from Excel
   - Filename classification not used

4. Verify
   - Check product details
```

---

## See Also

- **[IMAGE_CLASSIFICATION_GUIDE.md](./IMAGE_CLASSIFICATION_GUIDE.md)** - Complete filename pattern classification rules
- **[IMAGE_UPLOAD_DURING_IMPORT.md](./IMAGE_UPLOAD_DURING_IMPORT.md)** - External image URL downloading
- **[SKU_PATTERN_QUICK_REFERENCE.md](./SKU_PATTERN_QUICK_REFERENCE.md)** - SKU pattern syntax reference
   - Access via API if needed
```

---

## Support & Logs

### Logging

All operations logged with `[ProductService]` prefix:
```
[ProductService] Auto-attaching assets for SKU: PROD-123
[ProductService] Found 1 exact match asset(s) for SKU: PROD-123
[ProductService] Processing 3 subImages for product 456
[ProductService] Found 2 SKU patterns in subImages
[ProductService] Attached asset 789 to product 456
```

### Debug Mode

Enable detailed logging for troubleshooting:
- Check backend console logs
- Look for warnings about missing assets
- Verify pattern detection messages
- Review attachment confirmations

---

**Version:** 1.0  
**Last Updated:** November 2025  
**Status:** Production Ready ✅
