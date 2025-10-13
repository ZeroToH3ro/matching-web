# Production Deployment Guide

This document provides a comprehensive guide for deploying the Seal Profile Avatar feature to production.

## Overview

The production deployment involves setting up:

1. **Walrus Protocol Integration**: Decentralized storage for avatar files
2. **Seal Protocol Integration**: Encryption and access control
3. **Production Configuration**: Environment-specific settings
4. **Monitoring and Health Checks**: System reliability and alerting
5. **Security Configuration**: Production-grade security measures

## Prerequisites

### System Requirements

- **Node.js**: Version 18 or later
- **pnpm**: Package manager
- **PostgreSQL**: Database server
- **Redis**: Caching layer (recommended)
- **Docker**: Container runtime (optional)

### External Services

- **Walrus Network**: Mainnet access
- **SUI Blockchain**: Mainnet access with funded wallet
- **Seal Protocol**: Production package deployment
- **Monitoring Service**: For alerts and metrics (optional)

## Configuration

### Environment Variables

Copy the production environment template:

```bash
cp deployment/production.env.example .env.production
```

### Required Configuration

#### Walrus Protocol
```env
WALRUS_NETWORK="mainnet"
WALRUS_PUBLISHER_URLS="https://publisher-1.walrus.space,https://publisher-2.walrus.space"
WALRUS_AGGREGATOR_URLS="https://aggregator-1.walrus.space,https://aggregator-2.walrus.space"
```

#### SUI Blockchain & Seal Protocol
```env
SUI_NETWORK="mainnet"
SUI_PRIVATE_KEY="your-production-private-key"
SEAL_PACKAGE_ID="your-production-package-id"
SEAL_SERVER_OBJECT_IDS="object-id-1,object-id-2"
```

#### Database & Caching
```env
DATABASE_URL="postgresql://user:pass@host:5432/db"
REDIS_URL="redis://host:6379"
```

#### Security
```env
AUTH_SECRET="your-secure-32-character-secret"
PRODUCTION_ENCRYPTION_REQUIRED="true"
PRODUCTION_RATE_LIMITING_ENABLED="true"
```

### Configuration Validation

Validate your configuration before deployment:

```bash
node scripts/validate-config.js
```

This script checks:
- Required environment variables
- URL format validation
- Network configuration consistency
- Security settings
- External service connectivity

## Deployment Process

### Automated Deployment

Use the provided deployment script:

```bash
chmod +x scripts/deploy-production.sh
./scripts/deploy-production.sh
```

The script performs:
1. Prerequisites checking
2. Environment setup
3. Configuration validation
4. Dependency installation
5. Application building
6. Database migration
7. Monitoring setup
8. Health validation

### Manual Deployment

If you prefer manual deployment:

#### 1. Install Dependencies
```bash
pnpm install --frozen-lockfile --prod
pnpm add sharp  # Production image processing
```

#### 2. Build Application
```bash
pnpm prisma generate
pnpm prisma migrate deploy
pnpm build
```

#### 3. Start Application
```bash
pnpm start
```

## Walrus Integration

### Network Configuration

#### Mainnet Endpoints
```env
WALRUS_NETWORK="mainnet"
WALRUS_PUBLISHER_URLS="https://publisher-1.walrus.space,https://publisher-2.walrus.space,https://publisher-3.walrus.space"
WALRUS_AGGREGATOR_URLS="https://aggregator-1.walrus.space,https://aggregator-2.walrus.space,https://aggregator-3.walrus.space"
```

#### Performance Tuning
```env
WALRUS_MAX_RETRIES="5"
WALRUS_TIMEOUT="60000"
WALRUS_RATE_LIMIT_RPS="20"
WALRUS_RATE_LIMIT_BURST="100"
```

### Connectivity Testing

Test Walrus connectivity:

```bash
curl -I https://publisher-1.walrus.space/health
curl -I https://aggregator-1.walrus.space/health
```

### Monitoring Walrus Performance

The system automatically monitors:
- Publisher endpoint availability
- Aggregator endpoint response times
- Upload success rates
- Download performance

## Seal Protocol Integration

### Package Deployment

Deploy your Seal Protocol package to mainnet:

```bash
sui client publish --gas-budget 100000000
```

Record the package ID and update your configuration.

### Server Object Setup

Create server objects for your application:

```bash
sui client call --package $PACKAGE_ID --module avatar_policy --function create_server
```

### Access Policy Configuration

The system automatically creates and manages access policies for:
- Match-based avatar access
- User privacy settings
- Automatic permission updates

### Gas Management

Configure gas settings for production:

```env
SEAL_MAX_GAS_AMOUNT="2000000000"
SEAL_GAS_BUDGET="200000000"
SUI_GAS_OBJECT_ID="your-gas-object-id"
```

## Monitoring and Health Checks

### Health Check Endpoint

The system provides a comprehensive health check at `/api/health`:

```bash
curl https://your-domain.com/api/health
```

Response includes:
- Overall system status
- Database connectivity
- Walrus endpoint health
- Seal Protocol status
- Cache performance
- Analytics service status

### Monitoring Configuration

Enable production monitoring:

```env
PRODUCTION_MONITORING_ENABLED="true"
PRODUCTION_ALERT_WEBHOOK="https://your-monitoring-service.com/webhook"
PRODUCTION_METRICS_ENDPOINT="https://your-metrics-service.com/metrics"
```

### Automated Alerts

The system sends alerts for:
- Service unavailability
- High error rates
- Performance degradation
- Configuration issues

### Log Management

Configure log rotation:

```bash
sudo cp monitoring/logrotate.conf /etc/logrotate.d/avatar-service
```

