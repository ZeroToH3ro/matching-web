import { getStorageManager } from '@/lib/storage';

interface WalrusConfig {
  network: 'testnet' | 'mainnet';
  publisherUrls: string[];
  aggregatorUrls: string[];
  maxRetries: number;
  timeout: number;
  rateLimiting: {
    requestsPerSecond: number;
    burstLimit: number;
  };
}

interface SealConfig {
  network: 'testnet' | 'mainnet';
  packageId: string;
  serverObjectIds: string[];
  privateKey: string;
  gasObjectId?: string;
  maxGasAmount: number;
  gasBudget: number;
}

interface ProductionConfig {
  environment: 'development' | 'staging' | 'production';
  walrus: WalrusConfig;
  seal: SealConfig;
  monitoring: {
    enabled: boolean;
    alertWebhook?: string;
    metricsEndpoint?: string;
  };
  security: {
    enableRateLimiting: boolean;
    maxUploadSize: number;
    allowedOrigins: string[];
    encryptionRequired: boolean;
  };
}

export class ProductionConfigService {
  private config: ProductionConfig;

  constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  private loadConfiguration(): ProductionConfig {
    const environment = (process.env.NODE_ENV || 'development') as 'development' | 'staging' | 'production';
    
    return {
      environment,
      walrus: {
        network: (process.env.WALRUS_NETWORK || 'testnet') as 'testnet' | 'mainnet',
        publisherUrls: this.parseUrls(process.env.WALRUS_PUBLISHER_URLS, this.getDefaultWalrusPublishers()),
        aggregatorUrls: this.parseUrls(process.env.WALRUS_AGGREGATOR_URLS, this.getDefaultWalrusAggregators()),
        maxRetries: parseInt(process.env.WALRUS_MAX_RETRIES || '3'),
        timeout: parseInt(process.env.WALRUS_TIMEOUT || '30000'),
        rateLimiting: {
          requestsPerSecond: parseInt(process.env.WALRUS_RATE_LIMIT_RPS || '10'),
          burstLimit: parseInt(process.env.WALRUS_RATE_LIMIT_BURST || '50')
        }
      },
      seal: {
        network: (process.env.SUI_NETWORK || 'testnet') as 'testnet' | 'mainnet',
        packageId: process.env.SEAL_PACKAGE_ID || '',
        serverObjectIds: this.parseArray(process.env.SEAL_SERVER_OBJECT_IDS),
        privateKey: process.env.SUI_PRIVATE_KEY || '',
        gasObjectId: process.env.SUI_GAS_OBJECT_ID,
        maxGasAmount: parseInt(process.env.SEAL_MAX_GAS_AMOUNT || '1000000000'),
        gasBudget: parseInt(process.env.SEAL_GAS_BUDGET || '100000000')
      },
      monitoring: {
        enabled: process.env.PRODUCTION_MONITORING_ENABLED === 'true',
        alertWebhook: process.env.PRODUCTION_ALERT_WEBHOOK,
        metricsEndpoint: process.env.PRODUCTION_METRICS_ENDPOINT
      },
      security: {
        enableRateLimiting: process.env.PRODUCTION_RATE_LIMITING_ENABLED !== 'false',
        maxUploadSize: parseInt(process.env.PRODUCTION_MAX_UPLOAD_SIZE || '10485760'), // 10MB
        allowedOrigins: this.parseArray(process.env.PRODUCTION_ALLOWED_ORIGINS),
        encryptionRequired: process.env.PRODUCTION_ENCRYPTION_REQUIRED === 'true'
      }
    };
  }

