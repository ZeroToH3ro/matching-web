#!/usr/bin/env node

/**
 * Configuration Validation Script for Avatar Service
 * This script validates the production configuration before deployment
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(level, message) {
  const timestamp = new Date().toISOString();
  const color = colors[level] || colors.reset;
  console.log(`${color}[${level.toUpperCase()}] ${timestamp} - ${message}${colors.reset}`);
}

function logInfo(message) { log('blue', message); }
function logSuccess(message) { log('green', message); }
function logWarning(message) { log('yellow', message); }
function logError(message) { log('red', message); }

class ConfigValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.config = {};
  }

  loadEnvironment() {
    logInfo('Loading environment configuration...');
    
    // Try to load .env.production first, then .env
    const envFiles = ['.env.production', '.env'];
    let loaded = false;
    
    for (const envFile of envFiles) {
      const envPath = path.join(process.cwd(), envFile);
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split('\n');
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0) {
              const value = valueParts.join('=').replace(/^["']|["']$/g, '');
              this.config[key] = value;
              process.env[key] = value;
            }
          }
        }
        
        logSuccess(`Loaded configuration from ${envFile}`);
        loaded = true;
        break;
      }
    }
    
    if (!loaded) {
      logWarning('No environment file found. Using system environment variables.');
    }
    
    // Also load from process.env
    Object.assign(this.config, process.env);
  }

  validateRequired() {
    logInfo('Validating required configuration...');
    
    const requiredVars = [
      'DATABASE_URL',
      'AUTH_SECRET',
      'SUI_PRIVATE_KEY',
      'SEAL_PACKAGE_ID',
      'WALRUS_PUBLISHER_URLS',
      'WALRUS_AGGREGATOR_URLS'
    ];
    
    for (const varName of requiredVars) {
      if (!this.config[varName]) {
        this.errors.push(`Required environment variable ${varName} is not set`);
      }
    }
    
    // Validate AUTH_SECRET length
    if (this.config.AUTH_SECRET && this.config.AUTH_SECRET.length < 32) {
      this.errors.push('AUTH_SECRET must be at least 32 characters long');
    }
    
    logSuccess('Required configuration validation completed');
  }

  validateNetworkConfiguration() {
    logInfo('Validating network configuration...');
    
    const environment = this.config.NODE_ENV || 'development';
    const walrusNetwork = this.config.WALRUS_NETWORK || 'testnet';
    const suiNetwork = this.config.SUI_NETWORK || 'testnet';
    
    // Check for production misconfigurations
    if (environment === 'production') {
      if (walrusNetwork === 'testnet') {
        this.warnings.push('Using Walrus testnet in production environment');
      }
      
      if (suiNetwork === 'testnet') {
        this.warnings.push('Using SUI testnet in production environment');
      }
      
      if (!this.config.PRODUCTION_ENCRYPTION_REQUIRED || this.config.PRODUCTION_ENCRYPTION_REQUIRED !== 'true') {
        this.warnings.push('Encryption not required in production environment');
      }
    }
    
    logSuccess('Network configuration validation completed');
  }

  validateUrls() {
    logInfo('Validating URL configuration...');
    
    const urlFields = [
      'WALRUS_PUBLISHER_URLS',
      'WALRUS_AGGREGATOR_URLS',
      'NEXT_PUBLIC_BASE_URL',
      'PRODUCTION_ALERT_WEBHOOK',
      'PRODUCTION_METRICS_ENDPOINT'
    ];
    
    for (const field of urlFields) {
      const value = this.config[field];
      if (value) {
        if (field.includes('URLS')) {
          // Multiple URLs separated by commas
          const urls = value.split(',').map(url => url.trim());
          for (const url of urls) {
            if (!this.isValidUrl(url)) {
              this.errors.push(`Invalid URL in ${field}: ${url}`);
            }
          }
        } else {
          // Single URL
          if (!this.isValidUrl(value)) {
            this.errors.push(`Invalid URL for ${field}: ${value}`);
          }
        }
      }
    }
    
    logSuccess('URL validation completed');
  }

  validateDatabaseUrl() {
    logInfo('Validating database configuration...');
    
    const dbUrl = this.config.DATABASE_URL;
    if (dbUrl) {
      try {
        const url = new URL(dbUrl);
        
        if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
          this.errors.push('DATABASE_URL must use postgresql:// or postgres:// protocol');
        }
        
        if (!url.hostname) {
          this.errors.push('DATABASE_URL must include hostname');
        }
        
        if (!url.pathname || url.pathname === '/') {
          this.errors.push('DATABASE_URL must include database name');
        }
        
        // Check for production database security
        if (this.config.NODE_ENV === 'production') {
          if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
            this.warnings.push('Using localhost database in production environment');
          }
          
          if (!url.username || !url.password) {
            this.warnings.push('Database credentials not found in production environment');
          }
        }
        
      } catch (error) {
        this.errors.push(`Invalid DATABASE_URL format: ${error.message}`);
      }
    }
    
    logSuccess('Database configuration validation completed');
  }

  validateSecurityConfiguration() {
    logInfo('Validating security configuration...');
    
    const environment = this.config.NODE_ENV || 'development';
    
    if (environment === 'production') {
      // Check SSL configuration
      if (!this.config.SSL_ENABLED || this.config.SSL_ENABLED !== 'true') {
        this.warnings.push('SSL not enabled in production environment');
      }
      
      // Check allowed origins
      if (!this.config.PRODUCTION_ALLOWED_ORIGINS) {
        this.warnings.push('PRODUCTION_ALLOWED_ORIGINS not configured');
      }
      
      // Check rate limiting
      if (this.config.PRODUCTION_RATE_LIMITING_ENABLED === 'false') {
        this.warnings.push('Rate limiting disabled in production environment');
      }
      
      // Check monitoring
      if (!this.config.PRODUCTION_MONITORING_ENABLED || this.config.PRODUCTION_MONITORING_ENABLED !== 'true') {
        this.warnings.push('Monitoring not enabled in production environment');
      }
    }
    
    logSuccess('Security configuration validation completed');
  }

  async validateConnectivity() {
    logInfo('Validating external service connectivity...');
    
    const walrusPublishers = this.config.WALRUS_PUBLISHER_URLS?.split(',').map(url => url.trim()) || [];
    const walrusAggregators = this.config.WALRUS_AGGREGATOR_URLS?.split(',').map(url => url.trim()) || [];
    
    // Test Walrus publisher connectivity
    for (const url of walrusPublishers) {
      try {
        await this.testHttpConnectivity(url);
        logSuccess(`Walrus publisher connectivity OK: ${url}`);
      } catch (error) {
        this.warnings.push(`Walrus publisher connectivity failed: ${url} - ${error.message}`);
      }
    }
    
    // Test Walrus aggregator connectivity
    for (const url of walrusAggregators) {
      try {
        await this.testHttpConnectivity(url);
        logSuccess(`Walrus aggregator connectivity OK: ${url}`);
      } catch (error) {
        this.warnings.push(`Walrus aggregator connectivity failed: ${url} - ${error.message}`);
      }
    }
    
    logSuccess('Connectivity validation completed');
  }

  isValidUrl(urlString) {
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  testHttpConnectivity(url) {
    return new Promise((resolve, reject) => {
      const timeout = 5000;
      const parsedUrl = new URL(url);
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: '/health',
        method: 'HEAD',
        timeout: timeout
      };
      
      const req = https.request(options, (res) => {
        resolve(res.statusCode);
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Connection timeout'));
      });
      
      req.end();
    });
  }

  generateReport() {
    logInfo('Generating validation report...');
    
    console.log('\n' + '='.repeat(60));
    console.log('CONFIGURATION VALIDATION REPORT');
    console.log('='.repeat(60));
    
    console.log(`\nEnvironment: ${this.config.NODE_ENV || 'development'}`);
    console.log(`Walrus Network: ${this.config.WALRUS_NETWORK || 'testnet'}`);
    console.log(`SUI Network: ${this.config.SUI_NETWORK || 'testnet'}`);
    
    if (this.errors.length > 0) {
      console.log(`\n${colors.red}ERRORS (${this.errors.length}):${colors.reset}`);
      this.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    if (this.warnings.length > 0) {
      console.log(`\n${colors.yellow}WARNINGS (${this.warnings.length}):${colors.reset}`);
      this.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
    }
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log(`\n${colors.green}✓ All validations passed successfully!${colors.reset}`);
    }
    
    console.log('\n' + '='.repeat(60));
    
    return this.errors.length === 0;
  }

  async validate() {
    try {
      this.loadEnvironment();
      this.validateRequired();
      this.validateNetworkConfiguration();
      this.validateUrls();
      this.validateDatabaseUrl();
      this.validateSecurityConfiguration();
      await this.validateConnectivity();
      
      return this.generateReport();
    } catch (error) {
      logError(`Validation failed: ${error.message}`);
      return false;
    }
  }
}

// Main execution
async function main() {
  logInfo('Starting configuration validation...');
  
  const validator = new ConfigValidator();
  const isValid = await validator.validate();
  
  if (isValid) {
    logSuccess('Configuration validation completed successfully');
    process.exit(0);
  } else {
    logError('Configuration validation failed');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    logError(`Validation script failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { ConfigValidator };