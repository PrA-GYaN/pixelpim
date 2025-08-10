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
- `401 Unauthorized` - Invalid credentials
- `401 Unauthorized` - Please use Google login for this account (for Google OAuth users)

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

**Description:** Automatically called by Google after user consent. Returns HTML page with JWT token.

**Success Response:** HTML page containing JWT token and user information.

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

### JWT Token Payload
```typescript
{
  sub: number; // User ID
  email: string;
  iat: number; // Issued at timestamp
  exp: number; // Expiration timestamp
}
```

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
