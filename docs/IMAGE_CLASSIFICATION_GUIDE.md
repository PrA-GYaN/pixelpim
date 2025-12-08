# Image Classification System - Complete Guide

## Overview

The Image Classification System automatically categorizes product images based on their filenames, determining whether each image should be:
- **Main Image** (`product.mainImageUrl`)
- **Sub-Image** (`product.subImages[]`)
- **Asset** (`product.assets[]`)

This guide provides complete rules, examples, and best practices for naming your image files.

---

## Classification Rules

### Rule 1: Main Image (product.mainImageUrl)

**Purpose:** Primary product image displayed prominently on product pages

**Matching Patterns:**

| Pattern | Example | Description |
|---------|---------|-------------|
| `SKU.ext` | `PROD-123.jpg` | Exact SKU match |
| `SKU_image.ext` | `PROD-123_image.png` | SKU + "image" with underscore |
| `SKU-image.ext` | `PROD-123-image.jpg` | SKU + "image" with hyphen |
| `SKU.image.ext` | `PROD-123.image.webp` | SKU + "image" with dot |
| `SKU_main.ext` | `PROD-123_main.jpg` | SKU + "main" |
| `SKU_primary.ext` | `PROD-123_primary.png` | SKU + "primary" |
| `SKU_front.ext` | `PROD-123_front.jpg` | SKU + "front" |
| `SKU.<anything>.ext` | `PROD-123.hero.jpg` | SKU + dot + text + extension |

**Key Points:**
- ✅ Case-insensitive matching
- ✅ Automatically sets `product.mainImageUrl`
- ❌ **NOT** added to `product.assets[]`
- ✅ Only image file extensions supported
- ✅ Highest classification priority

**Complete Examples:**

```
Product SKU: TPE-3

✓ CLASSIFIED AS MAIN IMAGE:
  TPE-3.jpg              → Exact match
  TPE-3_image.png        → Image suffix
  TPE-3-image.jpeg       → Image suffix (hyphen)
  TPE-3.image.gif        → Image suffix (dot)
  TPE-3_main.webp        → Main suffix
  TPE-3_primary.jpg      → Primary suffix
  TPE-3_front.bmp        → Front suffix
  tpe-3.jpg              → Case insensitive
  TPE-3.hero.jpg         → Dot separator pattern

✗ NOT MAIN IMAGE:
  TPE-3_SubImage.jpg     → Contains "subimage"
  TPE-3_Assets.jpg       → Contains "assets"
  TPE-3[Detail].jpg      → No main image keyword
  TPE-3_back.jpg         → "back" not a main keyword
```

---

### Rule 2: Sub-Images (product.subImages[])

**Purpose:** Additional product images shown in gallery/carousel (e.g., alternate angles, details)

**Matching Patterns:**

| Pattern | Example | Description |
|---------|---------|-------------|
| `SKU_SubImage.ext` | `PROD-123_SubImage.jpg` | SKU + "SubImage" with underscore |
| `SKU_subimage.ext` | `PROD-123_subimage.png` | SKU + "subimage" (lowercase) |
| `SKU SubImage.ext` | `PROD-123 SubImage.jpg` | SKU + "SubImage" with space |
| `SKU-SubImage.ext` | `PROD-123-SubImage.webp` | SKU + "SubImage" with hyphen |
| `SKU.SubImage.ext` | `PROD-123.SubImage.gif` | SKU + "SubImage" with dot |
| `SKU[SubImage].ext` | `PROD-123[SubImage].jpg` | SKU + "SubImage" in brackets |
| `SKU_sub.ext` | `PROD-123_sub.jpg` | SKU + "sub" |
| `SKU_sub-1.ext` | `PROD-123_sub-1.png` | SKU + "sub" with numbering |

**Keywords (Case-Insensitive):**
- `subimage`
- `sub-image`
- `sub_image`
- `sub`

