# PixelPim Backend

A secure and scalable backend API for PixelPim application built with NestJS, featuring robust authentication with OTP verification, Google OAuth integration, and JWT-based security.

## 🚀 Features

- **Multi-factor Authentication** - OTP-based email verification for secure registration
- **Google OAuth Integration** - Seamless social login with Google
- **JWT Authentication** - Secure token-based authentication
- **Email Services** - Automated OTP delivery via email
- **Attribute Management** - CRUD operations for custom attributes with type validation
- **Attribute Groups** - Create and manage groups of attributes with configuration options
- **Flexible Data Modeling** - Support for string, number, boolean, date, and enum attribute types
- **Database Integration** - PostgreSQL with Prisma ORM
- **Type Safety** - Full TypeScript implementation
- **API Documentation** - Comprehensive endpoint documentation
- **Testing Suite** - Unit and e2e testing capabilities

## 🛠️ Tech Stack

- **Framework**: NestJS (Node.js)
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT, Passport
- **Email**: Nodemailer
- **Validation**: class-validator, class-transformer
- **Security**: bcryptjs for password hashing

## 📋 Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- npm or yarn package manager

## ⚙️ Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd PixelPim_backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Configuration**
Create a `.env` file in the root directory:
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/pixelpim_db"

# JWT
JWT_SECRET="your-jwt-secret-key"
JWT_EXPIRES_IN="7d"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Email Configuration (for OTP)
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"
EMAIL_FROM="noreply@pixelpim.com"

# Application
PORT=3000
```

4. **Database Setup**
```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# (Optional) Seed the database
npx prisma db seed
```
## 🚀 Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run start:prod

# Debug mode
npm run start:debug
```

The API will be available at `http://localhost:3000`

## 📚 API Documentation

### Authentication Endpoints

#### 1. Send OTP for Registration
**POST** `/auth/send-otp`

Initiates the registration process by sending an OTP to the user's email.

```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "OTP sent successfully to your email",
  "email": "user@example.com"
}
```

#### 2. Verify OTP
**POST** `/auth/verify-otp`

Verifies the OTP code sent to the user's email.

