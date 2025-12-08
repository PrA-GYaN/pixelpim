# API Reference

This comprehensive document provides detailed information about all available API endpoints in the PixelPim Backend.

## Table of Contents

1. [Base URL](#base-url)
2. [Pagination](#pagination)
3. [File Upload & Cloud Storage](#file-upload--cloud-storage)
4. [Authentication](#authentication)
5. [Error Responses](#error-responses)
6. [Module Relationships](#module-relationships)
7. [Endpoints](#endpoints)
   - [Authentication Module](#authentication-module)
   - [Asset Module](#asset-module)
   - [Asset Group Module](#asset-group-module)
   - [Attribute Module](#attribute-module)
   - [Attribute Group Module](#attribute-group-module)
   - [Family Module](#family-module)
   - [Category Module](#category-module)
   - [Product Module](#product-module)
   - [Notification Module](#notification-module)
   - [Support Module](#support-module)
8. [Rate Limiting](#rate-limiting)
9. [Data Types](#data-types)
10. [Testing with cURL](#testing-with-curl)

## Base URL
```
http://localhost:3000
```

## Pagination

All list endpoints support pagination with the following query parameters:

### Parameters
- `page`: Page number (default: 1, minimum: 1)
- `limit`: Number of items per page (default: 10, minimum: 1, maximum: 100)

### Response Format
```json
{
  "data": [...], // Array of items
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Examples
```
GET /products?page=1&limit=10
GET /categories?page=2&limit=5
GET /assets?page=1&limit=20&assetGroupId=1
```

For detailed pagination examples, see [PAGINATION_GUIDE.md](./PAGINATION_GUIDE.md).

## File Upload & Cloud Storage

The API supports file uploads through the Asset Management system with the following features:
- **File Storage**: Integrated with Cloudinary for cloud-based file storage
- **File Types**: Supports all common file types (images, documents, videos, etc.)
- **File Size Limits**: 
  - Assets: Maximum 50MB per file
  - Support Attachments: Maximum 25MB per file (10 files max)
- **Image Processing**: Automatic thumbnail generation and image optimization
- **CDN Delivery**: Fast global content delivery through Cloudinary's CDN
- **Organized Storage**: Files can be organized into Asset Groups for better management

## Authentication

Most endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

**Exceptions:** The following endpoints do NOT require authentication:
- `POST /auth/send-otp`
- `POST /auth/verify-otp`
- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/google`
- `GET /auth/google/callback`
- `POST /api/support/tickets`

## Error Responses

All endpoints return standardized error responses:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `413` - Payload Too Large
- `500` - Internal Server Error

## Module Relationships

Understanding the relationships between different modules:

### **ASSETS ←→ ASSET GROUPS** (Many-to-One)
- Assets belong to asset groups
- Asset groups can have parent groups (hierarchical structure)
- Asset groups organize assets into folders

### **ATTRIBUTES ←→ ATTRIBUTE GROUPS** (Many-to-One)
- Attributes belong to attribute groups
- Attribute groups organize related attributes

### **FAMILIES ←→ ATTRIBUTES** (Many-to-Many)
- Families define which attributes products must have
- Family-Attribute relationship can be required or optional
- Families provide attribute inheritance for products

### **PRODUCTS ←→ CATEGORIES** (Many-to-One)
- Products belong to categories
- Categories can have parent categories (hierarchical structure)

### **PRODUCTS ←→ FAMILIES** (Many-to-One)
- Products belong to a family
- Family determines available attributes for the product

### **PRODUCTS ←→ ATTRIBUTES** (Many-to-Many via ProductAttribute)
- Products have attribute values
- Each product-attribute has a specific value

### **PRODUCTS ←→ VARIANTS** (One-to-Many)
- Products can have multiple variants
- Variants are products with different attribute combinations

### **NOTIFICATIONS → ALL ENTITIES**
- Tracks create/update/delete actions on all entities
- Links to entity type and entity ID
- Provides audit trail and activity log

## Endpoints

### Authentication Module

#### Send OTP
Send a verification code to the user's email for registration.

**Endpoint:** `POST /auth/send-otp`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Validation Rules:**
- `email`: Must be a valid email address

**Success Response (200):**
```json
{
  "message": "OTP sent successfully to your email",
  "email": "user@example.com"
}
```

**Error Responses:**
- `409 Conflict` - Email already exists
- `400 Bad Request` - Invalid email format

---

#### Verify OTP
Verify the OTP code sent to the user's email.

**Endpoint:** `POST /auth/verify-otp`

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Validation Rules:**
- `email`: Must be a valid email address
- `otp`: Must be exactly 6 digits

**Success Response (200):**
```json
{
  "message": "OTP verified successfully",
  "email": "user@example.com"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid OTP or OTP expired

---

#### Complete Registration
Complete user registration after OTP verification.

**Endpoint:** `POST /auth/signup`

**Request Body:**
```json
{
  "email": "user@example.com",
  "fullname": "John Doe",
  "password": "securePassword123",
  "otp": "123456"
}
```

**Validation Rules:**
- `email`: Must be a valid email address
- `fullname`: Required string
- `password`: Minimum 6 characters
- `otp`: Must be exactly 6 digits and verified

**Success Response (201):**
```json
{
  "message": "User created successfully",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "fullname": "John Doe",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `400 Bad Request` - Invalid or unverified OTP
- `409 Conflict` - Email already exists

---

#### User Login
Authenticate existing users with email and password.

**Endpoint:** `POST /auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Validation Rules:**
- `email`: Must be a valid email address
- `password`: Required string

**Success Response (200):**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "fullname": "John Doe",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `401 Unauthorized` - User Account does not exist
- `401 Unauthorized` - Please use Google login for this account (for Google OAuth users)
- `401 Unauthorized` - Invalid credentials

---

#### Google OAuth Login
Initiate Google OAuth authentication flow.

**Endpoint:** `GET /auth/google`

**Description:** Redirects to Google for authentication. No request body required.

**Response:** Redirects to Google OAuth consent screen.

---

#### Google OAuth Callback
Handle Google OAuth callback and complete authentication.

**Endpoint:** `GET /auth/google/callback`

**Description:** Automatically called by Google after user consent. Returns HTML page with JWT token and user information.

**Success Response:** HTML page containing JWT token and user information:
```html
<html>
  <body>
    <h1>Login Successful!</h1>
    <p>Your JWT token:</p>
    <textarea rows="4" cols="50" readonly>eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...</textarea>
    <br><br>
    <p>User Info:</p>
    <pre>{
  "id": 1,
  "email": "user@example.com",
  "fullname": "John Doe",
  "provider": "google",
  "createdAt": "2024-01-01T00:00:00.000Z"
}</pre>
    <script>
      localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
    </script>
  </body>
</html>
```

---

#### Get User Profile
Retrieve authenticated user's profile information.

**Endpoint:** `GET /auth/profile`

**Authentication:** Required (JWT token)

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Success Response (200):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "fullname": "John Doe",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing JWT token

---

### Attribute Module

#### Get Available Attribute Types
Retrieve all supported attribute types and their mappings.

**Endpoint:** `GET /attributes/types`

**Authentication:** Required (JWT token)

**Success Response (200):**
```json
{
  "userFriendlyTypes": ["text", "number", "boolean", "date", "select", "multiselect"],
  "typeMapping": {
    "text": "String",
    "number": "Float",
    "boolean": "Boolean",
    "date": "DateTime",
    "select": "String",
    "multiselect": "String"
  },
  "description": "Available attribute types for creating attributes. Use the user-friendly types in your frontend."
}
```

---

#### Create Attribute
Create a new attribute with specific type and configuration.

**Endpoint:** `POST /attributes`

**Authentication:** Required (JWT token)

**Request Body (Text Attribute):**
```json
{
  "name": "Color",
  "type": "text",
  "description": "Product color",
  "defaultValue": "Black",
  "isRequired": false,
  "options": ["Red", "Blue", "Green", "Black", "White"],
  "attributeGroupId": 1
}
```

**Request Body (Number Attribute):**
```json
{
  "name": "Weight",
  "type": "number",
  "description": "Product weight in kg",
  "unit": "kg",
  "isRequired": true
}
```

**Request Body (Boolean Attribute):**
```json
{
  "name": "In Stock",
  "type": "boolean",
  "defaultValue": true
}
```

**Request Body (Date Attribute):**
```json
{
  "name": "Manufacturing Date",
  "type": "date",
  "description": "Date when product was manufactured"
}
```

**Validation Rules:**
- `name`: Required string, must be unique
- `type`: Required string (text, number, boolean, date, select, multiselect)
- `description`: Optional string
- `defaultValue`: Optional (type-appropriate value)
- `isRequired`: Optional boolean
- `options`: Optional array (for select/multiselect types)
- `unit`: Optional string (for number type)
- `attributeGroupId`: Optional integer

**Success Response (201):**
```json
{
  "id": 1,
  "name": "Color",
  "type": "text",
  "description": "Product color",
  "defaultValue": "Black",
  "isRequired": false,
  "options": ["Red", "Blue", "Green", "Black", "White"],
  "userId": 1,
  "attributeGroupId": 1,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `409 Conflict` - Attribute with this name already exists
- `400 Bad Request` - Invalid attribute type or validation error

---

#### Get All Attributes
Retrieve all attributes with advanced filtering and pagination.

**Endpoint:** `GET /attributes`

**Authentication:** Required (JWT token)

**Query Parameters:**
- `page`: Number (default: 1) - Page number
- `limit`: Number (default: 10) - Items per page
- `type`: String (optional) - Filter by attribute type
- `attributeGroupId`: Number (optional) - Filter by attribute group
- `isRequired`: Boolean (optional) - Filter by required status
- `search`: String (optional) - Search in attribute name
- `sortBy`: String (optional) - Field to sort by (name, type, createdAt)
- `sortOrder`: String (optional) - Sort order (asc, desc)

**Examples:**
```
GET /attributes?page=1&limit=10
GET /attributes?type=text&attributeGroupId=1
GET /attributes?isRequired=true&search=color&sortBy=name
```

**Success Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Brand",
      "type": "text",
      "description": "Product brand",
      "defaultValue": null,
      "isRequired": false,
      "options": [],
      "userId": 1,
      "attributeGroupId": 1,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": 2,
      "name": "Price",
      "type": "number",
      "description": "Product price",
      "unit": "USD",
      "isRequired": true,
      "userId": 1,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

#### Get Attributes with Product Counts
Retrieve attributes with count of products using each attribute.

**Endpoint:** `GET /attributes/with-product-counts`

**Authentication:** Required (JWT token)

**Query Parameters:**
- `page`: Number (default: 1) - Page number
- `limit`: Number (default: 20) - Items per page

**Success Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Brand",
      "type": "text",
      "productCount": 25,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

#### Get All Attribute Groups
Retrieve attribute groups with filtering.

**Endpoint:** `GET /attributes/groups`

**Authentication:** Required (JWT token)

**Query Parameters:**
- `search`: String (optional) - Search in group name
- `sortBy`: String (optional) - Field to sort by (name, createdAt)
- `sortOrder`: String (optional) - Sort order (asc, desc)

**Example:** `GET /attributes/groups?search=technical&sortBy=name`

**Success Response (200):**
Returns array of attribute groups with their attributes.

---

#### Get Attribute Suggestions
Get autocomplete suggestions for attribute values based on existing product data.

**Endpoint:** `GET /attributes/attribute-suggestions`

**Authentication:** Required (JWT token)

**Query Parameters:**
- `productId`: Number (required) - Product ID
- `attributeId`: Number (required) - Attribute ID
- `query`: String (required) - Search query (minimum 2 characters)

**Example:** `GET /attributes/attribute-suggestions?productId=1&attributeId=1&query=Bl`

**Success Response (200):**
```json
{
  "suggestions": ["Black", "Blue", "Blush Pink"]
}
```

**Error Responses:**
- `400 Bad Request` - Query must be at least 2 characters

---

#### Get Attribute by ID
Retrieve a specific attribute by its ID.

**Endpoint:** `GET /attributes/:id`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Attribute ID (integer)

**Success Response (200):**
```json
{
  "id": 1,
  "name": "Brand",
  "type": "string",
  "userId": 1,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "attributeGroups": [
    {
      "attributeGroup": {
        "id": 1,
        "name": "Product Attributes"
      }
    }
  ]
}
```

**Error Responses:**
- `404 Not Found` - Attribute not found
- `403 Forbidden` - You can only access your own attributes

---

#### Update Attribute
Update an existing attribute.

**Endpoint:** `PATCH /attributes/:id`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Attribute ID (integer)

**Request Body (partial update):**
```json
{
  "name": "Updated Brand",
  "type": "string"
}
```

**Success Response (200):**
```json
{
  "id": 1,
  "name": "Updated Brand",
  "type": "string",
  "userId": 1,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `404 Not Found` - Attribute not found
- `403 Forbidden` - You can only access your own attributes
- `409 Conflict` - Attribute with this name already exists

---

#### Delete Attribute
Delete an attribute.

**Endpoint:** `DELETE /attributes/:id`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Attribute ID (integer)

**Success Response (200):**
```json
{
  "message": "Attribute with ID 1 has been deleted"
}
```

**Error Responses:**
- `404 Not Found` - Attribute not found
- `403 Forbidden` - You can only access your own attributes

---

### Attribute Group Module

#### Create Attribute Group
Create a new attribute group with attributes.

**Endpoint:** `POST /attribute-groups`

**Authentication:** Required (JWT token)

**Request Body:**
```json
{
  "name": "Product Attributes",
  "description": "Attributes related to product information.",
  "attributes": [
    {
      "attributeId": 1,
      "required": true,
      "defaultValue": "Unknown"
    },
    {
      "attributeId": 2,
      "required": false,
      "defaultValue": "0"
    }
  ]
}
```

**Validation Rules:**
- `name`: Required string, must be unique
- `description`: Optional string
- `attributes`: Array of attribute configurations
- `attributeId`: Must exist and belong to the authenticated user
- `required`: Boolean (default: false)
- `defaultValue`: Optional string

**Success Response (201):**
```json
{
  "id": 1,
  "name": "Product Attributes",
  "description": "Attributes related to product information.",
  "userId": 1,
  "attributes": [
    {
      "id": 4,
      "attribute": {
        "id": 1,
        "name": "Brand",
        "type": "string",
        "userId": 1
      }
    },
    {
      "id": 5,
      "attribute": {
        "id": 2,
        "name": "Price",
        "type": "number",
        "userId": 1
      }
    }
  ]
}
```

**Error Responses:**
- `409 Conflict` - Attribute group with this name already exists
- `400 Bad Request` - Attributes with IDs X, Y not found or not accessible

---

#### Get All Attribute Groups
Retrieve all attribute groups for the authenticated user.

**Endpoint:** `GET /attribute-groups`

**Authentication:** Required (JWT token)

**Success Response (200):**
```json
[
  {
    "id": 1,
    "name": "Product Attributes",
    "description": "Attributes related to product information.",
    "userId": 1,
    "attributes": [
      {
        "id": 4,
        "attribute": {
          "id": 1,
          "name": "Brand",
          "type": "string",
          "userId": 1
        }
      },
      {
        "id": 5,
        "attribute": {
          "id": 2,
          "name": "Price",
          "type": "number",
          "userId": 1
        }
      }
    ]
  }
]
```

---

#### Get Attribute Group by ID
Retrieve a specific attribute group by its ID.

**Endpoint:** `GET /attribute-groups/:id`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Attribute Group ID (integer)

**Success Response (200):**
```json
{
  "id": 1,
  "name": "Product Attributes",
  "description": "Attributes related to product information.",
  "userId": 1,
  "attributes": [
    {
      "id": 4,
      "attribute": {
        "id": 1,
        "name": "Brand",
        "type": "string",
        "userId": 1
      }
    },
    {
      "id": 5,
      "attribute": {
        "id": 2,
        "name": "Price",
        "type": "number",
        "userId": 1
      }
    }
  ]
}
```

**Error Responses:**
- `404 Not Found` - Attribute group not found
- `403 Forbidden` - You can only access your own attribute groups

---

#### Update Attribute Group
Update an existing attribute group.

**Endpoint:** `PATCH /attribute-groups/:id`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Attribute Group ID (integer)

**Request Body (partial update):**
```json
{
  "name": "Updated Product Attributes",
  "description": "Updated description",
  "attributes": [
    {
      "attributeId": 1,
      "required": true,
      "defaultValue": "Default Brand"
    },
    {
      "attributeId": 3,
      "required": false,
      "defaultValue": "Default Value"
    }
  ]
}
```

**Success Response (200):**
```json
{
  "id": 1,
  "name": "Updated Product Attributes",
  "description": "Updated description",
  "userId": 1,
  "attributes": [
    {
      "id": 6,
      "attribute": {
        "id": 1,
        "name": "Brand",
        "type": "string",
        "userId": 1
      }
    },
    {
      "id": 7,
      "attribute": {
        "id": 3,
        "name": "Is Complete",
        "type": "boolean",
        "userId": 1
      }
    }
  ]
}
```

**Error Responses:**
- `404 Not Found` - Attribute group not found
- `403 Forbidden` - You can only access your own attribute groups
- `409 Conflict` - Attribute group with this name already exists
- `400 Bad Request` - Attributes with IDs X, Y not found or not accessible

---

#### Delete Attribute Group
Delete an attribute group and all its attribute associations.

**Endpoint:** `DELETE /attribute-groups/:id`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Attribute Group ID (integer)

**Success Response (200):**
```json
{
  "message": "Attribute group with ID 1 has been deleted"
}
```

**Error Responses:**
- `404 Not Found` - Attribute group not found
- `403 Forbidden` - You can only access your own attribute groups

---

#### Add Attribute to Group
Add an attribute to an existing attribute group.

**Endpoint:** `POST /attribute-groups/:groupId/attributes/:attributeId`

**Authentication:** Required (JWT token)

**Parameters:**
- `groupId`: Attribute Group ID (integer)
- `attributeId`: Attribute ID (integer)

**Query Parameters:**
- `required`: Boolean (default: false) - whether the attribute is required
- `defaultValue`: String (optional) - default value for the attribute

**Example:**
```
POST /attribute-groups/1/attributes/5
```

**Success Response (201):**
```json
{
  "id": 8,
  "attribute": {
    "id": 5,
    "name": "Color",
    "type": "string",
    "userId": 1
  }
}
```

**Error Responses:**
- `404 Not Found` - Attribute group or attribute not found
- `403 Forbidden` - You can only use your own attributes
- `409 Conflict` - Attribute is already in this group
- `400 Bad Request` - Attribute doesn't belong to user

---

#### Remove Attribute from Group
Remove an attribute from an attribute group.

**Endpoint:** `DELETE /attribute-groups/:groupId/attributes/:attributeId`

**Authentication:** Required (JWT token)

**Parameters:**
- `groupId`: Attribute Group ID (integer)
- `attributeId`: Attribute ID (integer)

**Success Response (200):**
```json
{
  "message": "Attribute removed from group successfully"
}
```

**Error Responses:**
- `404 Not Found` - Attribute group not found or attribute not in group
- `403 Forbidden` - You can only access your own attribute groups

---

### Family Module

#### Create Family
Create a new family with attributes configuration.

**Endpoint:** `POST /families`

**Authentication:** Required (JWT token)

**Request Body:**
```json
{
  "name": "Electronics",
  "requiredAttributes": [
    {
      "attributeId": 1,
      "defaultValue": "Unknown Brand"
    },
    {
      "attributeId": 2,
      "defaultValue": "0"
    }
  ],
  "otherAttributes": [
    {
      "attributeId": 3,
      "defaultValue": "High quality"
    },
    {
      "attributeId": 4,
      "defaultValue": "Available"
    }
  ]
}
```

**Validation Rules:**
- `name`: Required string, must be unique per user
- `requiredAttributes`: Optional array of attribute configurations
- `otherAttributes`: Optional array of attribute configurations
- `attributeId`: Must exist and belong to the authenticated user
- No duplicate attribute IDs allowed

**Success Response (201):**
```json
{
  "id": 1,
  "name": "Electronics",
  "userId": 1,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "familyAttributes": [
    {
      "id": 1,
      "familyId": 1,
      "attributeId": 1,
      "isRequired": true,
      "defaultValue": "Unknown Brand",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "attribute": {
        "id": 1,
        "name": "Brand",
        "type": "string"
      }
    },
    {
      "id": 2,
      "familyId": 1,
      "attributeId": 3,
      "isRequired": false,
      "defaultValue": "High quality",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "attribute": {
        "id": 3,
        "name": "Quality",
        "type": "string"
      }
    }
  ]
}
```

**Error Responses:**
- `409 Conflict` - Family with this name already exists
- `400 Bad Request` - One or more attributes not found or do not belong to you
- `400 Bad Request` - Duplicate attribute IDs found

---

#### Get All Families
Retrieve all families for the authenticated user with product counts.

**Endpoint:** `GET /families`

**Authentication:** Required (JWT token)

**Success Response (200):**
```json
[
  {
    "id": 1,
    "name": "Electronics",
    "userId": 1,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "productCount": 5,
    "familyAttributes": [
      {
        "id": 1,
        "isRequired": true,
        "additionalValue": "Premium",
        "attribute": {
          "id": 1,
          "name": "Brand",
          "type": "string",
          "defaultValue": null,
          "userId": 1
        }
      }
    ]
  }
]
```

---

#### Get Family by ID
Retrieve a specific family by its ID with list of products using this family.

**Endpoint:** `GET /families/:id`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Family ID (integer)

**Success Response (200):**
```json
{
  "id": 1,
  "name": "Electronics",
  "userId": 1,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "products": [
    {
      "id": 1,
      "name": "iPhone 15 Pro",
      "sku": "IPHONE15PRO128",
      "status": "complete",
      "imageUrl": "https://example.com/iphone.jpg"
    },
    {
      "id": 2,
      "name": "Samsung Galaxy S24",
      "sku": "GALAXY-S24-256",
      "status": "incomplete",
      "imageUrl": null
    }
  ],
  "familyAttributes": [
    {
      "id": 1,
      "isRequired": true,
      "additionalValue": "Premium",
      "attribute": {
        "id": 1,
        "name": "Brand",
        "type": "string",
        "defaultValue": null,
        "userId": 1
      }
    }
  ]
}
```

**Error Responses:**
- `404 Not Found` - Family not found
- `403 Forbidden` - You can only access your own families

---

#### Update Family
Update family name and/or attributes configuration.

**Endpoint:** `PATCH /families/:id`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Family ID (integer)

**Request Body (partial update):**
```json
{
  "name": "Updated Electronics",
  "requiredAttributes": [
    {
      "attributeId": 1,
      "defaultValue": "Samsung"
    }
  ],
  "otherAttributes": [
    {
      "attributeId": 3,
      "defaultValue": "High quality"
    }
  ]
}
```

**Success Response (200):**
```json
{
  "id": 1,
  "name": "Updated Electronics",
  "userId": 1,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "familyAttributes": [
    {
      "id": 2,
      "familyId": 1,
      "attributeId": 1,
      "isRequired": true,
      "defaultValue": "Samsung",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "attribute": {
        "id": 1,
        "name": "Brand",
        "type": "string"
      }
    }
  ]
}
```

**Error Responses:**
- `404 Not Found` - Family not found
- `403 Forbidden` - You can only access your own families
- `409 Conflict` - Family with this name already exists

---

#### Delete Family
Delete a family and all its attribute associations.

**Endpoint:** `DELETE /families/:id`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Family ID (integer)

**Success Response (200):**
```json
{
  "message": "Family with ID 1 has been deleted"
}
```

**Error Responses:**
- `404 Not Found` - Family not found
- `403 Forbidden` - You can only access your own families

---

#### Add Attribute to Family
Add an attribute to an existing family.

**Endpoint:** `POST /families/:id/attributes/:attributeId`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Family ID (integer)
- `attributeId`: Attribute ID (integer)

**Query Parameters:**
- `isRequired`: Boolean (default: false) - whether the attribute is required
- `defaultValue`: String (optional) - default value for the attribute

**Example:**
```
POST /families/1/attributes/5?isRequired=true&defaultValue=Default%20Value
```

**Success Response (201):**
```json
{
  "id": 3,
  "familyId": 1,
  "attributeId": 5,
  "isRequired": true,
  "defaultValue": "Default Value",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "attribute": {
    "id": 5,
    "name": "Color",
    "type": "string"
  }
}
```

**Error Responses:**
- `404 Not Found` - Family or attribute not found
- `403 Forbidden` - You can only access your own families
- `409 Conflict` - Attribute is already assigned to this family
- `400 Bad Request` - Attribute not found or does not belong to you

---

#### Remove Attribute from Family
Remove an attribute from a family.

**Endpoint:** `DELETE /families/:id/attributes/:attributeId`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Family ID (integer)
- `attributeId`: Attribute ID (integer)

**Success Response (200):**
```json
{
  "message": "Attribute removed from family successfully"
}
```

**Error Responses:**
- `404 Not Found` - Family not found or attribute not assigned
- `403 Forbidden` - You can only access your own families

---

### Asset Module

The Asset Management system provides comprehensive digital asset management with advanced filtering, hierarchical organization, and cloud storage integration. Assets can be organized into groups (folders) with support for nested hierarchies.

#### Asset Filtering Capabilities

The asset API supports extensive filtering options for efficient asset discovery and management:

**Search & Text Filters:**
- **search**: Case-insensitive search across asset names and filenames
- **mimeType**: Filter by file type (e.g., `image/jpeg`, `application/pdf`, `video/mp4`)

**Size-Based Filters:**
- **minSize**: Minimum file size in bytes
- **maxSize**: Maximum file size in bytes

**Date-Based Filters:**
- **createdAfter**: Assets created after specified date (ISO 8601)
- **createdBefore**: Assets created before specified date (ISO 8601)
- **dateFilter**: Quick filters (`latest` for newest first, `oldest` for oldest first)

**Relationship Filters:**
- **hasGroup**: Filter assets by group membership (`true` for grouped, `false` for ungrouped)
- **assetGroupId**: Filter assets within a specific group

**Sorting Options:**
- **sortBy**: Fields include `name`, `fileName`, `size`, `createdAt`, `updatedAt`
- **sortOrder**: `asc` (ascending) or `desc` (descending, default)

**Asset Group Filtering Capabilities:**

Asset groups support similar comprehensive filtering for organizational management:

**Search & Content Filters:**
- **search**: Case-insensitive search in group names
- **hasAssets**: Filter groups by asset presence (`true` for groups with assets, `false` for empty groups)
- **minAssets**: Minimum number of assets in groups
- **maxAssets**: Maximum number of assets in groups

**Size-Based Filters:**
- **minSize**: Minimum total size of all assets in groups (bytes)
- **maxSize**: Maximum total size of all assets in groups (bytes)

**Date-Based Filters:**
- **createdAfter**: Groups created after specified date
- **createdBefore**: Groups created before specified date
- **dateFilter**: Quick date filters (`latest`, `oldest`)

**Sorting Options:**
- **sortBy**: Fields include `groupName`, `createdAt`, `updatedAt`, `totalSize`
- **sortOrder**: `asc` or `desc` (default: `desc`)

#### File Upload & Storage

Assets are uploaded to cloud storage (Cloudinary) with automatic optimization:
- **Maximum file size**: 50MB per asset
- **Supported formats**: All common file types (images, documents, videos, etc.)
- **Automatic processing**: Thumbnail generation and image optimization
- **CDN delivery**: Fast global content delivery
- **Organized storage**: Hierarchical group structure for asset organization

#### Export Capabilities

Assets can be exported in multiple formats:
- **JSON export**: Structured data export with full metadata
- **XML export**: Alternative format for system integrations
- **ZIP download**: Bulk download of multiple assets
- **Filtered exports**: Export only assets matching specific criteria

#### Upload Asset
Upload a new asset file to the system.

**Endpoint:** `POST /assets/upload`

**Authentication:** Required (JWT token)

**Content-Type:** `multipart/form-data`

**Request Body:**
- `file`: File (required) - The asset file to upload (max 50MB)
- `name`: String (required) - Name for the asset
- `assetGroupId`: Number (optional) - ID of the asset group to assign

**Example:**
```bash
curl -X POST http://localhost:3000/assets/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/your/file.jpg" \
  -F "name=Product Image 1" \
  -F "assetGroupId=1"
```

**Success Response (201):**
```json
{
  "id": 1,
  "name": "Product Image 1",
  "fileName": "product-image.jpg",
  "filePath": "assets/product-image_abc123",
  "mimeType": "image/jpeg",
  "uploadDate": "2024-01-01T00:00:00.000Z",
  "size": 1048576,
  "userId": 1,
  "assetGroupId": 1,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "assetGroup": {
    "id": 1,
    "groupName": "Product Images",
    "createdDate": "2024-01-01T00:00:00.000Z",
    "totalSize": 2097152,
    "userId": 1
  },
  "url": "https://res.cloudinary.com/your-cloud/image/upload/v123456789/assets/product-image_abc123.jpg",
  "thumbnailUrl": "https://res.cloudinary.com/your-cloud/image/upload/c_thumb,w_150,h_150/assets/product-image_abc123.jpg",
  "formattedSize": "1.0 MB",
  "cloudinaryData": {
    "public_id": "assets/product-image_abc123",
    "format": "jpg",
    "resource_type": "image",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - File is required
- `404 Not Found` - Asset group not found
- `413 Payload Too Large` - File exceeds 50MB limit

---

#### Get All Assets
Retrieve all assets with advanced filtering, sorting, and pagination.

**Endpoint:** `GET /assets`

**Authentication:** Required (JWT token)

**Query Parameters:**
- `page`: Number (default: 1) - Page number
- `limit`: Number (default: 10) - Items per page (maximum: 100)
- `assetGroupId`: Number (optional) - Filter by asset group ID
- `search`: String (optional) - Search in asset name or file name (case-insensitive)
- `mimeType`: String (optional) - Filter by MIME type (e.g., image/jpeg, application/pdf)
- `minSize`: Number (optional) - Minimum file size in bytes
- `maxSize`: Number (optional) - Maximum file size in bytes
- `createdAfter`: String (optional) - Filter assets created after date (ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)
- `createdBefore`: String (optional) - Filter assets created before date (ISO 8601 format)
- `sortBy`: String (optional) - Field to sort by (name, fileName, size, createdAt, updatedAt)
- `sortOrder`: String (optional) - Sort order (asc, desc) - default: desc
- `hasGroup`: Boolean (optional) - Filter by assets with/without group (true, false)
- `dateFilter`: String (optional) - Quick date filter (latest, oldest)

**Examples:**
```
GET /assets?page=1&limit=10
GET /assets?assetGroupId=1&search=product
GET /assets?mimeType=image/jpeg&sortBy=size&sortOrder=desc
GET /assets?minSize=1000&maxSize=5000000&hasGroup=true
GET /assets?createdAfter=2024-01-01&dateFilter=latest
GET /assets?search=logo&hasGroup=false&sortBy=name&sortOrder=asc
GET /assets?mimeType=image&minSize=500000&createdAfter=2024-06-01&sortBy=size&sortOrder=desc
```

**Advanced Filtering Examples:**
```bash
# Complex filtering: Images + Size + Date + Group membership
GET /assets?mimeType=image&minSize=1000000&maxSize=10000000&hasGroup=true&createdAfter=2024-01-01&sortBy=size&sortOrder=desc

# Search with multiple criteria
GET /assets?search=banner&mimeType=image&hasGroup=false&dateFilter=latest

# Large file detection
GET /assets?minSize=50000000&sortBy=size&sortOrder=desc

# Recent uploads
GET /assets?createdAfter=2024-10-01&sortBy=createdAt&sortOrder=desc

# Assets without groups (orphaned assets)
GET /assets?hasGroup=false&page=1&limit=50
```

**Success Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Product Image 1",
      "fileName": "product-image.jpg",
      "filePath": "assets/product-image_abc123",
      "mimeType": "image/jpeg",
      "uploadDate": "2024-01-01T00:00:00.000Z",
      "size": 1048576,
      "userId": 1,
      "assetGroupId": 1,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "assetGroup": {
        "id": 1,
        "groupName": "Product Images",
        "createdDate": "2024-01-01T00:00:00.000Z",
        "totalSize": 2097152,
        "userId": 1
      },
      "url": "https://res.cloudinary.com/your-cloud/image/upload/v123456789/assets/product-image_abc123.jpg",
      "thumbnailUrl": "https://res.cloudinary.com/your-cloud/image/upload/c_thumb,w_150,h_150/assets/product-image_abc123.jpg",
      "formattedSize": "1.0 MB"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "totalPages": 15,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

#### Get Asset by ID
Retrieve a specific asset by its ID.

**Endpoint:** `GET /assets/:id`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Asset ID (integer)

**Success Response (200):**
Same format as upload asset response.

**Error Responses:**
- `404 Not Found` - Asset not found
- `403 Forbidden` - You can only access your own assets

---

#### Update Asset
Update an existing asset's metadata.

**Endpoint:** `PATCH /assets/:id`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Asset ID (integer)

**Request Body (partial update):**
```json
{
  "name": "Updated Product Image",
  "assetGroupId": 2
}
```

**Success Response (200):**
Same format as upload asset response with updated values.

**Error Responses:**
- `404 Not Found` - Asset not found or asset group not found
- `403 Forbidden` - You can only access your own assets

---

#### Delete Asset
Delete an asset and remove it from cloud storage.

**Endpoint:** `DELETE /assets/:id`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Asset ID (integer)

**Success Response (200):**
```json
{
  "message": "Asset successfully deleted"
}
```

**Error Responses:**
- `404 Not Found` - Asset not found
- `403 Forbidden` - You can only access your own assets

---

#### Export Assets as JSON
Export all assets or filtered assets as JSON.

**Endpoint:** `GET /assets/export/json`

**Authentication:** Required (JWT token)

**Query Parameters:**
- `assetGroupId`: Number (optional) - Filter by asset group ID

**Example:** `GET /assets/export/json?assetGroupId=1`

**Success Response (200):**
Returns JSON array of assets with full details.

---

#### Export Assets (JSON/XML)
Export assets in specified format with filtering options.

**Endpoint:** `POST /assets/export`

**Authentication:** Required (JWT token)

**Request Body:**
```json
{
  "format": "json",
  "assetGroupId": 1,
  "filters": {
    "mimeType": "image/jpeg",
    "search": "product"
  },
  "includeMetadata": true
}
```

**Parameters:**
- `format`: String (required) - Export format (json, xml)
- `assetGroupId`: Number (optional) - Filter by asset group
- `filters`: Object (optional) - Additional filters
- `includeMetadata`: Boolean (optional) - Include full metadata

**Success Response (200):**
Returns file download with appropriate content type:
- JSON: `application/json`
- XML: `application/xml`

**Response Headers:**
```
Content-Type: application/json (or application/xml)
Content-Disposition: attachment; filename="assets-export-[timestamp].json"
```

---

#### Download Multiple Assets as ZIP
Download selected assets as a ZIP file.

**Endpoint:** `POST /assets/zip`

**Authentication:** Required (JWT token)

**Request Body:**
```json
{
  "files": [
    "/uploads/assets/file1.jpg",
    "/uploads/assets/file2.png",
    "/uploads/assets/file3.pdf"
  ]
}
```

**Parameters:**
- `files`: Array of strings (required) - File paths to include in ZIP

**Success Response (200):**
Returns ZIP file download.

**Response Headers:**
```
Content-Type: application/zip
Content-Disposition: attachment; filename="my-assets.zip"
```

**Error Responses:**
- `400 Bad Request` - No files specified or invalid file paths
- `404 Not Found` - One or more files not found

---

#### Attach Assets to Group
Attach multiple assets to an asset group by passing an array of asset IDs.

**Endpoint:** `POST /asset-groups/:id/attach-assets`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Asset Group ID (integer)

**Request Body:**
```json
{
  "assetIds": [1, 2, 3]
}
```

**Validation Rules:**
- `assetIds`: Array of asset IDs (integer), must not be empty

**Success Response (200):**
```json
{
  "message": "3 assets attached to group 1"
}
```

**Error Responses:**
- `404 Not Found` - Asset group not found
- `403 Forbidden` - You can only access your own asset groups

---

### Asset Group Module

Asset groups support hierarchical organization with parent-child relationships, allowing nested folder structures for better asset management. Groups can contain assets and can be nested up to multiple levels deep.

#### Hierarchical Organization

**Root Groups**: Top-level groups without a parent (`parentGroupId: null`)
**Child Groups**: Nested groups belonging to a parent group
**Asset Assignment**: Assets can be assigned to any group level
**Inheritance**: Child groups inherit organizational context from parents

**Hierarchy Navigation:**
- `GET /asset-groups` - Retrieve all root groups
- `GET /asset-groups/:parentId/children` - Get child groups of a specific parent
- `GET /asset-groups/:id/assets` - Get assets within a specific group

**Asset Group Management:**
- Groups can be created, updated, and deleted
- Assets can be attached to groups in bulk
- Deleting a group unassigns assets (doesn't delete them)
- Hierarchical filtering supports all group levels

#### Create Asset Group
Create a new asset group (folder) for organizing assets. Supports nested groups via `parentGroupId`.

**Endpoint:** `POST /asset-groups`

**Authentication:** Required (JWT token)

**Request Body:**
```json
{
  "name": "Product Images",
  "description": "Images for product catalog",
  "parentGroupId": null
}
```

**Request Body (Create Sub-Group):**
```json
{
  "name": "Electronics",
  "description": "Electronics product images",
  "parentGroupId": 1
}
```

**Validation Rules:**
- `name`: Required string, must be unique per user
- `description`: Optional string
- `parentGroupId`: Optional integer (parent group ID for nested structure)

**Success Response (201):**
```json
{
  "id": 1,
  "name": "Product Images",
  "description": "Images for product catalog",
  "parentGroupId": null,
  "createdDate": "2024-01-01T00:00:00.000Z",
  "totalSize": 0,
  "userId": 1,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "_count": {
    "assets": 0
  }
}
```

**Error Responses:**
- `409 Conflict` - Asset group with this name already exists
- `404 Not Found` - Parent group not found

---

#### Get All Root Asset Groups
Retrieve all root-level asset groups (no parent) with advanced filtering, sorting, and pagination.

**Endpoint:** `GET /asset-groups`

**Authentication:** Required (JWT token)

**Query Parameters:**
- `page`: Number (default: 1) - Page number
- `limit`: Number (default: 10) - Items per page (maximum: 100)
- `search`: String (optional) - Search in group name (case-insensitive)
- `minAssets`: Number (optional) - Minimum number of assets in group
- `maxAssets`: Number (optional) - Maximum number of assets in group
- `minSize`: Number (optional) - Minimum total size of assets in group (bytes)
- `maxSize`: Number (optional) - Maximum total size of assets in group (bytes)
- `createdAfter`: String (optional) - Filter groups created after date (ISO 8601 format)
- `createdBefore`: String (optional) - Filter groups created before date (ISO 8601 format)
- `sortBy`: String (optional) - Field to sort by (groupName, createdAt, updatedAt, totalSize)
- `sortOrder`: String (optional) - Sort order (asc, desc) - default: desc
- `dateFilter`: String (optional) - Quick date filter (latest, oldest)
- `hasAssets`: Boolean (optional) - Filter groups with/without assets (true, false)

**Examples:**
```
GET /asset-groups?page=1&limit=10
GET /asset-groups?search=product&sortBy=groupName&sortOrder=asc
GET /asset-groups?minAssets=5&maxAssets=100&hasAssets=true
GET /asset-groups?minSize=1000000&maxSize=100000000&sortBy=totalSize&sortOrder=desc
GET /asset-groups?createdAfter=2024-01-01&dateFilter=latest
GET /asset-groups?search=marketing&hasAssets=true&minAssets=10&sortBy=groupName&sortOrder=asc
```

**Advanced Filtering Examples:**
```bash
# Large groups with many assets
GET /asset-groups?minAssets=50&minSize=50000000&sortBy=totalSize&sortOrder=desc

# Recently created groups with assets
GET /asset-groups?hasAssets=true&createdAfter=2024-06-01&sortBy=createdAt&sortOrder=desc

# Empty groups (for cleanup)
GET /asset-groups?hasAssets=false&sortBy=groupName&sortOrder=asc

# Groups in size range
GET /asset-groups?minSize=100000&maxSize=10000000&sortBy=totalSize&sortOrder=desc

# Search with asset count filter
GET /asset-groups?search=brand&minAssets=1&maxAssets=20&hasAssets=true
```

**Success Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Product Images",
      "description": "Images for product catalog",
      "parentGroupId": null,
      "createdDate": "2024-01-01T00:00:00.000Z",
      "totalSize": 2097152,
      "userId": 1,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "_count": {
        "assets": 5
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

#### Get Children of Asset Group
Retrieve all child groups (sub-folders) of a specific asset group with advanced filtering, sorting, and pagination.

**Endpoint:** `GET /asset-groups/:parentId/children`

**Authentication:** Required (JWT token)

**Parameters:**
- `parentId`: Parent Asset Group ID (integer)

**Query Parameters:**
- `page`: Number (default: 1) - Page number
- `limit`: Number (default: 10) - Items per page (maximum: 100)
- `search`: String (optional) - Search in group name (case-insensitive)
- `minAssets`: Number (optional) - Minimum number of assets in child groups
- `maxAssets`: Number (optional) - Maximum number of assets in child groups
- `minSize`: Number (optional) - Minimum total size of assets in child groups (bytes)
- `maxSize`: Number (optional) - Maximum total size of assets in child groups (bytes)
- `createdAfter`: String (optional) - Filter child groups created after date (ISO 8601 format)
- `createdBefore`: String (optional) - Filter child groups created before date (ISO 8601 format)
- `sortBy`: String (optional) - Field to sort by (groupName, createdAt, updatedAt, totalSize)
- `sortOrder`: String (optional) - Sort order (asc, desc) - default: desc
- `dateFilter`: String (optional) - Quick date filter (latest, oldest)
- `hasAssets`: Boolean (optional) - Filter child groups with/without assets (true, false)

**Examples:**
```
GET /asset-groups/1/children?page=1&limit=10
GET /asset-groups/1/children?search=electronics&sortBy=name
GET /asset-groups/1/children?hasAssets=true&minAssets=5&sortBy=totalSize&sortOrder=desc
GET /asset-groups/1/children?createdAfter=2024-01-01&dateFilter=latest
```

**Advanced Filtering Examples:**
```bash
# Child groups with substantial content
GET /asset-groups/1/children?hasAssets=true&minAssets=10&minSize=1000000&sortBy=totalSize&sortOrder=desc

# Recently created child groups
GET /asset-groups/1/children?createdAfter=2024-06-01&sortBy=createdAt&sortOrder=desc

# Search within child groups
GET /asset-groups/1/children?search=product&hasAssets=true&sortBy=groupName&sortOrder=asc
```

**Success Response (200):**
Returns paginated list of child asset groups (same format as "Get All Root Asset Groups").

**Error Responses:**
- `404 Not Found` - Parent asset group not found
- `403 Forbidden` - You can only access your own asset groups

---

#### Get Asset Group by ID
Retrieve a specific asset group by its ID.

**Endpoint:** `GET /asset-groups/:id`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Asset Group ID (integer)

**Success Response (200):**
```json
{
  "id": 1,
  "groupName": "Product Images",
  "createdDate": "2024-01-01T00:00:00.000Z",
  "totalSize": 2097152,
  "userId": 1,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "_count": {
    "assets": 5
  }
}
```

**Error Responses:**
- `404 Not Found` - Asset group not found
- `403 Forbidden` - You can only access your own asset groups

---

#### Get Assets in Group
Retrieve all assets within a specific asset group with advanced filtering, sorting, and pagination.

**Endpoint:** `GET /asset-groups/:id/assets`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Asset Group ID (integer)

**Query Parameters:**
- `page`: Number (default: 1) - Page number
- `limit`: Number (default: 10) - Items per page (maximum: 100)
- `search`: String (optional) - Search in asset name or file name (case-insensitive)
- `mimeType`: String (optional) - Filter by MIME type (e.g., image/jpeg, application/pdf)
- `minSize`: Number (optional) - Minimum file size in bytes
- `maxSize`: Number (optional) - Maximum file size in bytes
- `sortBy`: String (optional) - Field to sort by (name, fileName, size, createdAt, updatedAt)
- `sortOrder`: String (optional) - Sort order (asc, desc) - default: desc

**Examples:**
```
GET /asset-groups/1/assets?page=1&limit=20
GET /asset-groups/1/assets?mimeType=image/png&sortBy=name
GET /asset-groups/1/assets?search=product&minSize=1000
GET /asset-groups/1/assets?mimeType=image&sortBy=size&sortOrder=desc
GET /asset-groups/1/assets?search=logo&minSize=50000&maxSize=2000000&sortBy=createdAt&sortOrder=desc
```

**Advanced Filtering Examples:**
```bash
# Large images in group
GET /asset-groups/1/assets?mimeType=image&minSize=100000&sortBy=size&sortOrder=desc

# Search for specific assets within group
GET /asset-groups/1/assets?search=banner&sortBy=name&sortOrder=asc

# Filter by file type and size range
GET /asset-groups/1/assets?mimeType=application/pdf&minSize=10000&maxSize=5000000

# Recently added assets in group
GET /asset-groups/1/assets?sortBy=createdAt&sortOrder=desc&page=1&limit=10
```

**Success Response (200):**
Returns paginated list of assets (same format as "Get All Assets" response).

**Error Responses:**
- `404 Not Found` - Asset group not found
- `403 Forbidden` - You can only access your own asset groups

---

#### Update Asset Group
Update an existing asset group.

**Endpoint:** `PATCH /asset-groups/:id`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Asset Group ID (integer)

**Request Body (partial update):**
```json
{
  "groupName": "Updated Product Images"
}
```

**Success Response (200):**
Same format as create asset group response with updated values.

**Error Responses:**
- `404 Not Found` - Asset group not found
- `403 Forbidden` - You can only access your own asset groups
- `409 Conflict` - Asset group with this name already exists

---

#### Delete Asset Group
Delete an asset group (assets within the group will be unassigned, not deleted).

**Endpoint:** `DELETE /asset-groups/:id`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Asset Group ID (integer)

**Success Response (200):**
```json
{
  "message": "Asset group successfully deleted"
}
```

**Error Responses:**
- `404 Not Found` - Asset group not found
- `403 Forbidden` - You can only access your own asset groups

---

### Notification Module

The Notification module tracks all system activities and changes across different entities.

#### Get All Notifications
Retrieve notifications with filtering options.

**Endpoint:** `GET /notifications`

**Authentication:** Required (JWT token)

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Number of items per page (default: 20)
- `entityType`: Filter by entity type (product, asset, category, family, attribute, attributeGroup, assetGroup, productVariant, productAttribute)
- `action`: Filter by action type (created, updated, deleted, bulk_created, bulk_updated, bulk_deleted, linked, unlinked)

**Examples:**
```
GET /notifications?page=1&limit=20
GET /notifications?entityType=product&action=created
GET /notifications?entityType=asset&action=deleted&page=1&limit=10
```

**Success Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "entityType": "product",
      "entityId": 15,
      "action": "created",
      "entityName": "iPhone 15 Pro",
      "message": "Product 'iPhone 15 Pro' was created",
      "metadata": {
        "sku": "IPHONE15PRO128",
        "categoryId": 3
      },
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": 2,
      "entityType": "asset",
      "entityId": 23,
      "action": "updated",
      "entityName": "Product Image",
      "message": "Asset 'Product Image' was updated",
      "metadata": {
        "fileName": "product-image.jpg",
        "size": 1048576
      },
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

#### Get Notification Statistics
Retrieve aggregated statistics about notifications.

**Endpoint:** `GET /notifications/stats`

**Authentication:** Required (JWT token)

**Success Response (200):**
```json
{
  "totalNotifications": 150,
  "byEntityType": {
    "product": 45,
    "asset": 32,
    "category": 18,
    "family": 12,
    "attribute": 25,
    "assetGroup": 8,
    "attributeGroup": 10,
    "productVariant": 5,
    "productAttribute": 3
  },
  "byAction": {
    "created": 65,
    "updated": 52,
    "deleted": 33,
    "bulk_created": 10,
    "bulk_updated": 8,
    "bulk_deleted": 5,
    "linked": 12,
    "unlinked": 7
  },
  "recentActivity": 12
}
```

---

#### Cleanup Old Notifications
Delete notifications older than the retention period (default: 90 days).

**Endpoint:** `DELETE /notifications/cleanup`

**Authentication:** Required (JWT token)

**Success Response (200):**
```json
{
  "message": "Successfully deleted 45 old notifications",
  "deletedCount": 45
}
```

---

### Support Module

The Support module handles customer support tickets with file attachment support.

#### Create Support Ticket
Submit a new support ticket with optional file attachments.

**Endpoint:** `POST /api/support/tickets`

**Authentication:** Not required

**Content-Type:** `multipart/form-data` (if including attachments) or `application/json`

**Request Body (JSON):**
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "subject": "Cannot upload assets",
  "message": "I'm experiencing issues when trying to upload large image files. The upload fails after 50%.",
  "category": "technical"
}
```

**Request Body (Multipart with Attachments):**
- `name`: String (required) - User's name
- `email`: String (required) - Valid email address
- `subject`: String (required) - Ticket subject
- `message`: String (required) - Detailed description
- `category`: String (optional) - Ticket category (technical, billing, general, etc.)
- `attachments`: File[] (optional) - Up to 10 files, max 25MB each

**Supported File Types for Attachments:**
- Images: PNG, JPG, JPEG, WEBP
- Documents: PDF
- Spreadsheets: CSV, XLSX, XLS

**Example with cURL:**
```bash
curl -X POST http://localhost:3000/api/support/tickets \
  -F "name=Jane Smith" \
  -F "email=jane.smith@example.com" \
  -F "subject=Error Screenshots" \
  -F "message=Please see attached screenshots of the error." \
  -F "category=bug" \
  -F "attachments=@/path/to/screenshot1.png" \
  -F "attachments=@/path/to/screenshot2.png"
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Support ticket submitted successfully. We'll get back to you soon!",
  "ticketId": "TICKET-20240101-001"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid submission detected (spam/bot detection)
- `400 Bad Request` - Invalid file type
- `413 Payload Too Large` - File exceeds 25MB limit
- `500 Internal Server Error` - Failed to submit support ticket

---

## Rate Limiting

Currently, no rate limiting is implemented. For production deployment, consider implementing rate limiting to prevent abuse.

## Data Types

### User Object
```typescript
{
  id: number;
  email: string;
  fullname: string | null;
  provider: "local" | "google";
  createdAt: string; // ISO 8601 date string
}
```

### Attribute Object
```typescript
{
  id: number;
  name: string;
  type: string; // 'string', 'number', 'boolean', 'date', 'enum', etc.
  userId: number;
  createdAt: string; // ISO 8601 date string
  updatedAt: string; // ISO 8601 date string
}
```

### Attribute Group Object
```typescript
{
  id: number;
  name: string;
  description: string | null;
  userId: number;
  attributes: AttributeGroupAttribute[];
}
```

### Attribute Group Attribute Object
```typescript
{
  id: number;
  attribute: {
    id: number;
    name: string;
    type: string;
    userId: number;
  };
}
```

### Family Object
```typescript
{
  id: number;
  name: string;
  userId: number;
  createdAt: string; // ISO 8601 date string
  updatedAt: string; // ISO 8601 date string
  familyAttributes: FamilyAttribute[];
}
```

### Family Attribute Object
```typescript
{
  id: number;
  familyId: number;
  attributeId: number;
  isRequired: boolean;
  defaultValue: string | null;
  createdAt: string; // ISO 8601 date string
  attribute: {
    id: number;
    name: string;
    type: string;
  };
}
```

### JWT Token Payload
```typescript
{
  sub: number; // User ID
  email: string;
  iat: number; // Issued at timestamp
  exp: number; // Expiration timestamp
}
```

### Asset Object
```typescript
{
  id: number;
  name: string;
  fileName: string; // Original filename
  filePath: string; // Server file path/Cloudinary public_id
  mimeType: string; // File MIME type
  uploadDate: string; // ISO 8601 date string
  size: number; // File size in bytes
  userId: number;
  assetGroupId: number | null;
  createdAt: string; // ISO 8601 date string
  updatedAt: string; // ISO 8601 date string
  assetGroup: AssetGroup | null;
  url: string; // Cloudinary optimized URL
  thumbnailUrl: string; // Cloudinary thumbnail URL
  formattedSize: string; // Human-readable file size (e.g., "1.5 MB")
}
```

### Asset Group Object
```typescript
{
  id: number;
  groupName: string;
  createdDate: string; // ISO 8601 date string
  totalSize: number; // Total size of all assets in bytes
  userId: number;
  createdAt: string; // ISO 8601 date string
  updatedAt: string; // ISO 8601 date string
  _count: {
    assets: number; // Number of assets in the group
  };
}
```

### Product Object
```typescript
{
  id: number;
  name: string;
  sku: string;
  productLink: string | null;
  imageUrl: string | null;
  status: "complete" | "incomplete";
  categoryId: number | null;
  attributeId: number | null;
  attributeGroupId: number | null;
  familyId: number | null;
  userId: number;
  createdAt: string; // ISO 8601 date string
  updatedAt: string; // ISO 8601 date string
  category: Category | null;
  attribute: Attribute | null;
  attributeGroup: AttributeGroup | null;
  family: Family | null;
}
```

### Category Object
```typescript
{
  id: number;
  name: string;
  description: string | null;
  parentCategoryId: number | null;
  userId: number;
  createdAt: string; // ISO 8601 date string
  updatedAt: string; // ISO 8601 date string
  parentCategory: Category | null;
  subcategories: Category[];
  productCount?: number; // Available in some endpoints
}
```

### Notification Object
```typescript
{
  id: number;
  entityType: string; // 'product', 'asset', 'category', 'family', 'attribute', 'attributeGroup', 'assetGroup', 'productVariant', 'productAttribute'
  entityId: number | null;
  action: string; // 'created', 'updated', 'deleted', 'bulk_created', 'bulk_updated', 'bulk_deleted', 'linked', 'unlinked'
  entityName: string | null;
  message: string;
  metadata: any; // Additional context data (optional)
  createdAt: string; // ISO 8601 date string
}
```

---

### Category Module

#### Create Category
Create a new category.

**Endpoint:** `POST /categories`

**Authentication:** Required (JWT token)

**Request Body:**
```json
{
  "name": "Electronics",
  "description": "Electronic devices and accessories",
  "parentCategoryId": null
}
```

**Validation Rules:**
- `name`: Required string, must be unique per user
- `description`: Optional string
- `parentCategoryId`: Optional integer (ID of parent category)

**Success Response (201):**
```json
{
  "id": 1,
  "name": "Electronics",
  "description": "Electronic devices and accessories",
  "parentCategoryId": null,
  "userId": 1,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "parentCategory": null,
  "subcategories": []
}
```

**Error Responses:**
- `409 Conflict` - Category with this name already exists
- `400 Bad Request` - Parent category not found or circular reference

---

#### Get All Categories
Retrieve all categories in hierarchical structure with product counts.

**Endpoint:** `GET /categories`

**Authentication:** Required (JWT token)

**Success Response (200):**
```json
[
  {
    "id": 1,
    "name": "Electronics",
    "description": "Electronic devices and accessories",
    "parentCategoryId": null,
    "userId": 1,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "productCount": 10,
    "subcategories": [
      {
        "id": 2,
        "name": "Smartphones",
        "description": "Mobile phones and accessories",
        "parentCategoryId": 1,
        "productCount": 5,
        "subcategories": [
          {
            "id": 3,
            "name": "iPhone",
            "description": "Apple iPhone devices",
            "parentCategoryId": 2,
            "productCount": 3,
            "subcategories": []
          }
        ]
      }
    ]
  }
]
```

---

#### Get Category Tree
Get categories as a tree structure with level and path information.

**Endpoint:** `GET /categories/tree`

**Authentication:** Required (JWT token)

**Success Response (200):**
```json
[
  {
    "id": 1,
    "name": "Electronics",
    "description": "Electronic devices and accessories",
    "level": 0,
    "path": ["Electronics"],
    "subcategories": [
      {
        "id": 2,
        "name": "Smartphones",
        "description": "Mobile phones and accessories",
        "level": 1,
        "path": ["Electronics", "Smartphones"],
        "subcategories": []
      }
    ]
  }
]
```

---

#### Get Category by ID
Retrieve a specific category with its products and subcategories with product counts.

**Endpoint:** `GET /categories/:id`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Category ID (integer)

**Success Response (200):**
```json
{
  "id": 1,
  "name": "Electronics",
  "description": "Electronic devices and accessories",
  "parentCategoryId": null,
  "userId": 1,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "parentCategory": null,
  "subcategories": [
    {
      "id": 2,
      "name": "Smartphones",
      "description": "Mobile phones and accessories",
      "parentCategoryId": 1,
      "userId": 1,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "productCount": 5
    }
  ],
  "products": [
    {
      "id": 1,
      "name": "iPhone 15 Pro",
      "sku": "IPHONE15PRO128",
      "status": "complete",
      "imageUrl": "https://example.com/iphone.jpg"
    }
  ]
}
```

**Error Responses:**
- `404 Not Found` - Category not found
- `403 Forbidden` - You can only access your own categories

---

#### Get Subcategories
Get all subcategories of a specific category.

**Endpoint:** `GET /categories/:id/subcategories`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Parent Category ID (integer)

**Success Response (200):**
```json
[
  {
    "id": 2,
    "name": "Smartphones",
    "description": "Mobile phones and accessories",
    "parentCategoryId": 1,
    "userId": 1,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "parentCategory": {
      "id": 1,
      "name": "Electronics",
      "description": "Electronic devices and accessories",
      "parentCategoryId": null,
      "userId": 1,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "subcategories": []
  }
]
```

---

#### Update Category
Update an existing category.

**Endpoint:** `PATCH /categories/:id`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Category ID (integer)

**Request Body (partial update):**
```json
{
  "name": "Updated Electronics",
  "description": "Updated description",
  "parentCategoryId": 2
}
```

**Success Response (200):**
```json
{
  "id": 1,
  "name": "Updated Electronics",
  "description": "Updated description",
  "parentCategoryId": 2,
  "userId": 1,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "parentCategory": {
    "id": 2,
    "name": "Parent Category",
    "description": "Parent description",
    "parentCategoryId": null,
    "userId": 1,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "subcategories": []
}
```

**Error Responses:**
- `404 Not Found` - Category not found
- `403 Forbidden` - You can only access your own categories
- `409 Conflict` - Category with this name already exists
- `400 Bad Request` - Cannot create circular reference

---

#### Delete Category
Delete a category (must not have subcategories).

**Endpoint:** `DELETE /categories/:id`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Category ID (integer)

**Success Response (200):**
```json
{
  "message": "Category successfully deleted"
}
```

**Error Responses:**
- `404 Not Found` - Category not found
- `403 Forbidden` - You can only access your own categories
- `400 Bad Request` - Cannot delete category that has subcategories

---

### Product Module

#### Create Product
Create a new product.

**Endpoint:** `POST /products`

**Authentication:** Required (JWT token)

**Request Body:**
```json
{
  "name": "iPhone 15 Pro",
  "sku": "IPHONE15PRO128",
  "productLink": "https://apple.com/iphone-15-pro",
  "imageUrl": "https://example.com/images/iphone15pro.jpg",
  "subImages": ["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
  "status": "complete",
  "categoryId": 3,
  "attributeGroupId": 1,
  "familyId": 1,
  "parentSku": "IPHONE15PRO",
  "familyAttributesWithValues": [
    {
      "attributeId": 10,
      "value": "Apple"
    },
    {
      "attributeId": 11,
      "value": "Pro Max"
    }
  ],
  "attributesWithValues": [
    {
      "attributeId": 1,
      "value": "Premium"
    }
  ]
}
```

**Validation Rules:**
- `name`: Required string, must be unique per user
- `sku`: Required string, must be unique per user
- `productLink`: Optional valid URL
- `imageUrl`: Optional valid URL
- `subImages`: Optional array of valid URLs
- `status`: Optional string ("complete" or "incomplete", default: "incomplete")
- `categoryId`: Optional integer (must belong to user)
- `attributeGroupId`: Optional integer (must belong to user)
- `familyId`: Optional integer (must belong to user)
- `parentSku`: Optional string (4-40 characters) - Creates product as variant of parent product with this SKU
- `familyAttributesWithValues`: Optional array of family attribute values (requires familyId)
- `attributesWithValues`: Optional array of regular attribute values

**Success Response (201):**
```json
{
  "id": 1,
  "name": "iPhone 15 Pro",
  "sku": "IPHONE15PRO128",
  "productLink": "https://apple.com/iphone-15-pro",
  "imageUrl": "https://example.com/images/iphone15pro.jpg",
  "status": "complete",
  "categoryId": 3,
  "attributeGroupId": 1,
  "familyId": 1,
  "userId": 1,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "category": {
    "id": 3,
    "name": "iPhone",
    "description": "Apple iPhone devices"
  },
  "attributeGroup": {
    "id": 1,
    "name": "Product Attributes",
    "description": "Basic product attributes"
  },
  "family": {
    "id": 1,
    "name": "Electronics"
  }
}
```

**Error Responses:**
- `409 Conflict` - Product with this name or SKU already exists
- `400 Bad Request` - Category/attribute/attributeGroup/family not found or doesn't belong to user

---

#### Get All Products
Retrieve all products with filtering options.

**Endpoint:** `GET /products`

**Authentication:** Required (JWT token)

**Query Parameters:**
- `search`: Search products by name or SKU (case-insensitive)
- `status`: Filter by status ("complete" or "incomplete")
- `categoryId`: Filter by category ID
- `attributeId`: Filter by attribute ID
- `attributeGroupId`: Filter by attribute group ID
- `familyId`: Filter by family ID
- `page`: Page number (default: 1)
- `limit`: Number of items per page (default: 10)

**Example:** `GET /products?search=iphone&status=complete&categoryId=1&familyId=2`

**Success Response (200):**
```json
[
  {
    "id": 1,
    "name": "iPhone 15 Pro",
    "sku": "IPHONE15PRO128",
    "productLink": "https://apple.com/iphone-15-pro",
    "imageUrl": "https://example.com/images/iphone15pro.jpg",
    "status": "complete",
    "categoryId": 3,
    "attributeGroupId": 1,
    "familyId": 1,
    "userId": 1,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "category": {
      "id": 3,
      "name": "iPhone",
      "description": "Apple iPhone devices"
    },
    "attributeGroup": {
      "id": 1,
      "name": "Product Attributes",
      "description": "Basic product attributes"
    },
    "family": {
      "id": 1,
      "name": "Electronics"
    }
  }
]
```

---

#### Get Product by ID
Retrieve a specific product by its ID.

**Endpoint:** `GET /products/:id`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Product ID (integer)

**Success Response (200):**
```json
{
  "id": 1,
  "name": "iPhone 15 Pro",
  "sku": "IPHONE15PRO128",
  "productLink": "https://apple.com/iphone-15-pro",
  "imageUrl": "https://example.com/images/iphone15pro.jpg",
  "status": "complete",
  "categoryId": 3,
  "attributeGroupId": 1,
  "familyId": 1,
  "userId": 1,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "category": {
    "id": 3,
    "name": "iPhone",
    "description": "Apple iPhone devices"
  },
  "attributeGroup": {
    "id": 1,
    "name": "Product Attributes",
    "description": "Basic product attributes"
  },
  "family": {
    "id": 1,
    "name": "Electronics"
  }
}
```

**Error Responses:**
- `404 Not Found` - Product not found
- `403 Forbidden` - You can only access your own products

---

#### Get Product by SKU
Retrieve a product by its SKU.

**Endpoint:** `GET /products/sku/:sku`

**Authentication:** Required (JWT token)

**Parameters:**
- `sku`: Product SKU (string)

**Success Response (200):**
Same as Get Product by ID response.

**Error Responses:**
- `404 Not Found` - Product not found
- `403 Forbidden` - You can only access your own products

---

#### Get Products by Category
Retrieve all products in a specific category.

**Endpoint:** `GET /products/category/:categoryId`

**Authentication:** Required (JWT token)

**Parameters:**
- `categoryId`: Category ID (integer)

**Success Response (200):**
Array of products (same format as Get All Products).

---

#### Update Product
Update an existing product.

**Endpoint:** `PATCH /products/:id`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Product ID (integer)

**Request Body (partial update):**
```json
{
  "name": "iPhone 15 Pro Max",
  "status": "complete",
  "categoryId": 4,
  "familyId": null
}
```

**Success Response (200):**
Same format as Create Product response with updated values.

**Error Responses:**
- `404 Not Found` - Product not found
- `403 Forbidden` - You can only access your own products
- `409 Conflict` - Product with this name or SKU already exists

---

#### Delete Product
Delete a product.

**Endpoint:** `DELETE /products/:id`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Product ID (integer)

**Success Response (200):**
```json
{
  "message": "Product successfully deleted"
}
```

**Error Responses:**
- `404 Not Found` - Product not found
- `403 Forbidden` - You can only access your own products

---

#### Create Product Variants
Create direct variant relationships between a main product and specified variant products.

**Endpoint:** `POST /products/variants`

**Authentication:** Required (JWT token)

**Behavior:** Creates only direct relationships between `productId` and each product in `variantProductIds`. This creates a star pattern where the main product is directly linked to each variant, but variants are NOT automatically linked to each other.

**Example:**
If you link product 1 to products [2, 3, 4], it creates:
- 1 ↔ 2
- 1 ↔ 3  
- 1 ↔ 4

But NOT: 2 ↔ 3, 2 ↔ 4, or 3 ↔ 4

**Request Body:**
```json
{
  "productId": 1,
  "variantProductIds": [2, 3, 4]
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/products/variants \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "productId": 1,
    "variantProductIds": [2, 3, 4]
  }'
```

**Success Response (201):**
```json
{
  "message": "Successfully created 3 direct variant relationships. Each selected product is now linked directly to product 1.",
  "created": 3
}
```

**Error Responses:**
- `400 Bad Request` - Invalid product IDs or self-referencing variants
- `404 Not Found` - One or more products not found
- `409 Conflict` - Variant relationship already exists

---

#### Get All Product Variants
Get all product variants for the authenticated user with pagination and sorting.

**Endpoint:** `GET /products/variants`

**Authentication:** Required (JWT token)

**Query Parameters:**
- `page`: Page number (default: 1, minimum: 1)
- `limit`: Number of items per page (default: 10, minimum: 1, maximum: 100)
- `sortBy`: Field to sort by - "name" or "sku" (default: "name")
- `sortOrder`: Sort order - "asc" or "desc" (default: "asc")
- `search`: Search term to filter by product name or SKU (case-insensitive partial matching)
- `status`: Filter products by status - "complete" or "incomplete"

**Examples:**
```bash
# Basic request
curl -X GET http://localhost:3000/products/variants \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# With pagination
curl -X GET http://localhost:3000/products/variants?page=2&limit=5 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# With sorting by name descending
curl -X GET http://localhost:3000/products/variants?sortBy=name&sortOrder=desc \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# With sorting by SKU ascending
curl -X GET http://localhost:3000/products/variants?sortBy=sku&sortOrder=asc \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# With search filtering
curl -X GET http://localhost:3000/products/variants?search=iPhone \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# With status filtering (complete products only)
curl -X GET http://localhost:3000/products/variants?status=complete \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# With status filtering (incomplete products only)
curl -X GET http://localhost:3000/products/variants?status=incomplete \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# Combined search and status filtering
curl -X GET http://localhost:3000/products/variants?search=Pro&status=complete \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# Combined pagination and sorting
curl -X GET http://localhost:3000/products/variants?page=1&limit=10&sortBy=name&sortOrder=asc \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# Full query with all parameters
curl -X GET http://localhost:3000/products/variants?search=iPhone&status=complete&page=1&limit=5&sortBy=sku&sortOrder=desc \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

**Success Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "productAId": 1,
      "productBId": 2,
      "productA": {
        "id": 1,
        "name": "iPhone 15 Pro",
        "sku": "IPH-15-PRO-256",
        "imageUrl": "https://example.com/image.jpg",
        "status": "active"
      },
      "productB": {
        "id": 2,
        "name": "iPhone 15 Pro Max",
        "sku": "IPH-15-PMAX-256",
        "imageUrl": "https://example.com/image2.jpg",
        "status": "active"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

#### Get Product Variants for Specific Product
Get all variants of a specific product with pagination and sorting.

**Endpoint:** `GET /products/:id/variants`

**Authentication:** Required (JWT token)

**Parameters:**
- `id`: Product ID (integer)

**Query Parameters:**
- `page`: Page number (default: 1, minimum: 1)
- `limit`: Number of items per page (default: 10, minimum: 1, maximum: 100)
- `sortBy`: Field to sort by - "name" or "sku" (default: "name")
- `sortOrder`: Sort order - "asc" or "desc" (default: "asc")
- `search`: Search term to filter by product name or SKU (case-insensitive partial matching)
- `status`: Filter products by status - "complete" or "incomplete"

**Examples:**
```bash
# Basic request
curl -X GET http://localhost:3000/products/1/variants \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# With pagination
curl -X GET http://localhost:3000/products/1/variants?page=2&limit=5 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# With sorting by SKU descending
curl -X GET http://localhost:3000/products/1/variants?sortBy=sku&sortOrder=desc \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# With search filtering
curl -X GET http://localhost:3000/products/1/variants?search=Pro \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# With status filtering (complete products only)
curl -X GET http://localhost:3000/products/1/variants?status=complete \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# With status filtering (incomplete products only)
curl -X GET http://localhost:3000/products/1/variants?status=incomplete \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# Combined search and status filtering
curl -X GET http://localhost:3000/products/1/variants?search=Max&status=complete \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# Full query with all parameters
curl -X GET http://localhost:3000/products/1/variants?search=iPhone&status=complete&page=1&limit=5&sortBy=sku&sortOrder=desc \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

**Success Response (200):**
Same format as "Get All Product Variants" response.

**Error Responses:**
- `400 Bad Request` - Invalid product ID or query parameters
- `404 Not Found` - Product not found
- `403 Forbidden` - You can only access your own products

---

#### Remove Product Variant
Remove a specific variant relationship between two products.

**Endpoint:** `DELETE /products/variants/:productId/:variantProductId`

**Authentication:** Required (JWT token)

**Parameters:**
- `productId`: Product ID (integer)
- `variantProductId`: Variant Product ID (integer)

**Behavior:** Removes only the direct relationship between the two specified products. Other variant relationships remain intact.

**Example:**
If products A, B, and C are all linked as variants (A↔B, A↔C, B↔C), removing the relationship between A and B will only remove A↔B, leaving A↔C and B↔C intact.

```bash
curl -X DELETE https://pixelpim.onrender.com/products/variants/433/432 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

**Success Response (200):**
```json
{
  "message": "Successfully removed variant relationship between products 433 and 432."
}
```

**Error Responses:**
- `404 Not Found` - Product or variant relationship not found
- `400 Bad Request` - Invalid productId or variantProductId
- `403 Forbidden` - You can only modify your own products

---

## Testing with cURL

### Send OTP
```bash
curl -X POST http://localhost:3000/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### Verify OTP
```bash
curl -X POST http://localhost:3000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","otp":"123456"}'
```

### Complete Registration
```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "fullname":"Test User",
    "password":"password123",
    "otp":"123456"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Get Profile
```bash
curl -X GET http://localhost:3000/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Create Attribute
```bash
curl -X POST http://localhost:3000/attributes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{"name":"Brand","type":"string"}'
```

### Get All Attributes
```bash
curl -X GET http://localhost:3000/attributes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Create Attribute Group
```bash
curl -X POST http://localhost:3000/attribute-groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "name":"Product Attributes",
    "description":"Attributes related to product information.",
    "attributes":[
      {"attributeId":1,"required":true,"defaultValue":"Unknown"},
      {"attributeId":2,"required":false,"defaultValue":"0"}
    ]
  }'
```

### Get All Attribute Groups
```bash
curl -X GET http://localhost:3000/attribute-groups \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Create Family
```bash
curl -X POST http://localhost:3000/families \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "name":"Electronics",
    "requiredAttributes":[
      {"attributeId":1,"defaultValue":"Unknown Brand"}
    ],
    "otherAttributes":[
      {"attributeId":2,"defaultValue":"0"}
    ]
  }'
```

### Get All Families
```bash
curl -X GET http://localhost:3000/families \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Upload Asset
```bash
curl -X POST http://localhost:3000/assets/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -F "file=@/path/to/your/image.jpg" \
  -F "name=Product Image 1" \
  -F "assetGroupId=1"
```

### Get All Assets
```bash
curl -X GET http://localhost:3000/assets \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Get Assets by Group
```bash
curl -X GET "http://localhost:3000/assets?assetGroupId=1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Create Asset Group
```bash
curl -X POST http://localhost:3000/asset-groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{"groupName":"Product Images"}'
```

### Get All Asset Groups
```bash
curl -X GET http://localhost:3000/asset-groups \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Get Assets in Specific Group
```bash
curl -X GET http://localhost:3000/asset-groups/1/assets \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Create Product
```bash
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "name":"iPhone 15 Pro",
    "sku":"IPHONE15PRO128",
    "productLink":"https://apple.com/iphone-15-pro",
    "imageUrl":"https://example.com/images/iphone15pro.jpg",
    "status":"complete",
    "categoryId":3,
    "attributeGroupId":1,
    "familyId":1,
    "familyAttributesWithValues":[
      {"attributeId":10,"value":"Apple"},
      {"attributeId":11,"value":"Pro Max"}
    ],
    "attributesWithValues":[
      {"attributeId":1,"value":"Premium"}
    ]
  }'
```

### Get All Products
```bash
curl -X GET http://localhost:3000/products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# With search
curl -X GET "http://localhost:3000/products?search=iphone" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# With multiple filters
curl -X GET "http://localhost:3000/products?search=galaxy&status=complete&page=1&limit=5" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Create Category
```bash
curl -X POST http://localhost:3000/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "name":"Electronics",
    "description":"Electronic devices and accessories",
    "parentCategoryId":null
  }'
```

### Get All Categories
```bash
curl -X GET http://localhost:3000/categories \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Get Notifications
```bash
# Get all notifications
curl -X GET http://localhost:3000/notifications?page=1&limit=20 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# Filter by entity type
curl -X GET "http://localhost:3000/notifications?entityType=product&action=created" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Get Notification Statistics
```bash
curl -X GET http://localhost:3000/notifications/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Cleanup Old Notifications
```bash
curl -X DELETE http://localhost:3000/notifications/cleanup \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Create Support Ticket
```bash
# Without attachments
curl -X POST http://localhost:3000/api/support/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "name":"John Doe",
    "email":"john.doe@example.com",
    "subject":"Cannot upload assets",
    "message":"I am experiencing issues when trying to upload large image files.",
    "category":"technical"
  }'

# With attachments
curl -X POST http://localhost:3000/api/support/tickets \
  -F "name=Jane Smith" \
  -F "email=jane.smith@example.com" \
  -F "subject=Error Screenshots" \
  -F "message=Please see attached screenshots of the error." \
  -F "category=bug" \
  -F "attachments=@/path/to/screenshot.png"
```

### Export Assets
```bash
# Export as JSON
curl -X POST http://localhost:3000/assets/export \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{"format":"json","assetGroupId":1}'

# Export as XML
curl -X POST http://localhost:3000/assets/export \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{"format":"xml","includeMetadata":true}'
```

### Download Assets as ZIP
```bash
curl -X POST http://localhost:3000/assets/zip \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "files":[
      "/uploads/assets/file1.jpg",
      "/uploads/assets/file2.png"
    ]
  }'
```

### Get Asset Group Children
```bash
curl -X GET http://localhost:3000/asset-groups/1/children?page=1&limit=10 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Get Available Attribute Types
```bash
curl -X GET http://localhost:3000/attributes/types \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Create Attribute
```bash
curl -X POST http://localhost:3000/attributes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{"name":"Brand","type":"text","description":"Product brand name","options":["Apple","Samsung","Google"]}'
```

### Get All Attributes
```bash
curl -X GET http://localhost:3000/attributes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# With filtering
curl -X GET "http://localhost:3000/attributes?type=text&isRequired=false&search=brand&sortBy=name" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Get Attribute by ID
```bash
curl -X GET http://localhost:3000/attributes/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Update Attribute
```bash
curl -X PATCH http://localhost:3000/attributes/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{"name":"Updated Brand","description":"Updated description"}'
```

### Delete Attribute
```bash
curl -X DELETE http://localhost:3000/attributes/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Create Attribute Group
```bash
curl -X POST http://localhost:3000/attribute-groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "name":"Product Attributes",
    "description":"Attributes related to product information.",
    "attributes":[
      {"attributeId":1,"required":true,"defaultValue":"Unknown"},
      {"attributeId":2,"required":false,"defaultValue":"0"}
    ]
  }'
```

### Get All Attribute Groups
```bash
curl -X GET http://localhost:3000/attribute-groups \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# With filtering
curl -X GET "http://localhost:3000/attribute-groups?search=product&sortBy=name" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Get Attribute Group by ID
```bash
curl -X GET http://localhost:3000/attribute-groups/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Update Attribute Group
```bash
curl -X PATCH http://localhost:3000/attribute-groups/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "name":"Updated Product Attributes",
    "description":"Updated description",
    "attributes":[
      {"attributeId":1,"required":true,"defaultValue":"Default Brand"}
    ]
  }'
```

### Add Attribute to Group
```bash
curl -X POST http://localhost:3000/attribute-groups/1/attributes/5 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Remove Attribute from Group
```bash
curl -X DELETE http://localhost:3000/attribute-groups/1/attributes/5 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Delete Attribute Group
```bash
curl -X DELETE http://localhost:3000/attribute-groups/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Get Attributes with Product Counts
```bash
curl -X GET http://localhost:3000/attributes/with-product-counts?page=1&limit=20 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Get Attribute Suggestions
```bash
curl -X GET "http://localhost:3000/attributes/attribute-suggestions?productId=1&attributeId=1&query=Bl" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Get Category Tree
```bash
curl -X GET http://localhost:3000/categories/tree \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Get Subcategories
```bash
curl -X GET http://localhost:3000/categories/1/subcategories?page=1&limit=10 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

---

## Additional Resources

- [Pagination Guide](./PAGINATION_GUIDE.md) - Detailed pagination implementation
- [Filtering Guide](./FILTERING_GUIDE.md) - Advanced filtering options
- [Asset Export Guide](./ASSET_EXPORT_GUIDE.md) - Asset export functionality
- [Variant Import Guide](./VARIANT_IMPORT_GUIDE.md) - Product variant management
- [CSV Import Guide](./CSV_IMPORT_GUIDE.md) - Bulk product import
- [WooCommerce Integration](./WOOCOMMERCE_QUICK_START.md) - WooCommerce marketplace integration

---

**Last Updated:** November 2, 2025  
**API Version:** 1.0  
**Base URL:** http://localhost:3000

For any questions or issues, please contact support or create a support ticket through the `/api/support/tickets` endpoint.
