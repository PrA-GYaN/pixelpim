# CI/CD Pipeline

This repository uses GitHub Actions for continuous integration and deployment.

## Pipeline Overview

The CI/CD pipeline consists of three main jobs:

### 1. Lint and Test
- Runs ESLint for code quality
- Executes test suite with coverage reporting
- Uploads coverage reports to Codecov

### 2. Build
- Compiles the TypeScript application
- Generates Prisma client
- Caches build artifacts for faster subsequent runs

### 3. Security Scan
- Performs npm security audit
- Runs dependency review for pull requests

### 4. Deploy (Production only)
- Deploys to Render when all checks pass
- Only runs on main branch pushes
- Includes health checks and error handling

## Setup Instructions

1. **Configure GitHub Secrets**: See `.github/SECURITY.md` for required secrets
2. **Update Health Check**: Modify the health check URL in the deploy job
3. **Set Environment URL**: Update the production environment URL

## Performance Optimizations

- **Parallel Jobs**: Lint/test and build run in parallel
- **Dependency Caching**: npm dependencies are cached between runs
- **Build Artifact Caching**: Compiled code is cached
- **Optimized npm install**: Uses `--prefer-offline --no-audit` flags

## Security Features

- **Protected Environment**: Production deployment requires all checks to pass
- **Secrets Management**: Sensitive data stored in GitHub secrets
- **Dependency Review**: Automatic security scanning of dependencies
- **Timeout Limits**: Prevents runaway jobs

## Monitoring

- Test coverage reports uploaded to Codecov
- Deployment status tracking
- Health checks after deployment
