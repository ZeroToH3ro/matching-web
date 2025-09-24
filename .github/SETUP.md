# GitHub Actions Setup Guide

## Required Secrets

Configure these secrets in your GitHub repository settings (Settings → Secrets and variables → Actions):

### Deployment Secrets (Vercel)
- `VERCEL_TOKEN`: Your Vercel API token
- `ORG_ID`: Your Vercel organization/team ID
- `PROJECT_ID`: Your Vercel project ID

### Optional Secrets
- `CODECOV_TOKEN`: For code coverage reporting (optional)

## Environment Variables

The workflows use these environment variables automatically:
- `NODE_VERSION`: Set to '20'
- `PNPM_VERSION`: Set to '9'

## Vercel Integration Setup

1. **Get Vercel Token:**
   ```bash
   npx vercel login
   npx vercel link
   npx vercel env pull .env.local
   ```

2. **Find Project Details:**
   ```bash
   # After linking, check .vercel/project.json for:
   # - projectId (PROJECT_ID secret)
   # - orgId (ORG_ID secret)
   ```

3. **Generate Vercel Token:**
   - Go to https://vercel.com/account/tokens
   - Create a new token
   - Add as `VERCEL_TOKEN` secret in GitHub

## Workflow Features

### Main CI/CD Pipeline (`ci.yml`)
- **Testing**: Runs Jest tests with PostgreSQL database
- **Linting**: ESLint and TypeScript checks
- **Building**: Next.js build with Prisma generation
- **Security**: npm audit and secret scanning
- **Web3**: Checks for Sui Move contracts
- **Deployment**:
  - Preview deployments for PRs
  - Production deployment for main branch

### Security Workflows
- **Dependency Review**: Checks new dependencies in PRs
- **CodeQL**: Static analysis for security vulnerabilities

## Database Testing

The CI pipeline uses PostgreSQL for testing:
- Database: `test_matchme`
- User: `postgres`
- Password: `postgres`
- Host: `localhost:5432`

## Branch Protection

Recommended branch protection rules for `main`:
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Required status checks:
  - `Test & Lint`
  - `Build Application`
  - `Dependency Review`

## Local Development

To run the same checks locally:

```bash
# Type checking
pnpm tsc --noEmit

# Linting
pnpm lint

# Testing
pnpm test

# Building
pnpm build

# Security audit
pnpm audit --audit-level moderate
```

## Troubleshooting

### Common Issues

1. **Prisma Generation Fails**
   - Ensure `DATABASE_URL` is set correctly in test environment
   - Check Prisma schema syntax

2. **Build Fails**
   - Verify all required environment variables are set
   - Check TypeScript errors

3. **Tests Fail**
   - Ensure PostgreSQL service is running
   - Check database connection string
   - Verify test data setup

4. **Deployment Fails**
   - Check Vercel token permissions
   - Verify project and org IDs
   - Ensure environment variables are set in Vercel

### Manual Workflow Trigger

You can manually trigger workflows from the GitHub Actions tab or via CLI:

```bash
gh workflow run ci.yml
```