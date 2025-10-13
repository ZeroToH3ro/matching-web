#!/bin/bash

# Production Deployment Script for Avatar Service
# This script sets up the production environment for the Seal Profile Avatar feature

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_DIR="$PROJECT_ROOT/deployment"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 18 or later."
        exit 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js version 18 or later is required. Current version: $(node -v)"
        exit 1
    fi
    
    # Check if pnpm is installed
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is not installed. Please install pnpm."
        exit 1
    fi
    
    # Check if Docker is installed (optional but recommended)
    if ! command -v docker &> /dev/null; then
        log_warning "Docker is not installed. Some features may not work properly."
    fi
    
    # Check if Redis is available
    if ! command -v redis-cli &> /dev/null; then
        log_warning "Redis CLI is not installed. Make sure Redis is available for caching."
    fi
    
    log_success "Prerequisites check completed"
}

setup_environment() {
    log_info "Setting up production environment..."
    
    # Create production environment file if it doesn't exist
    if [ ! -f "$PROJECT_ROOT/.env.production" ]; then
        if [ -f "$DEPLOYMENT_DIR/production.env.example" ]; then
            cp "$DEPLOYMENT_DIR/production.env.example" "$PROJECT_ROOT/.env.production"
            log_warning "Created .env.production from template. Please update with actual values."
        else
            log_error "Production environment template not found."
            exit 1
        fi
    fi
    
    # Load environment variables
    if [ -f "$PROJECT_ROOT/.env.production" ]; then
        export $(grep -v '^#' "$PROJECT_ROOT/.env.production" | xargs)
    fi
    
    log_success "Environment setup completed"
}

validate_configuration() {
    log_info "Validating production configuration..."
    
    # Check required environment variables
    REQUIRED_VARS=(
        "DATABASE_URL"
        "AUTH_SECRET"
        "SUI_PRIVATE_KEY"
        "SEAL_PACKAGE_ID"
        "WALRUS_PUBLISHER_URLS"
        "WALRUS_AGGREGATOR_URLS"
    )
    
    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    # Validate Walrus network configuration
    if [ "$WALRUS_NETWORK" = "testnet" ]; then
        log_warning "Using Walrus testnet in production environment"
    fi
    
    # Validate SUI network configuration
    if [ "$SUI_NETWORK" = "testnet" ]; then
        log_warning "Using SUI testnet in production environment"
    fi
    
    log_success "Configuration validation completed"
}

install_dependencies() {
    log_info "Installing production dependencies..."
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies
    pnpm install --frozen-lockfile --prod
    
    # Install Sharp for image processing (production build)
    pnpm add sharp
    
    log_success "Dependencies installation completed"
}

build_application() {
    log_info "Building application for production..."
    
    cd "$PROJECT_ROOT"
    
    # Generate Prisma client
    pnpm prisma generate
    
    # Run database migrations
    pnpm prisma migrate deploy
    
    # Build Next.js application
    pnpm build
    
    log_success "Application build completed"
}

setup_database() {
    log_info "Setting up production database..."
    
    cd "$PROJECT_ROOT"
    
    # Run database migrations
    pnpm prisma migrate deploy
    
    # Seed database if needed (optional)
    if [ "$SEED_DATABASE" = "true" ]; then
        log_info "Seeding database..."
        pnpm prisma db seed
    fi
    
    log_success "Database setup completed"
}

setup_monitoring() {
    log_info "Setting up monitoring and health checks..."
    
    # Create monitoring directory
    mkdir -p "$PROJECT_ROOT/monitoring"
    
    # Create health check script
    cat > "$PROJECT_ROOT/monitoring/health-check.sh" << 'EOF'
#!/bin/bash

# Health check script for avatar service
HEALTH_URL="${NEXT_PUBLIC_BASE_URL}/api/avatar/health"
TIMEOUT=30

response=$(curl -s -w "%{http_code}" -o /tmp/health_response --max-time $TIMEOUT "$HEALTH_URL")

if [ "$response" = "200" ]; then
    echo "Health check passed"
    exit 0
else
    echo "Health check failed with status: $response"
    cat /tmp/health_response
    exit 1
fi
EOF
    
    chmod +x "$PROJECT_ROOT/monitoring/health-check.sh"
    
    # Create log rotation configuration
    cat > "$PROJECT_ROOT/monitoring/logrotate.conf" << 'EOF'
/var/log/avatar-service/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload avatar-service
    endscript
}
EOF
    
    log_success "Monitoring setup completed"
}