## Security Configuration

### SSL/TLS Setup

Configure SSL certificates:

```env
SSL_ENABLED="true"
SSL_CERT_PATH="/etc/ssl/certs/avatar-service.crt"
SSL_KEY_PATH="/etc/ssl/private/avatar-service.key"
```

### Rate Limiting

Configure production rate limits:

```env
PRODUCTION_RATE_LIMITING_ENABLED="true"
PRODUCTION_MAX_UPLOAD_SIZE="10485760"  # 10MB
```

### CORS Configuration

Set allowed origins:

```env
PRODUCTION_ALLOWED_ORIGINS="https://your-domain.com,https://www.your-domain.com"
```

### Encryption Requirements

Enforce encryption in production:

```env
PRODUCTION_ENCRYPTION_REQUIRED="true"
```

## Performance Optimization

### Database Configuration

Optimize database connections:

```env
DB_POOL_SIZE="20"
DB_POOL_TIMEOUT="30000"
```

### Caching Strategy

Configure cache TTL values:

```env
CACHE_TTL_AVATAR_PUBLIC="86400"    # 24 hours
CACHE_TTL_AVATAR_PRIVATE="3600"   # 1 hour
CACHE_TTL_METADATA="7200"         # 2 hours
```

### CDN Integration

Enable CDN for public avatars:

```env
CDN_ENABLED="true"
CDN_BASE_URL="https://your-cdn-domain.com"
CDN_CACHE_TTL="2592000"  # 30 days
```

## Backup and Disaster Recovery

### Automated Backups

The deployment script creates a backup system:

```bash
# Manual backup
./backups/backup.sh

# Automated backup (add to crontab)
0 2 * * * /path/to/avatar-service/backups/backup.sh
```

### Disaster Recovery

Configure disaster recovery:

```env
DR_ENABLED="true"
DR_REGION="us-west-2"
DR_SYNC_INTERVAL="3600"
```

## Scaling Configuration

### Auto-scaling

Configure auto-scaling parameters:

```env
AUTO_SCALING_ENABLED="true"
MIN_INSTANCES="2"
MAX_INSTANCES="10"
SCALE_UP_THRESHOLD="70"
SCALE_DOWN_THRESHOLD="30"
```

### Load Balancing

Enable load balancing:

```env
LOAD_BALANCER_ENABLED="true"
HEALTH_CHECK_PATH="/api/health"
```

## Systemd Service

The deployment script creates a systemd service:

```bash
# Start service
sudo systemctl start avatar-service

# Enable auto-start
sudo systemctl enable avatar-service

# Check status
sudo systemctl status avatar-service

# View logs
sudo journalctl -u avatar-service -f
```

## Troubleshooting

### Common Issues

#### 1. Walrus Connectivity Issues
```bash
# Test connectivity
node -e "
const { getProductionConfigService } = require('./dist/services/productionConfigService.js');
const config = getProductionConfigService();
config.validateWalrusConnectivity().then(console.log);
"
```

#### 2. Seal Protocol Issues
```bash
# Check SUI network status
sui client active-env

# Verify gas object
sui client gas --json
```

#### 3. Database Connection Issues
```bash
# Test database connection
pnpm prisma db pull --preview-feature
```

#### 4. Configuration Issues
```bash
# Validate configuration
node scripts/validate-config.js
```

### Debug Commands

```bash
# Check service status
curl https://your-domain.com/api/health

# View application logs
sudo journalctl -u avatar-service -n 100

# Check system resources
htop
df -h
free -h

# Monitor network connections
netstat -tulpn | grep :3000
```

### Performance Monitoring

```bash
# Monitor API response times
curl -w "@curl-format.txt" -o /dev/null -s "https://your-domain.com/api/avatar/user123"

# Check database performance
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity;"

# Monitor Redis performance
redis-cli info stats
```

## Maintenance

### Regular Maintenance Tasks

1. **Update Dependencies**
   ```bash
   pnpm update
   pnpm audit
   ```

2. **Database Maintenance**
   ```bash
   # Analyze database performance
   pnpm prisma db pull --preview-feature
   
   # Clean up old analytics data
   curl -X POST https://your-domain.com/api/avatar/analytics/cleanup
   ```

3. **Log Rotation**
   ```bash
   sudo logrotate /etc/logrotate.d/avatar-service
   ```

4. **Security Updates**
   ```bash
   # Update system packages
   sudo apt update && sudo apt upgrade
   
   # Update SSL certificates
   sudo certbot renew
   ```

### Maintenance Mode

Enable maintenance mode:

```env
MAINTENANCE_MODE="true"
MAINTENANCE_MESSAGE="System is under maintenance. Please try again later."
```

## Compliance and Legal

### GDPR Compliance

Configure GDPR settings:

```env
GDPR_ENABLED="true"
DATA_RETENTION_DAYS="2555"  # 7 years
```

### Content Moderation

Enable content moderation:

```env
CONTENT_MODERATION_ENABLED="true"
AUTO_MODERATION_THRESHOLD="0.8"
```

## Support and Documentation

### Additional Resources

- [Walrus Protocol Documentation](https://docs.walrus.space)
- [Seal Protocol Documentation](https://docs.seal.space)
- [SUI Blockchain Documentation](https://docs.sui.io)

### Getting Help

1. Check the health endpoint: `/api/health`
2. Review application logs
3. Validate configuration with the validation script
4. Check external service status

### Reporting Issues

When reporting issues, include:
- Health check output
- Application logs
- Configuration (sanitized)
- Steps to reproduce
- Expected vs actual behavior