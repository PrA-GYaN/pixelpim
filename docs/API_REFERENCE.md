# API Reference

This document provides detailed information about all available API endpoints in the PixelPim Backend.

## Base URL
```
http://localhost:3000
```

## Authentication

Most endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

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
- `409` - Conflict
- `500` - Internal Server Error

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

#### Create Attribute
Create a new attribute.

**Endpoint:** `POST /attributes`

**Authentication:** Required (JWT token)

**Request Body:**
```json
{
  "name": "Brand",
  "type": "string"
}
```

**Validation Rules:**
- `name`: Required string, must be unique
- `type`: Required string (e.g., 'string', 'number', 'boolean', 'date', 'enum')

**Success Response (201):**
```json
{
  "id": 1,
  "name": "Brand",
  "type": "string",
  "userId": 1,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `409 Conflict` - Attribute with this name already exists
- `400 Bad Request` - Invalid attribute type

---

#### Get All Attributes
Retrieve all attributes for the authenticated user.

**Endpoint:** `GET /attributes`

**Authentication:** Required (JWT token)

**Success Response (200):**
```json
[
  {
    "id": 1,
    "name": "Brand",
    "type": "string",
    "userId": 1,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "id": 2,
    "name": "Price",
    "type": "number",
    "userId": 1,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

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
  "status": "complete",
  "categoryId": 3,
  "attributeId": 1,
  "attributeGroupId": 1,
  "familyId": 1
}
```

**Validation Rules:**
- `name`: Required string, must be unique per user
- `sku`: Required string, must be unique per user
- `productLink`: Optional valid URL
- `imageUrl`: Optional valid URL
- `status`: Optional string ("complete" or "incomplete", default: "incomplete")
- `categoryId`: Optional integer (must belong to user)
- `attributeId`: Optional integer (must belong to user)
- `attributeGroupId`: Optional integer (must belong to user)
- `familyId`: Optional integer (must belong to user)

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
  "attributeId": 1,
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
  "attribute": {
    "id": 1,
    "name": "Brand",
    "type": "string",
    "defaultValue": null
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
- `status`: Filter by status ("complete" or "incomplete")
- `categoryId`: Filter by category ID
- `attributeId`: Filter by attribute ID
- `attributeGroupId`: Filter by attribute group ID
- `familyId`: Filter by family ID

**Example:** `GET /products?status=complete&categoryId=1&familyId=2`

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
    "attributeId": 1,
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
    "attribute": {
      "id": 1,
      "name": "Brand",
      "type": "string",
      "defaultValue": null
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
  "attributeId": 1,
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
  "attribute": {
    "id": 1,
    "name": "Brand",
    "type": "string",
    "defaultValue": null
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