setup_ssl_certificates() {
    log_info "Setting up SSL certificates..."
    
    if [ "$SSL_ENABLED" = "true" ]; then
        # This would typically integrate with Let's Encrypt or your certificate provider
        log_info "SSL is enabled. Make sure certificates are properly configured."
        
        # Check if certificates exist
        if [ ! -f "/etc/ssl/certs/avatar-service.crt" ]; then
            log_warning "SSL certificate not found. Please configure SSL certificates."
        fi
    else
        log_warning "SSL is not enabled. This is not recommended for production."
    fi
    
    log_success "SSL setup completed"
}

setup_backup() {
    log_info "Setting up backup configuration..."
    
    # Create backup directory
    mkdir -p "$PROJECT_ROOT/backups"
    
    # Create backup script
    cat > "$PROJECT_ROOT/backups/backup.sh" << 'EOF'
#!/bin/bash

# Backup script for avatar service
BACKUP_DIR="/var/backups/avatar-service"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup database
pg_dump "$DATABASE_URL" > "$BACKUP_DIR/database_$DATE.sql"

# Backup configuration
cp .env.production "$BACKUP_DIR/config_$DATE.env"

# Compress backup
tar -czf "$BACKUP_DIR/backup_$DATE.tar.gz" "$BACKUP_DIR/database_$DATE.sql" "$BACKUP_DIR/config_$DATE.env"

# Clean up old backups (keep last 30 days)
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +30 -delete

echo "Backup completed: backup_$DATE.tar.gz"
EOF
    
    chmod +x "$PROJECT_ROOT/backups/backup.sh"
    
    log_success "Backup setup completed"
}

validate_deployment() {
    log_info "Validating deployment..."
    
    # Test database connection
    cd "$PROJECT_ROOT"
    if ! pnpm prisma db pull --preview-feature > /dev/null 2>&1; then
        log_error "Database connection failed"
        exit 1
    fi
    
    # Test Walrus connectivity
    log_info "Testing Walrus connectivity..."
    node -e "
        const { getProductionConfigService } = require('./dist/services/productionConfigService.js');
        const config = getProductionConfigService();
        config.validateWalrusConnectivity().then(result => {
            const healthyPublishers = result.publishers.filter(p => p.status === 'ok').length;
            const healthyAggregators = result.aggregators.filter(a => a.status === 'ok').length;
            console.log(\`Walrus connectivity: \${healthyPublishers}/\${result.publishers.length} publishers, \${healthyAggregators}/\${result.aggregators.length} aggregators\`);
            if (healthyPublishers === 0 || healthyAggregators === 0) {
                process.exit(1);
            }
        }).catch(err => {
            console.error('Walrus connectivity test failed:', err);
            process.exit(1);
        });
    "
    
    # Test application startup
    log_info "Testing application startup..."
    timeout 30s pnpm start &
    APP_PID=$!
    sleep 10
    
    if kill -0 $APP_PID 2>/dev/null; then
        log_success "Application started successfully"
        kill $APP_PID
    else
        log_error "Application failed to start"
        exit 1
    fi
    
    log_success "Deployment validation completed"
}

create_systemd_service() {
    log_info "Creating systemd service..."
    
    # Create systemd service file
    cat > "/tmp/avatar-service.service" << EOF
[Unit]
Description=Avatar Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$PROJECT_ROOT
Environment=NODE_ENV=production
ExecStart=/usr/bin/pnpm start
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=avatar-service

[Install]
WantedBy=multi-user.target
EOF
    
    # Move service file to systemd directory (requires sudo)
    if [ "$EUID" -eq 0 ]; then
        mv "/tmp/avatar-service.service" "/etc/systemd/system/"
        systemctl daemon-reload
        systemctl enable avatar-service
        log_success "Systemd service created and enabled"
    else
        log_warning "Run as root to install systemd service:"
        log_warning "sudo mv /tmp/avatar-service.service /etc/systemd/system/"
        log_warning "sudo systemctl daemon-reload"
        log_warning "sudo systemctl enable avatar-service"
    fi
}

main() {
    log_info "Starting production deployment for Avatar Service..."
    
    check_prerequisites
    setup_environment
    validate_configuration
    install_dependencies
    build_application
    setup_database
    setup_monitoring
    setup_ssl_certificates
    setup_backup
    validate_deployment
    create_systemd_service
    
    log_success "Production deployment completed successfully!"
    log_info "Next steps:"
    log_info "1. Review and update .env.production with actual production values"
    log_info "2. Configure SSL certificates if not already done"
    log_info "3. Set up monitoring and alerting"
    log_info "4. Configure backup schedule"
    log_info "5. Start the service: sudo systemctl start avatar-service"
    log_info "6. Monitor logs: sudo journalctl -u avatar-service -f"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-validation)
            SKIP_VALIDATION=true
            shift
            ;;
        --seed-database)
            SEED_DATABASE=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --skip-validation  Skip configuration validation"
            echo "  --seed-database    Seed database with initial data"
            echo "  --help            Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main