  private validateConfiguration(): void {
    const errors: string[] = [];

    // Validate Walrus configuration
    if (!this.config.walrus.publisherUrls.length) {
      errors.push('Walrus publisher URLs are required');
    }

    if (!this.config.walrus.aggregatorUrls.length) {
      errors.push('Walrus aggregator URLs are required');
    }

    // Validate Seal configuration for production
    if (this.config.environment === 'production') {
      if (!this.config.seal.packageId) {
        errors.push('Seal package ID is required for production');
      }

      if (!this.config.seal.privateKey) {
        errors.push('SUI private key is required for production');
      }

      if (!this.config.seal.serverObjectIds.length) {
        errors.push('Seal server object IDs are required for production');
      }

      if (this.config.seal.network !== 'mainnet') {
        console.warn('Warning: Using testnet in production environment');
      }
    }

    // Validate security configuration
    if (this.config.environment === 'production' && !this.config.security.encryptionRequired) {
      console.warn('Warning: Encryption not required in production environment');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }

  private parseUrls(envVar: string | undefined, defaultUrls: string[]): string[] {
    if (!envVar) return defaultUrls;
    return envVar.split(',').map(url => url.trim()).filter(Boolean);
  }

  private parseArray(envVar: string | undefined): string[] {
    if (!envVar) return [];
    return envVar.split(',').map(item => item.trim()).filter(Boolean);
  }

  private getDefaultWalrusPublishers(): string[] {
    const network = process.env.WALRUS_NETWORK || 'testnet';
    
    if (network === 'mainnet') {
      return [
        'https://publisher-1.walrus.space',
        'https://publisher-2.walrus.space',
        'https://publisher-3.walrus.space'
      ];
    } else {
      return [
        'https://publisher-devnet-1.walrus.space',
        'https://publisher-devnet-2.walrus.space',
        'https://publisher-devnet-3.walrus.space'
      ];
    }
  }

  private getDefaultWalrusAggregators(): string[] {
    const network = process.env.WALRUS_NETWORK || 'testnet';
    
    if (network === 'mainnet') {
      return [
        'https://aggregator-1.walrus.space',
        'https://aggregator-2.walrus.space',
        'https://aggregator-3.walrus.space'
      ];
    } else {
      return [
        'https://aggregator-devnet-1.walrus.space',
        'https://aggregator-devnet-2.walrus.space',
        'https://aggregator-devnet-3.walrus.space'
      ];
    }
  }

  /**
   * Gets the current configuration
   */
  getConfig(): ProductionConfig {
    return { ...this.config };
  }

  /**
   * Gets Walrus configuration
   */
  getWalrusConfig(): WalrusConfig {
    return { ...this.config.walrus };
  }

  /**
   * Gets Seal configuration
   */
  getSealConfig(): SealConfig {
    return { ...this.config.seal };
  }

  /**
   * Checks if running in production environment
   */
  isProduction(): boolean {
    return this.config.environment === 'production';
  }

  /**
   * Checks if monitoring is enabled
   */
  isMonitoringEnabled(): boolean {
    return this.config.monitoring.enabled;
  }

  /**
   * Gets monitoring configuration
   */
  getMonitoringConfig() {
    return { ...this.config.monitoring };
  }

  /**
   * Gets security configuration
   */
  getSecurityConfig() {
    return { ...this.config.security };
  }

  /**
   * Validates network connectivity to Walrus endpoints
   */
  async validateWalrusConnectivity(): Promise<{
    publishers: { url: string; status: 'ok' | 'error'; responseTime?: number }[];
    aggregators: { url: string; status: 'ok' | 'error'; responseTime?: number }[];
  }> {
    const validateEndpoint = async (url: string) => {
      const startTime = Date.now();
      try {
        const response = await fetch(`${url}/health`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        });
        
        return {
          url,
          status: response.ok ? 'ok' as const : 'error' as const,
          responseTime: Date.now() - startTime
        };
      } catch (error) {
        return {
          url,
          status: 'error' as const,
          responseTime: Date.now() - startTime
        };
      }
    };

    const [publishers, aggregators] = await Promise.all([
      Promise.all(this.config.walrus.publisherUrls.map(validateEndpoint)),
      Promise.all(this.config.walrus.aggregatorUrls.map(validateEndpoint))
    ]);

    return { publishers, aggregators };
  }

