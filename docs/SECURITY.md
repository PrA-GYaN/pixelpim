# Security Guide

This document outlines the security measures implemented in the PixelPim Backend and provides guidelines for maintaining security.

## 🔒 Security Features

### 1. Authentication & Authorization

#### JWT (JSON Web Tokens)
- **Implementation**: Secure token-based authentication
- **Expiration**: Configurable token lifetime (default: 7 days)
- **Secret**: Strong, randomly generated secret key
- **Algorithm**: HS256 (HMAC with SHA-256)

```typescript
// JWT Configuration
{
  secret: process.env.JWT_SECRET, // Minimum 32 characters
  signOptions: {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
}
```

#### Password Security
- **Hashing**: bcryptjs with salt rounds (default: 10)
- **Minimum Length**: 6 characters (configurable)
- **No Plain Text**: Passwords never stored in plain text

```typescript
// Password hashing
const hashedPassword = await bcrypt.hash(password, 10);

// Password verification
const isValid = await bcrypt.compare(password, hashedPassword);
```

#### Multi-Factor Authentication (MFA)
- **OTP Verification**: Email-based one-time passwords
- **Expiration**: 10-minute OTP validity
- **Rate Limiting**: Prevents OTP flooding

### 2. Input Validation & Sanitization

#### Request Validation
- **DTOs**: Data Transfer Objects with class-validator
- **Automatic Validation**: NestJS validation pipes
- **Type Safety**: TypeScript compile-time checks

```typescript
// Example DTO with validation
export class SignupDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  fullname: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password: string;
}
```

#### SQL Injection Prevention
- **Prisma ORM**: Parameterized queries by default
- **No Raw SQL**: Avoid raw database queries
- **Input Sanitization**: Automatic parameter binding

### 3. Authentication Guards

#### JWT Authentication Guard
```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
```

#### Route Protection
```typescript
@UseGuards(JwtAuthGuard)
@Get('profile')
getProfile(@Request() req) {
  return req.user;
}
```

### 4. OAuth Security

#### Google OAuth 2.0
- **Secure Redirect**: Validated redirect URIs
- **State Parameter**: CSRF protection
- **Scope Limitation**: Minimal required scopes

```typescript
// Google OAuth Strategy
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }
}
```

### 5. Email Security

#### SMTP Security
- **TLS Encryption**: Secure email transmission
- **Authentication**: SMTP credentials
- **Rate Limiting**: Prevent email spam

```typescript
// Secure email configuration
const transporter = nodemailer.createTransporter({
  host: process.env.EMAIL_HOST,
  port: 587,
  secure: false, // Use STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: true,
  },
});
```

## 🛡️ Security Best Practices

### 1. Environment Variables

#### Secure Configuration
```env
# Strong JWT secret (minimum 32 characters)
JWT_SECRET="your-super-secure-random-string-minimum-32-characters"

# Database with connection limits
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20"

# Secure email credentials
EMAIL_PASS="app-specific-password-not-account-password"
```

#### Environment Security
- **No Hardcoding**: Never hardcode secrets in source code
- **Environment Isolation**: Different secrets per environment
- **Secret Rotation**: Regular secret updates
- **Access Control**: Limit access to environment files

### 2. Database Security

#### Connection Security
```typescript
// Prisma with security settings
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Connection with SSL
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```

#### Query Security
```typescript
// Safe: Parameterized query
const user = await prisma.user.findUnique({
  where: { email: userEmail },
});

// Unsafe: Raw query (avoid)
const users = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${email}
`;
```

### 3. CORS Configuration

```typescript
// Secure CORS setup
app.enableCors({
  origin: [
    'http://localhost:3000',
    'https://pixelpim.com',
    'https://www.pixelpim.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});
```

### 4. Rate Limiting

```typescript
// Install: npm install @nestjs/throttler
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60, // Time window in seconds
      limit: 10, // Maximum requests per window
    }),
  ],
})
export class AppModule {}

