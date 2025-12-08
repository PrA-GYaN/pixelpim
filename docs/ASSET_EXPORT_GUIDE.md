# Asset Export Feature Guide

## Overview

The Asset Export feature allows users to export assets in either JSON or XML format with flexible selection options. Users can export all assets, specific selected assets, or all assets within a folder (with or without subfolders).

---

## Table of Contents

1. [Export Formats](#export-formats)
2. [Export Types](#export-types)
3. [API Endpoint](#api-endpoint)
4. [Request Structure](#request-structure)
5. [Response Structure](#response-structure)
6. [Usage Examples](#usage-examples)
7. [Error Handling](#error-handling)
8. [Integration Guide](#integration-guide)

---

## Export Formats

The system supports two export formats:

### 1. JSON Format
- **Value**: `"json"`
- **Content-Type**: `application/json`
- **File Extension**: `.json`
- **Best For**: API integrations, data processing, web applications

### 2. XML Format
- **Value**: `"xml"`
- **Content-Type**: `application/xml`
- **File Extension**: `.xml`
- **Best For**: Legacy systems, enterprise integrations, structured data exchange

---

## Export Types

### 1. All Assets (`"all"`)
Exports every asset in the project that belongs to the authenticated user.

**Required Parameters**:
- `format`: Export format (json/xml)
- `type`: "all"

**Optional Parameters**: None

**Example**:
```json
{
  "format": "json",
  "type": "all"
}
```

---

### 2. Selected Assets (`"selected"`)
Exports only the assets manually selected by the user via their IDs.

**Required Parameters**:
- `format`: Export format (json/xml)
- `type`: "selected"
- `assetIds`: Array of asset IDs to export

**Example**:
```json
{
  "format": "json",
  "type": "selected",
  "assetIds": [1, 2, 3, 5, 8]
}
```

**Validation**:
- `assetIds` must be provided and cannot be empty
- All asset IDs must belong to the authenticated user
- Invalid IDs are silently ignored

---

### 3. Folder Assets (`"folder"`)
Exports all assets contained within a specific folder.

**Required Parameters**:
- `format`: Export format (json/xml)
- `type`: "folder"
- `assetGroupId`: ID of the folder/asset group

**Optional Parameters**:
- `includeSubfolders`: Boolean (default: false)
  - `false`: Export only assets in the specified folder
  - `true`: Export assets in the folder and all nested subfolders

**Example (Without Subfolders)**:
```json
{
  "format": "json",
  "type": "folder",
  "assetGroupId": 1,
  "includeSubfolders": false
}
```

**Example (With Subfolders)**:
```json
{
  "format": "xml",
  "type": "folder",
  "assetGroupId": 1,
  "includeSubfolders": true
}
```

---

### 4. Multiple Folders (`"multiple_folders"`)
Exports all assets contained within multiple selected folders.

**Required Parameters**:
- `format`: Export format (json/xml)
- `type`: "multiple_folders"
- `assetGroupIds`: Array of folder/asset group IDs

**Optional Parameters**:
- `includeSubfolders`: Boolean (default: false)
  - `false`: Export only assets directly in the specified folders
  - `true`: Export assets in all specified folders and their nested subfolders

**Example (Without Subfolders)**:
```json
{
  "format": "json",
  "type": "multiple_folders",
  "assetGroupIds": [1, 3, 5],
  "includeSubfolders": false
}
```

**Example (With Subfolders)**:
```json
{
  "format": "xml",
  "type": "multiple_folders",
  "assetGroupIds": [1, 2, 3],
  "includeSubfolders": true
}
```

**Validation**:
- `assetGroupIds` must be provided and cannot be empty
- All folder IDs must belong to the authenticated user
- Duplicate folders across hierarchy are automatically handled
- Invalid IDs are silently ignored

---

## API Endpoint

### Main Export Endpoint

```
POST /assets/export
```

**Authentication**: Required (JWT Bearer Token)

**Request Headers**:
```
Authorization: Bearer {your-jwt-token}
Content-Type: application/json
```

**Response Headers** (Auto-Generated):
- `Content-Type`: `application/json` or `application/xml`
- `Content-Disposition`: `attachment; filename="assets-export-{timestamp}.{format}"`

---

### Legacy Export Endpoint (Backward Compatibility)

```
GET /assets/export/json
```

**Query Parameters**:
- `assetGroupId` (optional): Filter by specific folder

**Note**: This endpoint only supports JSON format and basic folder filtering. Use the POST endpoint for full functionality.

---

## Request Structure

### DTO Definition

```typescript
export class ExportAssetsDto {
  format: 'json' | 'xml';                       // Required: Export format
  type: 'all' | 'selected' | 'folder' | 'multiple_folders'; // Required: Export type
  assetIds?: number[];                          // Optional: Required for 'selected' type
  assetGroupId?: number;                        // Optional: Required for 'folder' type
  assetGroupIds?: number[];                     // Optional: Required for 'multiple_folders' type
  includeSubfolders?: boolean;                  // Optional: For 'folder' and 'multiple_folders' types
}
```

### Validation Rules

1. **format**: Must be either "json" or "xml"
2. **type**: Must be "all", "selected", "folder", or "multiple_folders"
3. **assetIds**: 
   - Required when `type = "selected"`
   - Must be an array of integers
   - Cannot be empty
4. **assetGroupId**: 
   - Required when `type = "folder"`
   - Must be a valid integer
   - Must belong to the authenticated user
5. **assetGroupIds**: 
   - Required when `type = "multiple_folders"`
   - Must be an array of integers
   - Cannot be empty
   - Must belong to the authenticated user
6. **includeSubfolders**: 
   - Optional boolean
   - Only applicable when `type = "folder"` or `type = "multiple_folders"`

---

## Response Structure

### JSON Format Response

```json
{
  "totalAssets": 5,
  "exportDate": "2025-10-29T12:00:00.000Z",
  "exportType": "all",
  "assets": [
    {
      "id": "1",
      "name": "Product Image 1",
      "url": "https://res.cloudinary.com/...",
      "fileName": "product-1.jpg",
      "mimeType": "image/jpeg",
      "size": "2048576",
      "formattedSize": "2.00 MB",
      "uploadDate": "2025-01-15T10:30:00.000Z",
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z",
      "folder": {
        "id": "1",
        "name": "Product Images",
        "parentId": null
      }
    },
    // ... more assets
  ]
}
```

### XML Format Response

```xml
<?xml version="1.0" encoding="UTF-8"?>
<assetExport totalAssets="5" exportDate="2025-10-29T12:00:00.000Z">
  <assets>
    <asset>
      <id>1</id>
      <name>Product Image 1</name>
      <url>https://res.cloudinary.com/...</url>
      <fileName>product-1.jpg</fileName>
      <mimeType>image/jpeg</mimeType>
      <size>2048576</size>
      <formattedSize>2.00 MB</formattedSize>
      <uploadDate>2025-01-15T10:30:00.000Z</uploadDate>
      <createdAt>2025-01-15T10:30:00.000Z</createdAt>
      <updatedAt>2025-01-15T10:30:00.000Z</updatedAt>
      <folder>
        <id>1</id>
        <name>Product Images</name>
        <parentId></parentId>
      </folder>
    </asset>
    <!-- ... more assets -->
  </assets>
</assetExport>
```

---

## Usage Examples

### Example 1: Export All Assets as JSON

```bash
curl -X POST http://localhost:3000/assets/export \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "json",
    "type": "all"
  }'
```

---

### Example 2: Export Selected Assets as XML

```bash
curl -X POST http://localhost:3000/assets/export \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "xml",
    "type": "selected",
    "assetIds": [1, 3, 5, 7, 9]
  }'
```

---

### Example 3: Export Folder with Subfolders as JSON

```bash
curl -X POST http://localhost:3000/assets/export \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "json",
    "type": "folder",
    "assetGroupId": 1,
    "includeSubfolders": true
  }'
```

---

### Example 4: Export Multiple Folders with Subfolders as XML

```bash
curl -X POST http://localhost:3000/assets/export \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "xml",
    "type": "multiple_folders",
    "assetGroupIds": [1, 2, 3],
    "includeSubfolders": true
  }'
```

---

### Example 5: JavaScript/TypeScript Usage

```typescript
async function exportAssets(
  format: 'json' | 'xml',
  type: 'all' | 'selected' | 'folder' | 'multiple_folders',
  options?: {
    assetIds?: number[];
    assetGroupId?: number;
    assetGroupIds?: number[];
    includeSubfolders?: boolean;
  }
) {
  const response = await fetch('http://localhost:3000/assets/export', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${yourToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      format,
      type,
      ...options,
    }),
  });

  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`);
  }

  // For JSON
  if (format === 'json') {
    const data = await response.json();
    return data;
  }

  // For XML
  const text = await response.text();
  return text;
}

// Usage examples
const allAssetsJson = await exportAssets('json', 'all');

const selectedAssetsXml = await exportAssets('xml', 'selected', {
  assetIds: [1, 2, 3],
});

const folderAssetsJson = await exportAssets('json', 'folder', {
  assetGroupId: 1,
  includeSubfolders: true,
});

const multipleFoldersXml = await exportAssets('xml', 'multiple_folders', {
  assetGroupIds: [1, 3, 5],
  includeSubfolders: true,
});
```

---

## Error Handling

### Common Errors

#### 1. Missing Required Parameters

**Error**: `Asset IDs are required for selected export type`

**Status Code**: 400 Bad Request

**Cause**: Using `type: "selected"` without providing `assetIds`

**Solution**: Include `assetIds` array in the request

---

#### 2. Missing Asset Group ID

**Error**: `Asset group ID is required for folder export type`

**Status Code**: 400 Bad Request

**Cause**: Using `type: "folder"` without providing `assetGroupId`

**Solution**: Include `assetGroupId` in the request

---

#### 3. No Assets Found

**Error**: `No assets found matching the criteria`

**Status Code**: 404 Not Found

**Cause**: 
- No assets exist for the given criteria
- Asset IDs don't belong to the user
- Folder is empty
- Selected folders contain no assets

**Solution**: Verify the export criteria and asset ownership

---

#### 4. Missing Multiple Folder IDs

**Error**: `Asset group IDs are required for multiple folders export type`

**Status Code**: 400 Bad Request

**Cause**: Using `type: "multiple_folders"` without providing `assetGroupIds`

**Solution**: Include `assetGroupIds` array in the request

---

#### 5. Invalid Export Type

**Error**: `Invalid export type`

**Status Code**: 400 Bad Request

**Cause**: `type` is not one of: "all", "selected", "folder", "multiple_folders"

**Solution**: Use a valid export type

---

#### 6. Validation Errors

**Status Code**: 400 Bad Request

**Common Validation Errors**:
- `format must be one of the following values: json, xml`
- `type must be one of the following values: all, selected, folder, multiple_folders`
- `each value in assetIds must be an integer number`
- `assetGroupId must be an integer number`
- `each value in assetGroupIds must be an integer number`

**Solution**: Ensure all fields match the required types and values

---

## Integration Guide

### Frontend Integration (React Example)

```typescript
import { useState } from 'react';

interface ExportOptions {
  format: 'json' | 'xml';
  type: 'all' | 'selected' | 'folder';
  assetIds?: number[];
  assetGroupId?: number;
  includeSubfolders?: boolean;
}

export function AssetExportButton() {
  const [loading, setLoading] = useState(false);

  const exportAssets = async (options: ExportOptions) => {
    setLoading(true);
    try {
      const response = await fetch('/api/assets/export', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition?.split('filename=')[1]?.replace(/"/g, '') 
        || `export.${options.format}`;

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      alert('Export successful!');
    } catch (error) {
      alert('Export failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button 
        onClick={() => exportAssets({ format: 'json', type: 'all' })}
        disabled={loading}
      >
        Export All as JSON
      </button>
      <button 
        onClick={() => exportAssets({ format: 'xml', type: 'all' })}
        disabled={loading}
      >
        Export All as XML
      </button>
      <button 
        onClick={() => exportAssets({ 
          format: 'json', 
          type: 'multiple_folders',
          assetGroupIds: [1, 2, 3],
          includeSubfolders: true 
        })}
        disabled={loading}
      >
        Export Multiple Folders with Subfolders
      </button>
    </div>
  );
}
```

---

### Backend Service Usage

```typescript
import { AssetService } from './asset.service';
import { ExportAssetsDto, ExportFormat, ExportType } from './dto';

// Inject the service
constructor(private assetService: AssetService) {}

// Export all assets as JSON
async exportAllAsJson(userId: number) {
  const exportDto: ExportAssetsDto = {
    format: ExportFormat.JSON,
    type: ExportType.ALL,
  };
  return await this.assetService.exportAssets(userId, exportDto);
}

// Export selected assets as XML
async exportSelectedAsXml(userId: number, assetIds: number[]) {
  const exportDto: ExportAssetsDto = {
    format: ExportFormat.XML,
    type: ExportType.SELECTED,
    assetIds,
  };
  return await this.assetService.exportAssets(userId, exportDto);
}

// Export folder with subfolders
async exportFolderWithSubfolders(userId: number, folderId: number) {
  const exportDto: ExportAssetsDto = {
    format: ExportFormat.JSON,
    type: ExportType.FOLDER,
    assetGroupId: folderId,
    includeSubfolders: true,
  };
  return await this.assetService.exportAssets(userId, exportDto);
}

// Export multiple folders with subfolders
async exportMultipleFoldersWithSubfolders(userId: number, folderIds: number[]) {
  const exportDto: ExportAssetsDto = {
    format: ExportFormat.XML,
    type: ExportType.MULTIPLE_FOLDERS,
    assetGroupIds: folderIds,
    includeSubfolders: true,
  };
  return await this.assetService.exportAssets(userId, exportDto);
}
```

---

## Performance Considerations

1. **Large Exports**: For very large datasets, consider:
   - Implementing pagination
   - Adding background job processing
   - Providing a download link instead of direct response

2. **Subfolder Recursion**: When `includeSubfolders: true`, the system recursively fetches all descendant folders. Deep hierarchies may impact performance.

3. **Multiple Folders**: When exporting multiple folders with subfolders, the system:
   - Recursively fetches descendants for each selected folder
   - Automatically deduplicates folder IDs to avoid redundant queries
   - May process many folders if deep hierarchies are selected

4. **Caching**: Consider caching export results for frequently requested combinations.

5. **File Size**: XML exports are typically 2-3x larger than JSON due to verbose tag structure.

---

## Security Considerations

1. **Authentication**: All export endpoints require JWT authentication
2. **Authorization**: Users can only export their own assets
3. **Rate Limiting**: Consider implementing rate limits for export endpoints
4. **Data Sensitivity**: Exported files contain asset URLs and metadata - ensure secure handling

---

## Future Enhancements

Potential improvements for future versions:

1. **Additional Formats**: CSV, Excel, PDF
2. **Custom Field Selection**: Allow users to choose which fields to include
3. **Compression**: ZIP file downloads for large exports
4. **Scheduled Exports**: Automated periodic exports
5. **Email Delivery**: Send export file via email
6. **Filters**: Apply additional filters (date range, file type, etc.)
7. **Templates**: Save and reuse export configurations
8. **Webhooks**: Trigger exports via webhooks

---

## Support and Troubleshooting

### Common Issues

**Issue**: Export returns empty result
- **Solution**: Verify assets exist and belong to authenticated user

**Issue**: Folder export doesn't include expected assets
- **Solution**: Check `includeSubfolders` flag and folder hierarchy

**Issue**: Multiple folders export has duplicates or missing assets
- **Solution**: 
  - System automatically handles duplicate folders in hierarchy
  - Verify all folder IDs are valid and belong to the user
  - Check if `includeSubfolders` is set correctly

**Issue**: XML export has encoding issues
- **Solution**: Ensure proper UTF-8 encoding is maintained throughout

**Issue**: Large exports timeout
- **Solution**: Reduce export scope or contact support for batch processing

---

## Changelog

### Version 1.0.0 (Initial Release)
- JSON and XML export formats
- Four export types: all, selected, folder, multiple_folders
- Subfolder inclusion option for folder and multiple_folders types
- Automatic deduplication of folders in multiple_folders export
- Legacy endpoint for backward compatibility
- Comprehensive error handling

---

## Contact

For questions, issues, or feature requests, please contact the development team or create an issue in the project repository.
