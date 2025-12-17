# Multi-WooCommerce Integration API Documentation

## Overview

This document provides comprehensive documentation for the Multi-WooCommerce Integration feature, which allows users to connect multiple WooCommerce stores, configure field mappings for import/export operations, and perform selective field updates.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Connection Management](#connection-management)
3. [Export Mapping Configuration](#export-mapping-configuration)
4. [Import Mapping Configuration](#import-mapping-configuration)
5. [Product Sync Operations](#product-sync-operations)
6. [Use Cases & Examples](#use-cases--examples)
7. [Error Handling](#error-handling)
8. [Migration Guide](#migration-guide)

---

## Getting Started

### Prerequisites

- Valid WooCommerce REST API credentials (Consumer Key and Consumer Secret)
- WooCommerce store with REST API enabled
- User account with appropriate permissions (`integration` resource with `create`, `read`, `update`, `delete`, `export`, `import` actions)

### Authentication

All endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Base URL

```
POST   /integration/woocommerce/connections
GET    /integration/woocommerce/connections
PUT    /integration/woocommerce/connections/:connectionId
DELETE /integration/woocommerce/connections/:connectionId
```

---

## Connection Management

### 1. Create a New Connection

**Endpoint:** `POST /integration/woocommerce/connections`

**Description:** Creates a new WooCommerce store connection for the authenticated user.

**Request Body:**

```json
{
  "storeName": "My Main Store",
  "storeUrl": "https://mystore.com",
  "consumerKey": "ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "consumerSecret": "cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "webhookSecret": "optional_webhook_secret",
  "isDefault": true
}
```

**Field Descriptions:**

- `storeName` (required): User-friendly name for the store
- `storeUrl` (required): Full URL of the WooCommerce store
- `consumerKey` (required): WooCommerce API consumer key (minimum 10 characters)
- `consumerSecret` (required): WooCommerce API consumer secret (minimum 10 characters)
- `webhookSecret` (optional): Secret for webhook validation
- `isDefault` (optional): Set as default connection (default: `false`)

**Response:** `201 Created`

```json
{
  "id": 1,
  "storeName": "My Main Store",
  "storeUrl": "https://mystore.com",
  "isActive": true,
  "isDefault": true,
  "lastSyncedAt": null,
  "createdAt": "2025-12-11T10:00:00.000Z",
  "updatedAt": "2025-12-11T10:00:00.000Z"
}
```

**Notes:**
- If `isDefault` is set to `true`, any other default connection will be automatically unset
- Sensitive credentials (consumerKey, consumerSecret, webhookSecret) are not returned in the response

---

### 2. Get All Connections

**Endpoint:** `GET /integration/woocommerce/connections`

**Description:** Retrieves all WooCommerce connections for the authenticated user.

**Response:** `200 OK`

```json
[
  {
    "id": 1,
    "storeName": "My Main Store",
    "storeUrl": "https://mystore.com",
    "isActive": true,
    "isDefault": true,
    "lastSyncedAt": "2025-12-11T10:30:00.000Z",
    "createdAt": "2025-12-11T10:00:00.000Z",
    "updatedAt": "2025-12-11T10:30:00.000Z"
  },
  {
    "id": 2,
    "storeName": "Secondary Store",
    "storeUrl": "https://store2.com",
    "isActive": true,
    "isDefault": false,
    "lastSyncedAt": null,
    "createdAt": "2025-12-11T11:00:00.000Z",
    "updatedAt": "2025-12-11T11:00:00.000Z"
  }
]
```

**Notes:**
- Results are ordered by default status (descending) and creation date (descending)

---

### 3. Get Default Connection

**Endpoint:** `GET /integration/woocommerce/connections/default`

**Description:** Retrieves the default WooCommerce connection. If no default is set, returns the most recently created active connection.

**Response:** `200 OK`

```json
{
  "id": 1,
  "storeName": "My Main Store",
  "storeUrl": "https://mystore.com",
  "isActive": true,
  "isDefault": true,
  "lastSyncedAt": "2025-12-11T10:30:00.000Z",
  "createdAt": "2025-12-11T10:00:00.000Z",
  "updatedAt": "2025-12-11T10:30:00.000Z"
}
```

**Error Responses:**
- `404 Not Found`: No active connections found

---

### 4. Get Specific Connection

**Endpoint:** `GET /integration/woocommerce/connections/:connectionId`

**Description:** Retrieves details of a specific connection by ID.

**Path Parameters:**
- `connectionId` (integer): The connection ID

**Response:** `200 OK`

```json
{
  "id": 1,
  "storeName": "My Main Store",
  "storeUrl": "https://mystore.com",
  "isActive": true,
  "isDefault": true,
  "lastSyncedAt": "2025-12-11T10:30:00.000Z",
  "createdAt": "2025-12-11T10:00:00.000Z",
  "updatedAt": "2025-12-11T10:30:00.000Z"
}
```

**Error Responses:**
- `404 Not Found`: Connection not found or doesn't belong to user

---

### 5. Update Connection

**Endpoint:** `PUT /integration/woocommerce/connections/:connectionId`

**Description:** Updates an existing WooCommerce connection.

**Path Parameters:**
- `connectionId` (integer): The connection ID

**Request Body:** (All fields optional)

```json
{
  "storeName": "Updated Store Name",
  "storeUrl": "https://newurl.com",
  "consumerKey": "ck_new_key",
  "consumerSecret": "cs_new_secret",
  "webhookSecret": "new_webhook_secret",
  "isActive": true,
  "isDefault": true
}
```

**Response:** `200 OK`

```json
{
  "id": 1,
  "storeName": "Updated Store Name",
  "storeUrl": "https://newurl.com",
  "isActive": true,
  "isDefault": true,
  "lastSyncedAt": "2025-12-11T10:30:00.000Z",
  "createdAt": "2025-12-11T10:00:00.000Z",
  "updatedAt": "2025-12-11T12:00:00.000Z"
}
```

**Error Responses:**
- `404 Not Found`: Connection not found

---

### 6. Delete Connection

**Endpoint:** `DELETE /integration/woocommerce/connections/:connectionId`

**Description:** Deletes a WooCommerce connection. This will also delete all associated mappings and sync records.

**Path Parameters:**
- `connectionId` (integer): The connection ID

**Response:** `204 No Content`

**Error Responses:**
- `404 Not Found`: Connection not found

---

### 7. Test Connection

**Endpoint:** `POST /integration/woocommerce/connections/test`

**Description:** Tests WooCommerce API credentials before creating a connection.

**Request Body:**

```json
{
  "storeUrl": "https://mystore.com",
  "consumerKey": "ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "consumerSecret": "cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

**Response:** `200 OK`

**Success:**

```json
{
  "success": true,
  "message": "Connection successful",
  "storeInfo": {
    "wpVersion": "6.4.2",
    "wooVersion": "8.5.1",
    "storeName": "My Store"
  }
}
```

**Failure:**

```json
{
  "success": false,
  "message": "Failed to connect to WooCommerce store: Invalid credentials"
}
```

---

## Export Mapping Configuration

Export mappings allow you to configure which fields should be exported to WooCommerce and how internal fields map to WooCommerce fields.

### 8. Create Export Mapping

**Endpoint:** `POST /integration/woocommerce/connections/:connectionId/export-mappings`

**Description:** Creates a new export mapping configuration for a connection.

**Path Parameters:**
- `connectionId` (integer): The connection ID

**Request Body:**

```json
{
  "connectionId": 1,
  "selectedFields": ["name", "sku", "description", "price", "images", "COLOR", "Dimension"],
  "fieldMappings": {
    "price": "regular_price",
    "COLOR": "pa_color",
    "Dimension": "pa_dimension"
  }
}
```

**Field Descriptions:**

- `connectionId` (required): Connection ID (will be set from path parameter)
- `selectedFields` (required): Array of fields to export. Must include "name" and "sku"
- `fieldMappings` (optional): Object mapping internal field names to WooCommerce attribute names

**Available Fields:**

**Standard Fields:**
- `name` (required): Product name
- `sku` (required): Product SKU
- `description`: Product description
- `status`: Product status
- `images`: Product images
- `categories`: Product categories
- `tags`: Product tags
- `price`: Regular price
- `sale_price`: Sale price
- `weight`: Product weight
- `dimensions`: Product dimensions (length, width, height)
- `stock_status`: Stock status

**Individual Attributes:** Any attribute name from your product attributes, e.g.:
- `COLOR`: Product color
- `Dimension`: Product dimensions
- `Size`: Product size
- `Material`: Product material
- etc.

**Notes:**
- Individual attributes are exported as WooCommerce product attributes
- Mapped attributes (like `price`, `weight`) are exported to WooCommerce core fields
- Only selected fields will be included in the export payload

**Response:** `201 Created`

```json
{
  "id": 1,
  "connectionId": 1,
  "selectedFields": ["name", "sku", "description", "price", "images", "COLOR", "Dimension"],
  "fieldMappings": {
    "price": "regular_price",
    "COLOR": "pa_color",
    "Dimension": "pa_dimension"
  },
  "isActive": true,
  "createdAt": "2025-12-11T10:00:00.000Z",
  "updatedAt": "2025-12-11T10:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request`: Required fields (name, sku) not included
- `404 Not Found`: Connection not found

---

### 9. Get Export Mappings

**Endpoint:** `GET /integration/woocommerce/connections/:connectionId/export-mappings`

**Description:** Retrieves all export mappings for a connection.

**Path Parameters:**
- `connectionId` (integer): The connection ID

**Response:** `200 OK`

```json
[
  {
    "id": 1,
    "connectionId": 1,
    "selectedFields": ["name", "sku", "description", "price", "COLOR", "Dimension"],
    "fieldMappings": {
      "price": "regular_price"
    },
    "isActive": true,
    "createdAt": "2025-12-11T10:00:00.000Z",
    "updatedAt": "2025-12-11T10:00:00.000Z"
  }
]
```

---

### 10. Get Active Export Mapping

**Endpoint:** `GET /integration/woocommerce/connections/:connectionId/export-mappings/active`

**Description:** Retrieves the currently active export mapping for a connection.

**Path Parameters:**
- `connectionId` (integer): The connection ID

**Response:** `200 OK`

```json
{
  "id": 1,
  "connectionId": 1,
  "selectedFields": ["name", "sku", "description", "price", "COLOR", "Dimension"],
  "fieldMappings": {
    "price": "regular_price"
  },
  "isActive": true,
  "createdAt": "2025-12-11T10:00:00.000Z",
  "updatedAt": "2025-12-11T10:00:00.000Z"
}
```

**Notes:**
- Returns `null` if no active mapping exists

---

### 11. Update Export Mapping

**Endpoint:** `PUT /integration/woocommerce/connections/export-mappings/:mappingId`

**Description:** Updates an existing export mapping.

**Path Parameters:**
- `mappingId` (integer): The mapping ID

**Request Body:** (All fields optional)

```json
{
  "selectedFields": ["name", "sku", "price", "images", "COLOR"],
  "fieldMappings": {
    "price": "regular_price",
    "COLOR": "pa_color"
  },
  "isActive": true
}
```

**Response:** `200 OK`

```json
{
  "id": 1,
  "connectionId": 1,
  "selectedFields": ["name", "sku", "price", "images", "COLOR"],
  "fieldMappings": {
    "price": "regular_price",
    "COLOR": "pa_color"
  },
  "isActive": true,
  "createdAt": "2025-12-11T10:00:00.000Z",
  "updatedAt": "2025-12-11T12:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request`: Required fields (name, sku) not included
- `404 Not Found`: Mapping not found

---

### 12. Delete Export Mapping

**Endpoint:** `DELETE /integration/woocommerce/connections/export-mappings/:mappingId`

**Description:** Deletes an export mapping.

**Path Parameters:**
- `mappingId` (integer): The mapping ID

**Response:** `204 No Content`

**Error Responses:**
- `404 Not Found`: Mapping not found

---

## Import Mapping Configuration

Import mappings configure how WooCommerce product data is mapped to your internal product model.

### 13. Create Import Mapping

**Endpoint:** `POST /integration/woocommerce/connections/:connectionId/import-mappings`

**Description:** Creates a new import mapping configuration for a connection.

**Path Parameters:**
- `connectionId` (integer): The connection ID

**Request Body:**

```json
{
  "connectionId": 1,
  "attributeMappings": {
    "pa_width": "width",
    "pa_height": "height",
    "pa_color": "color"
  },
  "fieldMappings": {
    "regular_price": "price",
    "sale_price": "salePrice"
  }
}
```

**Field Descriptions:**

- `connectionId` (required): Connection ID (will be set from path parameter)
- `attributeMappings` (required): Maps WooCommerce attribute names to internal attribute names
- `fieldMappings` (optional): Maps WooCommerce field names to internal field names

**Response:** `201 Created`

```json
{
  "id": 1,
  "connectionId": 1,
  "attributeMappings": {
    "pa_width": "width",
    "pa_height": "height",
    "pa_color": "color"
  },
  "fieldMappings": {
    "regular_price": "price",
    "sale_price": "salePrice"
  },
  "isActive": true,
  "createdAt": "2025-12-11T10:00:00.000Z",
  "updatedAt": "2025-12-11T10:00:00.000Z"
}
```

---

### 14. Get Import Mappings

**Endpoint:** `GET /integration/woocommerce/connections/:connectionId/import-mappings`

**Description:** Retrieves all import mappings for a connection.

**Path Parameters:**
- `connectionId` (integer): The connection ID

**Response:** `200 OK`

```json
[
  {
    "id": 1,
    "connectionId": 1,
    "attributeMappings": {
      "pa_width": "width"
    },
    "fieldMappings": {},
    "isActive": true,
    "createdAt": "2025-12-11T10:00:00.000Z",
    "updatedAt": "2025-12-11T10:00:00.000Z"
  }
]
```

---

### 15. Get Active Import Mapping

**Endpoint:** `GET /integration/woocommerce/connections/:connectionId/import-mappings/active`

**Description:** Retrieves the currently active import mapping for a connection.

**Path Parameters:**
- `connectionId` (integer): The connection ID

**Response:** `200 OK`

```json
{
  "id": 1,
  "connectionId": 1,
  "attributeMappings": {
    "pa_width": "width"
  },
  "fieldMappings": {},
  "isActive": true,
  "createdAt": "2025-12-11T10:00:00.000Z",
  "updatedAt": "2025-12-11T10:00:00.000Z"
}
```

**Notes:**
- Returns `null` if no active mapping exists

---

### 16. Update Import Mapping

**Endpoint:** `PUT /integration/woocommerce/connections/import-mappings/:mappingId`

**Description:** Updates an existing import mapping.

**Path Parameters:**
- `mappingId` (integer): The mapping ID

**Request Body:** (All fields optional)

```json
{
  "attributeMappings": {
    "pa_width": "product_width",
    "pa_color": "product_color"
  },
  "fieldMappings": {
    "regular_price": "basePrice"
  },
  "isActive": true
}
```

**Response:** `200 OK`

```json
{
  "id": 1,
  "connectionId": 1,
  "attributeMappings": {
    "pa_width": "product_width",
    "pa_color": "product_color"
  },
  "fieldMappings": {
    "regular_price": "basePrice"
  },
  "isActive": true,
  "createdAt": "2025-12-11T10:00:00.000Z",
  "updatedAt": "2025-12-11T12:00:00.000Z"
}
```

---

### 17. Delete Import Mapping

**Endpoint:** `DELETE /integration/woocommerce/connections/import-mappings/:mappingId`

**Description:** Deletes an import mapping.

**Path Parameters:**
- `mappingId` (integer): The mapping ID

**Response:** `204 No Content`

---

## Product Sync Operations

### 18. Export Products

**Endpoint:** `POST /integration/woocommerce/connections/export`

**Description:** Exports products to a specific WooCommerce connection with selective fields and individual attribute selection.

**Request Body:**

```json
{
  "connectionId": 1,
  "productIds": [101, 102, 103],
  "fieldsToExport": ["name", "sku", "price", "images", "COLOR", "Dimension"],
  "partialUpdate": true
}
```

**Field Descriptions:**


- `connectionId` (required): Connection ID to export to
- `productIds` (required): Array of product IDs to export
- `fieldsToExport` (optional): Override the mapping fields for this export. If not provided, uses active export mapping. Can include:
  - Core fields: `"name"`, `"sku"`, `"price"`, `"sale_price"`, `"weight"`, `"dimensions"`, `"stock_status"`, `"description"`, `"images"`, `"categories"`, `"tags"`, `"status"`, `"type"`
  - Individual attributes: `"COLOR"`, `"Dimension"`, `"Size"`, `"Material"`, etc. (attribute names from your product attributes)
- `partialUpdate` (optional): If true, only sends modified fields for existing products (default: `false`)

**Notes:**
- `name` and `sku` are always required and must be included in `fieldsToExport`
- Mapped attributes (like `price`, `weight`) are exported to WooCommerce core fields
- Non-mapped attributes (like `COLOR`, `Dimension`) are exported as WooCommerce product attributes
- Only selected attributes will be included in the export payload

**Response:** `200 OK`

```json
{
  "success": true,
  "connectionId": 1,
  "syncedCount": 3,
  "failedCount": 0,
  "results": [
    {
      "connectionId": 1,
      "productId": 101,
      "wooProductId": 456,
      "status": "success",
      "exportedFields": ["name", "sku", "price", "images", "COLOR", "Dimension"],
      "lastExportedAt": "2025-12-11T10:30:00.000Z"
    },
    {
      "connectionId": 1,
      "productId": 102,
      "wooProductId": 457,
      "status": "success",
      "exportedFields": ["name", "sku", "price", "images", "COLOR", "Dimension"],
      "lastExportedAt": "2025-12-11T10:30:00.000Z"
    },
    {
      "connectionId": 1,
      "productId": 103,
      "wooProductId": 458,
      "status": "success",
      "exportedFields": ["name", "sku", "price", "images", "COLOR", "Dimension"],
      "lastExportedAt": "2025-12-11T10:30:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request`: Required fields (name, sku) not included in fieldsToExport
- `404 Not Found`: Connection not found

---

### 19. Import Products

**Endpoint:** `POST /integration/woocommerce/connections/import`

**Description:** Imports products from WooCommerce with attribute mapping.

**Request Body:**

```json
{
  "connectionId": 1,
  "wooProductIds": [456, 457, 458],
  "updateExisting": true,
  "useMapping": true
}
```

**Field Descriptions:**

- `connectionId` (required): Connection ID to import from
- `wooProductIds` (optional): Array of WooCommerce product IDs to import. If empty, imports all products
- `updateExisting` (optional): If true, updates existing products. If false, skips them (default: `false`)
- `useMapping` (optional): If true, uses active import mapping. If false, uses default mapping (default: `true`)

**Response:** `200 OK`

```json
{
  "success": true,
  "importedCount": 2,
  "updatedCount": 1,
  "failedCount": 0,
  "products": [
    {
      "wooProductId": 456,
      "productId": 201,
      "status": "imported"
    },
    {
      "wooProductId": 457,
      "productId": 202,
      "status": "imported"
    },
    {
      "wooProductId": 458,
      "productId": 203,
      "status": "updated"
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request`: Failed to fetch products from WooCommerce
- `404 Not Found`: Connection not found

---

### 20. Update Single Product

**Endpoint:** `PUT /integration/woocommerce/connections/:connectionId/products/:productId`

**Description:** Updates a single product in WooCommerce (partial update).

**Path Parameters:**
- `connectionId` (integer): The connection ID
- `productId` (integer): The local product ID

**Response:** `200 OK`

```json
{
  "connectionId": 1,
  "productId": 101,
  "wooProductId": 456,
  "status": "success",
  "exportedFields": ["name", "sku", "price"],
  "lastExportedAt": "2025-12-11T10:30:00.000Z"
}
```

**Error Responses:**
- `404 Not Found`: Product or connection not found, or product not synced to connection

---

### 21. Delete Product from WooCommerce

**Endpoint:** `DELETE /integration/woocommerce/connections/:connectionId/products/:productId`

**Description:** Deletes a product from WooCommerce (permanently, not trash).

**Path Parameters:**
- `connectionId` (integer): The connection ID
- `productId` (integer): The local product ID

**Response:** `200 OK`

```json
{
  "success": true
}
```

**Error Response:**

```json
{
  "success": false,
  "message": "Product not found in WooCommerce"
}
```

---

### 22. Get Sync Status

**Endpoint:** `GET /integration/woocommerce/connections/:connectionId/sync-status`

**Description:** Retrieves sync status for all products associated with a connection.

**Path Parameters:**
- `connectionId` (integer): The connection ID

**Response:** `200 OK`

```json
[
  {
    "id": 1,
    "connectionId": 1,
    "productId": 101,
    "wooProductId": 456,
    "lastExportedAt": "2025-12-11T10:30:00.000Z",
    "lastImportedAt": null,
    "lastModifiedFields": ["name", "sku", "price"],
    "syncStatus": "synced",
    "errorMessage": null,
    "createdAt": "2025-12-11T10:00:00.000Z",
    "updatedAt": "2025-12-11T10:30:00.000Z"
  },
  {
    "id": 2,
    "connectionId": 1,
    "productId": 102,
    "wooProductId": 0,
    "lastExportedAt": null,
    "lastImportedAt": null,
    "lastModifiedFields": null,
    "syncStatus": "error",
    "errorMessage": "Failed to create product in WooCommerce",
    "createdAt": "2025-12-11T10:00:00.000Z",
    "updatedAt": "2025-12-11T10:00:00.000Z"
  }
]
```

**Sync Status Values:**
- `synced`: Successfully synced
- `pending`: Sync pending
- `error`: Sync failed

---

## Use Cases & Examples

### Use Case 1: Setting Up Multiple Stores

**Scenario:** A user wants to manage products across a main store and a wholesale store with different pricing.

**Steps:**

1. **Create Main Store Connection**

```bash
POST /integration/woocommerce/connections
{
  "storeName": "Main Retail Store",
  "storeUrl": "https://retail.example.com",
  "consumerKey": "ck_retail_key",
  "consumerSecret": "cs_retail_secret",
  "isDefault": true
}
```

2. **Create Wholesale Store Connection**

```bash
POST /integration/woocommerce/connections
{
  "storeName": "Wholesale Store",
  "storeUrl": "https://wholesale.example.com",
  "consumerKey": "ck_wholesale_key",
  "consumerSecret": "cs_wholesale_secret",
  "isDefault": false
}
```

3. **Configure Export Mapping for Retail Store**

```bash
POST /integration/woocommerce/connections/1/export-mappings
{
  "connectionId": 1,
  "selectedFields": ["name", "sku", "description", "price", "images"],
  "fieldMappings": {
    "price": "regular_price"
  }
}
```

4. **Configure Export Mapping for Wholesale Store**

```bash
POST /integration/woocommerce/connections/2/export-mappings
{
  "connectionId": 2,
  "selectedFields": ["name", "sku", "description", "wholesalePrice", "images"],
  "fieldMappings": {
    "wholesalePrice": "regular_price"
  }
}
```

5. **Export Same Products to Both Stores**

```bash
# Export to retail store
POST /integration/woocommerce/connections/export
{
  "connectionId": 1,
  "productIds": [101, 102, 103]
}

# Export to wholesale store with different pricing
POST /integration/woocommerce/connections/export
{
  "connectionId": 2,
  "productIds": [101, 102, 103]
}
```

---

### Use Case 2: Selective Field Updates

**Scenario:** Update only prices across multiple products without modifying other fields.

**Steps:**

1. **Export with Partial Update Flag**

```bash
POST /integration/woocommerce/connections/export
{
  "connectionId": 1,
  "productIds": [101, 102, 103, 104, 105],
  "fieldsToExport": ["name", "sku", "price"],
  "partialUpdate": true
}
```

**Explanation:**
- `partialUpdate: true` ensures only the fields in `fieldsToExport` are sent to WooCommerce
- Previously exported fields (like images, description) remain unchanged
- Reduces API payload size and processing time

---

### Use Case 3: Importing Products with Custom Attributes

**Scenario:** Import products from WooCommerce and map custom attributes.

**Steps:**

1. **Create Import Mapping**

```bash
POST /integration/woocommerce/connections/1/import-mappings
{
  "connectionId": 1,
  "attributeMappings": {
    "pa_material": "material",
    "pa_color": "color",
    "pa_size": "size"
  },
  "fieldMappings": {
    "regular_price": "price",
    "sale_price": "salePrice",
    "weight": "productWeight"
  }
}
```

2. **Import Products**

```bash
POST /integration/woocommerce/connections/import
{
  "connectionId": 1,
  "updateExisting": false,
  "useMapping": true
}
```

**Result:**
- All products from the WooCommerce store are imported
- Custom attributes (`pa_material`, `pa_color`, `pa_size`) are mapped to internal attributes
- Field mappings apply (e.g., `regular_price` → `price`)

---

### Use Case 4: Managing Different Product Catalogs

**Scenario:** Maintain separate product catalogs for different regions (US, EU, Asia).

**Steps:**

1. **Create Connections for Each Region**

```bash
# US Store
POST /integration/woocommerce/connections
{
  "storeName": "US Store",
  "storeUrl": "https://us.example.com",
  "consumerKey": "ck_us",
  "consumerSecret": "cs_us"
}

# EU Store
POST /integration/woocommerce/connections
{
  "storeName": "EU Store",
  "storeUrl": "https://eu.example.com",
  "consumerKey": "ck_eu",
  "consumerSecret": "cs_eu"
}

# Asia Store
POST /integration/woocommerce/connections
{
  "storeName": "Asia Store",
  "storeUrl": "https://asia.example.com",
  "consumerKey": "ck_asia",
  "consumerSecret": "cs_asia"
}
```

2. **Export Region-Specific Products**

```bash
# Export US products
POST /integration/woocommerce/connections/export
{
  "connectionId": 1,
  "productIds": [1, 2, 3, 4, 5]
}

# Export EU products
POST /integration/woocommerce/connections/export
{
  "connectionId": 2,
  "productIds": [6, 7, 8, 9, 10]
}

# Export Asia products
POST /integration/woocommerce/connections/export
{
  "connectionId": 3,
  "productIds": [11, 12, 13, 14, 15]
}
```

---

## Error Handling

### Common Error Codes

| Status Code | Error Type | Description |
|-------------|------------|-------------|
| 400 | Bad Request | Invalid request payload or missing required fields |
| 401 | Unauthorized | Invalid or missing JWT token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found (connection, mapping, product) |
| 409 | Conflict | Resource conflict (e.g., duplicate connection URL) |
| 500 | Internal Server Error | Server error during processing |

### Error Response Format

```json
{
  "statusCode": 400,
  "message": "Export mapping must include \"name\" and \"sku\" fields",
  "error": "Bad Request"
}
```

### WooCommerce API Errors

When WooCommerce API calls fail, the error message from WooCommerce is included:

```json
{
  "connectionId": 1,
  "productId": 101,
  "status": "error",
  "message": "Invalid product data: SKU already exists"
}
```

### Handling Connection Failures

If a connection test fails:

```json
{
  "success": false,
  "message": "Failed to connect to WooCommerce store: woocommerce_rest_cannot_view, Sorry, you cannot list resources."
}
```

**Common Causes:**
- Invalid credentials
- Insufficient API permissions
- WooCommerce REST API not enabled
- Firewall or network issues
- Invalid store URL

---

## Migration Guide

### From Single to Multi-Store

**Existing Setup:**
- Users currently have credentials stored in `UserIntegrationCredentials` table
- Single WooCommerce connection per user

**Migration Strategy:**

1. **Automatic Migration (Optional)**

Create a migration script to convert existing credentials to connections:

```typescript
// Migration script (pseudo-code)
async function migrateToMultiStore() {
  const users = await prisma.userIntegrationCredentials.findMany({
    where: { integrationType: 'woocommerce' }
  });

  for (const cred of users) {
    const credentials = cred.credentials as any;
    
    await prisma.wooCommerceConnection.create({
      data: {
        userId: cred.userId,
        storeName: 'Default Store',
        storeUrl: credentials.apiUrl,
        consumerKey: credentials.consumerKey,
        consumerSecret: credentials.consumerSecret,
        webhookSecret: credentials.webhookSecret,
        isDefault: true,
        isActive: true
      }
    });
  }
}
```

2. **Manual Migration**

Users can manually create connections from their existing credentials:

```bash
# Get existing credentials (from old system)
GET /integrations/credentials/status

# Create new connection
POST /integration/woocommerce/connections
{
  "storeName": "My Store",
  "storeUrl": "<from old credentials>",
  "consumerKey": "<from old credentials>",
  "consumerSecret": "<from old credentials>",
  "isDefault": true
}
```

### Backward Compatibility

The old single-connection endpoints (`POST /integration/woocommerce/export`) can be updated to:
- Use the default connection if available
- Prompt users to create a connection if none exists

```typescript
// Updated legacy endpoint
async exportProducts(dto: ExportProductsDto, userId: number) {
  const defaultConnection = await connectionService.getDefaultConnection(userId);
  
  return multiStoreService.exportProducts(userId, {
    connectionId: defaultConnection.id,
    productIds: dto.productIds
  });
}
```

---

## Best Practices

### 1. Connection Naming

Use descriptive names for connections:
- ✅ "Main Retail Store - US"
- ✅ "Wholesale Store - Europe"
- ❌ "Store 1"
- ❌ "WooCommerce"

### 2. Default Connection

Set a default connection for quick operations:
- Use for bulk exports without specifying connection
- Easy switching between connections

### 3. Field Mappings

Keep mappings consistent:
- Document custom field mappings
- Use WooCommerce attribute prefixes (`pa_`) for custom attributes
- Test mappings before bulk operations

### 4. Partial Updates

Use `partialUpdate: true` for:
- Price updates
- Stock updates
- Status changes
- Any operation that doesn't affect all fields

### 5. Sync Status Monitoring

Regularly check sync status:
```bash
GET /integration/woocommerce/connections/:connectionId/sync-status
```

Filter for errors and retry failed syncs.

### 6. Testing Connections

Always test connections before use:
```bash
POST /integration/woocommerce/connections/test
```

### 7. Error Handling in Client

Implement retry logic for transient errors:
- Network timeouts
- WooCommerce rate limits
- Temporary API unavailability

---

## Rate Limits

### WooCommerce API Limits

WooCommerce has rate limits:
- Default: 10 requests per 10 seconds per IP
- Can be configured via `woocommerce_rest_rate_limiting_per_second` filter

### Recommendations

- Batch operations when possible
- Implement exponential backoff for retries
- Monitor rate limit headers in responses

---

## Security Considerations

### Credential Storage

- API credentials are stored securely in the database
- Sensitive fields are never returned in API responses
- Use HTTPS for all API communications

### Webhook Security

- Always configure `webhookSecret` for webhook validation
- Verify webhook signatures before processing

### Permissions

Ensure users have appropriate permissions:
- `integration:create` - Create connections
- `integration:read` - View connections
- `integration:update` - Update connections
- `integration:delete` - Delete connections
- `integration:export` - Export products
- `integration:import` - Import products

---

## Support & Troubleshooting

### Common Issues

**Issue:** "Connection not found"
- **Solution:** Verify connection ID and ownership

**Issue:** "Export mapping must include name and sku fields"
- **Solution:** Ensure `selectedFields` includes both "name" and "sku"

**Issue:** "Failed to connect to WooCommerce store"
- **Solution:** Test connection credentials, verify store URL, check WooCommerce REST API settings

**Issue:** "Product not synced to this connection"
- **Solution:** Export the product first before attempting updates or deletes

### Debug Mode

Enable detailed logging in your environment:
```env
LOG_LEVEL=debug
```

This will log all WooCommerce API calls and responses.

---

## Appendix

### Field Mapping Examples

**Common Internal → WooCommerce Mappings:**

| Internal Field | WooCommerce Field | Type |
|----------------|-------------------|------|
| name | name | Standard |
| sku | sku | Standard |
| description | description | Standard |
| price | regular_price | Standard |
| salePrice | sale_price | Standard |
| width | pa_width | Custom Attribute |
| height | pa_height | Custom Attribute |
| color | pa_color | Custom Attribute |
| material | pa_material | Custom Attribute |
| weight | weight | Standard |
| length | length | Standard |

### API Endpoint Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/integration/woocommerce/connections` | Create connection |
| GET | `/integration/woocommerce/connections` | List connections |
| GET | `/integration/woocommerce/connections/default` | Get default connection |
| GET | `/integration/woocommerce/connections/:id` | Get connection |
| PUT | `/integration/woocommerce/connections/:id` | Update connection |
| DELETE | `/integration/woocommerce/connections/:id` | Delete connection |
| POST | `/integration/woocommerce/connections/test` | Test connection |
| POST | `/integration/woocommerce/connections/:id/export-mappings` | Create export mapping |
| GET | `/integration/woocommerce/connections/:id/export-mappings` | List export mappings |
| GET | `/integration/woocommerce/connections/:id/export-mappings/active` | Get active export mapping |
| PUT | `/integration/woocommerce/connections/export-mappings/:id` | Update export mapping |
| DELETE | `/integration/woocommerce/connections/export-mappings/:id` | Delete export mapping |
| POST | `/integration/woocommerce/connections/:id/import-mappings` | Create import mapping |
| GET | `/integration/woocommerce/connections/:id/import-mappings` | List import mappings |
| GET | `/integration/woocommerce/connections/:id/import-mappings/active` | Get active import mapping |
| PUT | `/integration/woocommerce/connections/import-mappings/:id` | Update import mapping |
| DELETE | `/integration/woocommerce/connections/import-mappings/:id` | Delete import mapping |
| POST | `/integration/woocommerce/connections/export` | Export products |
| POST | `/integration/woocommerce/connections/import` | Import products |
| PUT | `/integration/woocommerce/connections/:cid/products/:pid` | Update product |
| DELETE | `/integration/woocommerce/connections/:cid/products/:pid` | Delete product |
| GET | `/integration/woocommerce/connections/:id/sync-status` | Get sync status |

---

## Changelog

### Version 1.0.0 (2025-12-11)

**New Features:**
- Multi-store WooCommerce connection support
- Export field mapping configuration
- Import attribute mapping configuration
- Selective field export/import
- Partial update support for modified fields only
- Connection testing endpoint
- Sync status tracking per connection

**Database Changes:**
- Added `WooCommerceConnection` table
- Added `WooCommerceExportMapping` table
- Added `WooCommerceImportMapping` table
- Added `WooCommerceProductSync` table
- Updated `User` model with `wooConnections` relation

**Breaking Changes:**
- None (backward compatible with existing single-connection system)

---

## License

© 2025 PixelPim. All rights reserved.