**Key Points:**
- ✅ Case-insensitive keyword matching
- ✅ Normalizes spaces, hyphens, underscores, brackets
- ✅ Added to `product.subImages[]` array
- ❌ **NOT** added to `product.assets[]` (avoids duplication)
- ✅ Medium classification priority

**Complete Examples:**

```
Product SKU: PROD-456

✓ CLASSIFIED AS SUB-IMAGE:
  PROD-456_SubImage.jpg       → Underscore separator
  PROD-456_subimage1.png      → Lowercase with number
  PROD-456 SubImage.jpg       → Space separator
  PROD-456-SubImage2.webp     → Hyphen separator with number
  PROD-456.SubImage.jpeg      → Dot separator
  PROD-456[SubImage].jpg      → Bracket notation
  PROD-456_sub.gif            → Short form "sub"
  PROD-456-sub-1.png          → Short form with numbering
  PROD-456_Sub_Image.jpg      → Variations with underscores
  prod-456_SUBIMAGE.bmp       → Case variations

✗ NOT SUB-IMAGE:
  PROD-456.jpg               → Main image (exact match)
  PROD-456_image.jpg         → Main image pattern
  PROD-456_Assets.jpg        → Asset pattern
  PROD-456[Detail].jpg       → No "sub" keyword
  PROD-456_photo.jpg         → No "sub" keyword
```

---

### Rule 3: Assets (product.assets[])

**Purpose:** Additional files (PDFs, videos, technical docs) OR images that should only appear in assets list

**Matching Patterns:**

| Pattern | Example | Description |
|---------|---------|-------------|
| `SKU_Assets.ext` | `PROD-123_Assets.pdf` | SKU + "Assets" with underscore |
| `SKU_assets.ext` | `PROD-123_assets.zip` | SKU + "assets" (lowercase) |
| `SKU Assets.ext` | `PROD-123 Assets.mp4` | SKU + "Assets" with space |
| `SKU-Assets.ext` | `PROD-123-Assets.docx` | SKU + "Assets" with hyphen |
| `SKU[Assets].ext` | `PROD-123[Assets].jpg` | SKU + "Assets" in brackets |
| `SKU[Detail].ext` | `PROD-123[Detail].jpg` | Default: Any other pattern |
| `SKU[Manual].ext` | `PROD-123[Manual].pdf` | Default: Any other pattern |
| `SKU_spec.ext` | `PROD-123_spec.docx` | Default: Any other pattern |

**Keywords (Case-Insensitive):**
- `asset`
- `assets`

**Default Classification:**
- Any filename pattern that doesn't match main image or sub-image rules

**Key Points:**
- ✅ Case-insensitive keyword matching
- ✅ Supports **all file types** (images, PDFs, videos, documents, etc.)
- ✅ Attached to `product.assets[]` only
- ❌ **NOT** set as main image
- ❌ **NOT** added to subImages
- ✅ Default/lowest classification priority

**Complete Examples:**

```
Product SKU: SKU-789

✓ CLASSIFIED AS ASSET:
  SKU-789_Assets.jpg          → "Assets" keyword (image)
  SKU-789_asset1.pdf          → "asset" keyword (document)
  SKU-789 Assets.mp4          → "Assets" keyword (video)
  SKU-789-Assets.zip          → "Assets" keyword (archive)
  SKU-789[Assets].png         → "Assets" keyword (bracket)
  SKU-789[Detail1].jpg        → Default classification
  SKU-789[Manual].pdf         → Default classification
  SKU-789[Video].mp4          → Default classification
  SKU-789_spec.docx           → Default classification
  SKU-789_datasheet.xlsx      → Default classification
  sku-789_ASSETS.gif          → Case insensitive

✗ NOT ASSET (classified differently):
  SKU-789.jpg                 → Main image
  SKU-789_image.jpg           → Main image
  SKU-789_SubImage.jpg        → Sub-image
  SKU-789_sub.jpg             → Sub-image
```

---

## Classification Priority Order