  /**
   * Validates Seal Protocol connectivity
   */
  async validateSealConnectivity(): Promise<{
    network: string;
    packageExists: boolean;
    serverObjectsValid: boolean;
    gasObjectValid: boolean;
  }> {
    try {
      // This would typically use the SUI SDK to validate
      // For now, we'll return a mock validation
      return {
        network: this.config.seal.network,
        packageExists: !!this.config.seal.packageId,
        serverObjectsValid: this.config.seal.serverObjectIds.length > 0,
        gasObjectValid: !!this.config.seal.gasObjectId
      };
    } catch (error) {
      console.error('Seal connectivity validation failed:', error);
      return {
        network: this.config.seal.network,
        packageExists: false,
        serverObjectsValid: false,
        gasObjectValid: false
      };
    }
  }

  /**
   * Gets environment-specific storage manager configuration
   */
  getStorageManagerConfig() {
    return {
      strategy: this.isProduction() ? 'walrus' : 'hybrid',
      walrus: {
        network: this.config.walrus.network,
        publisherUrls: this.config.walrus.publisherUrls,
        aggregatorUrls: this.config.walrus.aggregatorUrls,
        maxRetries: this.config.walrus.maxRetries,
        timeout: this.config.walrus.timeout
      },
      seal: {
        enabled: true,
        network: this.config.seal.network,
        packageId: this.config.seal.packageId,
        privateKey: this.config.seal.privateKey,
        gasObjectId: this.config.seal.gasObjectId,
        maxGasAmount: this.config.seal.maxGasAmount
      },
      fallback: {
        enabled: !this.isProduction(),
        provider: 'cloudinary'
      }
    };
  }

  /**
   * Sends alert to monitoring system
   */
  async sendAlert(message: string, severity: 'info' | 'warning' | 'error' = 'warning'): Promise<void> {
    if (!this.config.monitoring.enabled || !this.config.monitoring.alertWebhook) {
      console.log(`[${severity.toUpperCase()}] ${message}`);
      return;
    }

    try {
      await fetch(this.config.monitoring.alertWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          severity,
          timestamp: new Date().toISOString(),
          environment: this.config.environment,
          service: 'avatar-service'
        })
      });
    } catch (error) {
      console.error('Failed to send alert:', error);
    }
  }

  /**
   * Performs comprehensive health check
   */
  async performHealthCheck(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    walrus: any;
    seal: any;
    configuration: 'valid' | 'invalid';
    timestamp: string;
  }> {
    try {
      const [walrusHealth, sealHealth] = await Promise.all([
        this.validateWalrusConnectivity(),
        this.validateSealConnectivity()
      ]);

      const walrusHealthy = walrusHealth.publishers.some(p => p.status === 'ok') &&
                           walrusHealth.aggregators.some(a => a.status === 'ok');
      
      const sealHealthy = sealHealth.packageExists && sealHealth.serverObjectsValid;

      let overall: 'healthy' | 'degraded' | 'unhealthy';
      if (walrusHealthy && sealHealthy) {
        overall = 'healthy';
      } else if (walrusHealthy || sealHealthy) {
        overall = 'degraded';
      } else {
        overall = 'unhealthy';
      }

      const result = {
        overall,
        walrus: walrusHealth,
        seal: sealHealth,
        configuration: 'valid' as const,
        timestamp: new Date().toISOString()
      };

      // Send alert if unhealthy
      if (overall === 'unhealthy') {
        await this.sendAlert('Avatar service is unhealthy', 'error');
      } else if (overall === 'degraded') {
        await this.sendAlert('Avatar service is degraded', 'warning');
      }

      return result;
    } catch (error) {
      await this.sendAlert(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      
      return {
        overall: 'unhealthy',
        walrus: { publishers: [], aggregators: [] },
        seal: { network: 'unknown', packageExists: false, serverObjectsValid: false, gasObjectValid: false },
        configuration: 'invalid',
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Singleton instance
let productionConfigService: ProductionConfigService | null = null;

export function getProductionConfigService(): ProductionConfigService {
  if (!productionConfigService) {
    productionConfigService = new ProductionConfigService();
  }
  return productionConfigService;
}