// Apply to specific routes
@UseGuards(ThrottlerGuard)
@Post('send-otp')
async sendOtp(@Body() sendOtpDto: SendOtpDto) {
  return this.authService.sendOtp(sendOtpDto);
}
```

### 5. Security Headers

```typescript
// Install: npm install helmet
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }));
}
```

## 🔍 Security Monitoring

### 1. Logging Security Events

```typescript
@Injectable()
export class SecurityLogger {
  private readonly logger = new Logger(SecurityLogger.name);

  logFailedLogin(email: string, ip: string) {
    this.logger.warn(`Failed login attempt for ${email} from ${ip}`);
  }

  logSuccessfulLogin(userId: number, ip: string) {
    this.logger.log(`Successful login for user ${userId} from ${ip}`);
  }

  logPasswordChange(userId: number) {
    this.logger.log(`Password changed for user ${userId}`);
  }

  logSuspiciousActivity(userId: number, activity: string) {
    this.logger.error(`Suspicious activity for user ${userId}: ${activity}`);
  }
}
```

### 2. Request Monitoring

```typescript
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const { method, url, ip } = req;
    const userAgent = req.get('User-Agent') || '';

    // Log suspicious patterns
    if (this.isSuspiciousRequest(req)) {
      this.logger.warn(`Suspicious request: ${method} ${url} from ${ip}`);
    }

    next();
  }

  private isSuspiciousRequest(req: Request): boolean {
    // Check for common attack patterns
    const suspiciousPatterns = [
      /\.\./,           // Directory traversal
      /<script>/i,      // XSS attempts
      /union.*select/i, // SQL injection
      /exec\(/i,        // Code injection
    ];

    const url = req.url.toLowerCase();
    return suspiciousPatterns.some(pattern => pattern.test(url));
  }
}
```

### 3. Failed Authentication Tracking

```typescript
@Injectable()
export class AuthSecurityService {
  private failedAttempts = new Map<string, number>();
  private lockouts = new Map<string, Date>();

  async checkFailedAttempts(email: string): Promise<boolean> {
    // Check if account is locked
    const lockoutTime = this.lockouts.get(email);
    if (lockoutTime && new Date() < lockoutTime) {
      throw new UnauthorizedException('Account temporarily locked');
    }

    return true;
  }

  async recordFailedAttempt(email: string): Promise<void> {
    const attempts = (this.failedAttempts.get(email) || 0) + 1;
    this.failedAttempts.set(email, attempts);

    // Lock account after 5 failed attempts
    if (attempts >= 5) {
      const lockoutUntil = new Date();
      lockoutUntil.setMinutes(lockoutUntil.getMinutes() + 15); // 15-minute lockout
      this.lockouts.set(email, lockoutUntil);
    }
  }

  async recordSuccessfulLogin(email: string): Promise<void> {
    // Clear failed attempts on successful login
    this.failedAttempts.delete(email);
    this.lockouts.delete(email);
  }
}
```

## 🚨 Incident Response

### 1. Security Incident Types

- **Data Breach**: Unauthorized access to user data
- **DDoS Attack**: Overwhelming server resources
- **Authentication Bypass**: Unauthorized access attempts
- **Code Injection**: Malicious code execution attempts
- **Data Exfiltration**: Suspicious data access patterns

### 2. Response Procedures

#### Immediate Actions
1. **Isolate**: Disconnect affected systems
2. **Assess**: Determine scope and impact
3. **Contain**: Prevent further damage
4. **Document**: Record all actions taken

#### Investigation Steps
1. **Log Analysis**: Review security logs
2. **User Activity**: Check affected accounts
3. **System Integrity**: Verify system files
4. **Network Traffic**: Analyze unusual patterns

#### Recovery Process
1. **Patch Vulnerabilities**: Fix identified issues
2. **Reset Credentials**: Change compromised secrets
3. **Restore Services**: Bring systems back online
4. **Monitor**: Increased surveillance post-incident

### 3. Communication Plan

```typescript
@Injectable()
export class IncidentNotificationService {
  async notifySecurityTeam(incident: SecurityIncident) {
    // Send immediate alert to security team
    await this.sendAlert({
      severity: incident.severity,
      type: incident.type,
      timestamp: new Date(),
      details: incident.details,
    });
  }

