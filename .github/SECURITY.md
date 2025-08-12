# Security Policy

## GitHub Secrets Required

To use this CI/CD pipeline, you need to configure the following secrets in your GitHub repository:

### Required Secrets

1. **RENDER_DEPLOY_HOOK_URL**
   - Go to your Render dashboard
   - Navigate to your service settings
   - Copy the deploy hook URL
   - Add as a repository secret

### Setting up GitHub Secrets

1. Go to your GitHub repository
2. Click on "Settings" tab
3. Navigate to "Secrets and variables" → "Actions"
4. Click "New repository secret"
5. Add the secret name and value

## Environment Protection

The production environment is protected and requires:
- All status checks to pass
- Manual approval (optional)
- Deployment only from the main branch

## Security Best Practices

- Never commit sensitive data like API keys or tokens
- Use GitHub secrets for all sensitive configuration
- Enable branch protection rules
- Review dependencies regularly
- Monitor security advisories