When a filename could potentially match multiple patterns, the system applies classification in this order:

1. **Main Image** (Highest Priority)
   - Exact SKU match
   - Contains "image", "main", "primary", "front" keywords

2. **Sub-Image** (Medium Priority)
   - Contains "subimage", "sub-image", "sub_image", or "sub" keywords

3. **Asset** (Default Priority)
   - Contains "asset" or "assets" keywords
   - OR any other pattern that doesn't match above rules

---

## Separators and Normalization

The system recognizes these separators between SKU and suffix:

| Separator | Example | Notes |
|-----------|---------|-------|
| Underscore `_` | `PROD-123_image.jpg` | Most common |
| Hyphen `-` | `PROD-123-image.jpg` | Also common |
| Space ` ` | `PROD-123 image.jpg` | Normalized |
| Dot `.` | `PROD-123.image.jpg` | Normalized |
| Bracket `[` | `PROD-123[image].jpg` | Special notation |

**Normalization Process:**
1. Trim whitespace from filename
2. Remove file extension
3. Convert to lowercase for comparison
4. Check for SKU match at the beginning
5. Identify separator and extract suffix
6. Apply classification rules to suffix

---

## Best Practices

### Naming Conventions

**✅ RECOMMENDED:**

```
Main Images:
  PROD-123.jpg
  PROD-123_image.png
  PROD-123_main.webp

Sub-Images:
  PROD-123_SubImage1.jpg
  PROD-123_SubImage2.png
  PROD-123_sub-front.jpg
  PROD-123_sub-back.webp

Assets:
  PROD-123[Detail1].jpg
  PROD-123[Manual].pdf
  PROD-123_spec.docx
  PROD-123[Video].mp4
```

**❌ AVOID:**

```
Ambiguous patterns:
  PROD123_image.jpg          → Missing hyphen in SKU
  PROD-123image.jpg          → No separator
  PROD-123_img.jpg           → "img" not recognized
  PROD-123_picture.jpg       → "picture" not recognized

Non-matching patterns:
  image_PROD-123.jpg         → SKU not at start
  123-PROD_image.jpg         → Wrong SKU format
  Product-123_image.jpg      → Different SKU
```

### Consistency Tips

1. **Use consistent separators** across all your files (e.g., always use underscore)
2. **Be explicit** with keywords: use "SubImage" not "Sub-Img"
3. **Number sequentially** for multiple items: `_SubImage1`, `_SubImage2`, etc.
4. **Match your SKU format exactly** at the start of filenames
5. **Use lowercase extensions** for consistency: `.jpg` not `.JPG`

---

## Complete Workflow Example

### Scenario: Importing a new product with multiple images

**1. Product SKU:** `WATCH-2024`

**2. Files to Upload:**

```
Main image:
  ✓ WATCH-2024.jpg                    → Sets product.mainImageUrl

Sub-images for gallery:
  ✓ WATCH-2024_SubImage1.jpg          → Added to product.subImages[]
  ✓ WATCH-2024_SubImage2.jpg          → Added to product.subImages[]
  ✓ WATCH-2024_sub-closeup.jpg        → Added to product.subImages[]

Additional assets:
  ✓ WATCH-2024[Detail-Dial].jpg       → Added to product.assets[]
  ✓ WATCH-2024[Manual].pdf            → Added to product.assets[]
  ✓ WATCH-2024_spec.docx              → Added to product.assets[]
```

**3. Result After Import:**

```json
{
  "id": 1,
  "sku": "WATCH-2024",
  "name": "Smart Watch 2024",
  "mainImageUrl": "/assets/uploads/WATCH-2024.jpg",
  "subImages": [
    "/assets/uploads/WATCH-2024_SubImage1.jpg",
    "/assets/uploads/WATCH-2024_SubImage2.jpg",
    "/assets/uploads/WATCH-2024_sub-closeup.jpg"
  ],
  "assets": [
    {
      "id": 101,
      "name": "Detail-Dial",
      "filePath": "/assets/uploads/WATCH-2024[Detail-Dial].jpg"
    },
    {
      "id": 102,
      "name": "Manual",
      "filePath": "/assets/uploads/WATCH-2024[Manual].pdf"
    },
    {
      "id": 103,
      "name": "spec",
      "filePath": "/assets/uploads/WATCH-2024_spec.docx"
    }
  ]
}
```

