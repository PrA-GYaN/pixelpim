# PixelPim Backend

A secure and scalable backend API for PixelPim application built with NestJS, featuring robust authentication with OTP verification, Google OAuth integration, and JWT-based security.

## 🚀 Features

- **Multi-factor Authentication** - OTP-based email verification for secure registration
- **Google OAuth Integration** - Seamless social login with Google
- **JWT Authentication** - Secure token-based authentication
- **Email Services** - Automated OTP delivery via email
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

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and questions:
- Create an issue in the repository
- Contact the development team

## 🔄 API Testing

Use the included `api-tests.http` file with REST Client extension in VS Code for easy API testing, or import the endpoints into Postman/Insomnia.