```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

#### 3. Complete Registration
**POST** `/auth/signup`

Completes user registration after OTP verification.

```json
{
  "email": "user@example.com",
  "fullname": "John Doe",
  "password": "securePassword123",
  "otp": "123456"
}
```

#### 4. User Login
**POST** `/auth/login`

Authenticates existing users with email and password.

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

#### 5. Google OAuth Login
**GET** `/auth/google`

Initiates Google OAuth flow. Redirects to Google for authentication.

**GET** `/auth/google/callback`

Google OAuth callback endpoint.

#### 6. Get User Profile
**GET** `/auth/profile`

Returns authenticated user's profile information.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

### Attribute Management Endpoints

#### 1. Create Attribute
**POST** `/attributes`

Creates a new attribute with specified name and type.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Body:**
```json
{
  "name": "Product Name",
  "type": "string"
}
```

**Supported Types:** `string`, `number`, `boolean`, `date`, `enum`

#### 2. Get All Attributes
**GET** `/attributes`

Returns all attributes ordered by creation date.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

#### 3. Get Attribute by ID
**GET** `/attributes/:id`

Returns a specific attribute with its associated attribute groups.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

#### 4. Update Attribute
**PATCH** `/attributes/:id`

Updates an existing attribute.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Body:**
```json
{
  "name": "Updated Product Name",
  "type": "string"
}
```

#### 5. Delete Attribute
**DELETE** `/attributes/:id`

Deletes an attribute and removes it from all attribute groups.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

### Attribute Group Management Endpoints

#### 1. Create Attribute Group
**POST** `/attribute-groups`

Creates a new attribute group with selected attributes.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Body:**
```json
{
  "name": "Product Attributes",
  "description": "Basic product information attributes",
  "attributes": [
    {
      "attributeId": 1,
      "required": true
    },
    {
      "attributeId": 2,
      "required": true,
      "defaultValue": "0"
    },
    {
      "attributeId": 3,
      "required": false,
      "defaultValue": "true"
    }
  ]
}
```

#### 2. Get All Attribute Groups
**GET** `/attribute-groups`

Returns all attribute groups with their associated attributes.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

#### 3. Get Attribute Group by ID
**GET** `/attribute-groups/:id`

Returns a specific attribute group with all its attributes.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

#### 4. Update Attribute Group
**PATCH** `/attribute-groups/:id`

Updates an existing attribute group and its attribute associations.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Body:**
```json
{
  "name": "Updated Product Attributes",
  "description": "Updated description",
  "attributes": [
    {
      "attributeId": 1,
      "required": true
    },
    {
      "attributeId": 2,
      "required": false,
      "defaultValue": "10"
    }
  ]
}
```

#### 5. Add Attribute to Group
**POST** `/attribute-groups/:id/attributes/:attributeId`

Adds an existing attribute to an attribute group.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Body:**
```json
{
  "required": false,
  "defaultValue": "default_value"
}
```

#### 6. Remove Attribute from Group
**DELETE** `/attribute-groups/:id/attributes/:attributeId`

Removes an attribute from an attribute group.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

#### 7. Delete Attribute Group
**DELETE** `/attribute-groups/:id`

Deletes an attribute group and all its attribute associations.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

## 🔐 Authentication Flow

### Standard Registration Flow
1. **Send OTP** → User provides email
2. **Verify OTP** → User enters 6-digit code from email
3. **Complete Signup** → User provides full details with verified OTP
4. **Auto Login** → System returns JWT token

### Google OAuth Flow
1. **Initiate** → Redirect to `/auth/google`
2. **Google Auth** → User authenticates with Google
3. **Callback** → System processes Google response
4. **Auto Login** → System returns JWT token

### Login Flow
1. **Credentials** → User provides email/password
2. **Validation** → System verifies credentials
3. **Token** → System returns JWT token

## 🗄️ Database Schema

### User Model
```prisma
model User {
  id          Int      @id @default(autoincrement())
  email       String   @unique
  fullname    String?
  password    String?  // Optional for Google OAuth users
  googleId    String?  @unique
  provider    String   @default("local") // "local" or "google"
  createdAt   DateTime @default(now())
}
```

### OTP Model
```prisma
model Otp {
  id        Int      @id @default(autoincrement())
  email     String
  code      String
  type      String   // 'registration' or 'login'
  verified  Boolean  @default(false)
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

### Attribute Model
```prisma
model Attribute {
  id               Int                @id @default(autoincrement())
  name             String             @unique
  type             String             // 'string', 'number', 'boolean', 'date', 'enum'
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt
  attributeGroups  AttributeGroupAttribute[]
}
```

### AttributeGroup Model
```prisma
model AttributeGroup {
  id          Int                     @id @default(autoincrement())
  name        String                  @unique
  description String?
  createdAt   DateTime                @default(now())
  updatedAt   DateTime                @updatedAt
  attributes  AttributeGroupAttribute[]
}
```

### AttributeGroupAttribute Model (Junction Table)
```prisma
model AttributeGroupAttribute {
  id              Int            @id @default(autoincrement())
  attributeId     Int
  attributeGroupId Int
  required        Boolean        @default(false)
  defaultValue    String?
  createdAt       DateTime       @default(now())
  
  attribute       Attribute      @relation(fields: [attributeId], references: [id], onDelete: Cascade)
  attributeGroup  AttributeGroup @relation(fields: [attributeGroupId], references: [id], onDelete: Cascade)
  
  @@unique([attributeId, attributeGroupId])
}
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov

# Watch mode
npm run test:watch
```

## 🔧 Development Tools

```bash
# Format code
npm run format

# Lint code
npm run lint

# Build project
npm run build
```

## 📁 Project Structure

```
src/
├── auth/                   # Authentication module
│   ├── dto/               # Data Transfer Objects
│   ├── guards/            # Authentication guards
│   ├── strategies/        # Passport strategies
│   ├── auth.controller.ts # Authentication endpoints
│   ├── auth.service.ts    # Authentication business logic
│   └── email.service.ts   # Email service for OTP
├── attribute/             # Attribute management module
│   ├── dto/              # Attribute DTOs
│   ├── attribute.controller.ts # Attribute CRUD endpoints
│   ├── attribute.service.ts    # Attribute business logic
│   └── attribute.module.ts     # Attribute module
├── attribute-group/       # Attribute group management module
│   ├── dto/              # Attribute group DTOs
│   ├── attribute-group.controller.ts # Attribute group CRUD endpoints
│   ├── attribute-group.service.ts    # Attribute group business logic
│   └── attribute-group.module.ts     # Attribute group module
├── prisma/                # Database module
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── app.module.ts          # Root application module
└── main.ts               # Application entry point
```

## 🚀 Deployment

### Environment Setup
1. Set up PostgreSQL database
2. Configure environment variables
3. Run database migrations
4. Build and start application

### Production Commands
```bash
# Build application
npm run build

# Start production server
npm run start:prod
```

## 🔒 Security Features

- **Password Hashing** - bcryptjs with salt rounds
- **JWT Tokens** - Secure token-based authentication
- **OTP Verification** - Email-based two-factor authentication
- **Input Validation** - Comprehensive request validation
- **CORS Protection** - Cross-origin request handling
- **Rate Limiting** - API rate limiting (recommended for production)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