---

## Troubleshooting

### Issue: Image not classified as expected

**Check:**
1. ✓ Filename starts with exact SKU (case-insensitive)
2. ✓ Valid separator used after SKU
3. ✓ Correct keyword in suffix
4. ✓ No typos in SKU or keywords
5. ✓ File extension is supported

### Issue: Main image not set

**Common causes:**
- Filename doesn't match SKU exactly
- Extra characters between SKU and extension
- Wrong separator used
- Product already has a mainImageUrl

### Issue: Sub-images not appearing in gallery

**Common causes:**
- Filename doesn't contain "sub" or "subimage"
- File is not an image type
- Typo in "subimage" keyword
- SKU mismatch

### Issue: Asset attached but not displayed

**This is expected behavior!**
- Assets are attached to `product.assets[]`
- Non-image assets (PDFs, videos) won't display as images
- Image assets classified as "assets" won't appear in subImages

---

## Testing Your Filenames

Use this quick test to verify classification:

```typescript
import { ImageClassificationHelper, ImageClassificationType } from '../utils/image-classification.helper';

// Test your filename
const result = ImageClassificationHelper.classifyImage('PROD-123_SubImage.jpg', 'PROD-123');

console.log(result.type);  
// Output: ImageClassificationType.SUB_IMAGE

// Test multiple files
const filenames = [
  'PROD-123.jpg',
  'PROD-123_SubImage1.jpg',
  'PROD-123[Manual].pdf'
];

const classifications = ImageClassificationHelper.classifyImages(filenames, 'PROD-123');
const grouped = ImageClassificationHelper.groupByType(classifications);

console.log('Main Images:', grouped.mainImages.length);      // 1
console.log('Sub-Images:', grouped.subImages.length);        // 1
console.log('Assets:', grouped.assets.length);               // 1
```

---

## API Reference

### ImageClassificationHelper

```typescript
// Classify a single image
classifyImage(filename: string, sku: string): ImageClassificationResult

// Classify multiple images
classifyImages(filenames: string[], sku: string): ImageClassificationResult[]

// Group classifications by type
groupByType(classifications: ImageClassificationResult[]): GroupedClassifications

// Quick checks
isMainImage(filename: string, sku: string): boolean
isSubImage(filename: string, sku: string): boolean
isAsset(filename: string, sku: string): boolean
```

### ImageClassificationType Enum

```typescript
enum ImageClassificationType {
  MAIN_IMAGE = 'main',
  SUB_IMAGE = 'subimage',
  ASSET = 'asset',
  NONE = 'none'
}
```

---

## Summary

### Quick Reference Table

| Classification | Keywords | Example | Result |
|----------------|----------|---------|--------|
| Main Image | Exact match, "image", "main", "primary", "front" | `SKU.jpg`, `SKU_image.jpg` | `product.mainImageUrl` |
| Sub-Image | "subimage", "sub" | `SKU_SubImage.jpg`, `SKU[SubImage].jpg` | `product.subImages[]` |
| Asset | "asset", "assets", or default | `SKU_Assets.pdf`, `SKU[Detail].jpg` | `product.assets[]` |

### Key Rules

1. ✅ **Case-insensitive** matching for all patterns
2. ✅ **Filename must start with SKU** (exact match)
3. ✅ **Separators normalized** (_, -, space, ., [)
4. ✅ **Priority order:** Main > Sub > Asset
5. ✅ **Default classification:** Asset (for unmatched patterns)
6. ❌ **No duplication:** Images classified once only

---

**Last Updated:** November 23, 2025