  async notifyAffectedUsers(userIds: number[]) {
    // Notify users of potential security issue
    for (const userId of userIds) {
      await this.sendSecurityNotification(userId);
    }
  }
}
```

## 🔒 Production Security Checklist

### Pre-Deployment
- [ ] Environment variables properly configured
- [ ] Secrets rotated from development
- [ ] HTTPS enabled with valid SSL certificate
- [ ] Database connections encrypted
- [ ] CORS properly configured
- [ ] Rate limiting implemented
- [ ] Security headers configured
- [ ] Input validation comprehensive
- [ ] Error handling doesn't leak information
- [ ] Logging configured for security events

### Post-Deployment
- [ ] Security monitoring active
- [ ] Backup systems operational
- [ ] Incident response plan ready
- [ ] Security team alerted
- [ ] Penetration testing scheduled
- [ ] Vulnerability scanning enabled
- [ ] Access logs monitored
- [ ] Performance monitoring active

### Regular Maintenance
- [ ] Dependency updates (monthly)
- [ ] Security patches (immediately)
- [ ] Log review (weekly)
- [ ] Credential rotation (quarterly)
- [ ] Security training (annually)
- [ ] Penetration testing (bi-annually)
- [ ] Incident response drills (quarterly)
- [ ] Security policy review (annually)

## 🔐 Common Vulnerabilities & Mitigations

### 1. OWASP Top 10

#### A01: Broken Access Control
**Mitigation**: Proper authorization guards, role-based access control

#### A02: Cryptographic Failures
**Mitigation**: Strong encryption, secure key management

#### A03: Injection
**Mitigation**: Parameterized queries, input validation

#### A04: Insecure Design
**Mitigation**: Security by design, threat modeling

#### A05: Security Misconfiguration
**Mitigation**: Secure defaults, configuration management

#### A06: Vulnerable Components
**Mitigation**: Regular updates, dependency scanning

#### A07: Identification and Authentication Failures
**Mitigation**: Strong authentication, session management

#### A08: Software and Data Integrity Failures
**Mitigation**: Code signing, integrity checks

#### A09: Security Logging and Monitoring Failures
**Mitigation**: Comprehensive logging, real-time monitoring

#### A10: Server-Side Request Forgery (SSRF)
**Mitigation**: Input validation, network segmentation

### 2. API-Specific Vulnerabilities

#### Broken Object Level Authorization
```typescript
// Vulnerable
@Get('users/:id')
async getUser(@Param('id') id: string) {
  return this.userService.findOne(+id); // No authorization check
}

// Secure
@Get('users/:id')
@UseGuards(JwtAuthGuard)
async getUser(@Param('id') id: string, @Request() req) {
  const userId = +id;
  
  // Check if user can access this resource
  if (req.user.id !== userId && !req.user.isAdmin) {
    throw new ForbiddenException();
  }
  
  return this.userService.findOne(userId);
}
```

#### Excessive Data Exposure
```typescript
// Vulnerable - returns sensitive data
@Get('profile')
async getProfile(@Request() req) {
  return this.userService.findOne(req.user.id); // Returns password hash
}

// Secure - select only needed fields
@Get('profile')
async getProfile(@Request() req) {
  return this.userService.findOne(req.user.id, {
    select: {
      id: true,
      email: true,
      fullname: true,
      createdAt: true,
    }
  });
}
```

## 📚 Security Resources

### Documentation
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [NestJS Security](https://docs.nestjs.com/security/authentication)
- [Prisma Security](https://www.prisma.io/docs/concepts/components/prisma-client/working-with-prismaclient/connection-management)

### Tools
- **Static Analysis**: ESLint security rules
- **Dependency Scanning**: npm audit, Snyk
- **Penetration Testing**: OWASP ZAP, Burp Suite
- **Monitoring**: Sentry, LogRocket

### Training
- **Secure Coding**: OWASP guidelines
- **Security Awareness**: Regular team training
- **Incident Response**: Practice scenarios
- **Compliance**: Industry standards (GDPR, CCPA)
