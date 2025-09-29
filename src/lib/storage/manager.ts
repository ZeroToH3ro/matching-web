import type { 
  StorageProvider, 
  StorageConfig, 
  StorageStrategy,
  UploadOptions, 
  UploadResult, 
  DownloadOptions, 
  DownloadResult 
} from './types';
import { CloudinaryStorageProvider } from './providers/cloudinary';
import { WalrusStorageProvider } from './providers/walrus';
import { SealAccessControl, type SealConfig } from './providers/seal';

export class StorageManager {
  private providers: Map<string, StorageProvider> = new Map();
  private sealAccessControl?: SealAccessControl;
  private strategy: StorageStrategy;

  constructor(config: StorageConfig, sealConfig?: SealConfig) {
    this.strategy = config.strategy;

    // Initialize providers based on configuration
    if (config.providers.cloudinary) {
      const cloudinaryProvider = new CloudinaryStorageProvider(config.providers.cloudinary);
      this.providers.set('cloudinary', cloudinaryProvider);
    }

    if (config.providers.walrus) {
      const walrusProvider = new WalrusStorageProvider(config.providers.walrus);
      this.providers.set('walrus', walrusProvider);
    }

    // Initialize Seal for access control if configured
    if (sealConfig) {
      this.sealAccessControl = new SealAccessControl(sealConfig);
    }
  }

  async upload(file: File | Buffer, options: UploadOptions = {}): Promise<UploadResult> {
    const provider = this.selectProvider(options);
    
    if (!provider) {
      throw new Error(`No storage provider available for strategy: ${this.strategy}`);
    }

    try {
      // Handle encryption if access policy is specified
      if (options.encrypt && options.accessPolicy && this.sealAccessControl) {
        return await this.uploadEncrypted(file, options, provider);
      }

      // Standard upload
      return await provider.upload(file, options);
    } catch (error) {
      // Fallback to alternative provider if hybrid strategy
      if (this.strategy === 'hybrid') {
        const fallbackProvider = this.getFallbackProvider(provider.name);
        if (fallbackProvider) {
          console.warn(`Primary upload failed, trying fallback provider: ${fallbackProvider.name}`);
          return await fallbackProvider.upload(file, options);
        }
      }
      throw error;
    }
  }

  async download(id: string, options: DownloadOptions = {}): Promise<DownloadResult> {
    // Extract provider info from ID (format: provider:actualId or provider:policyId:keyId)
    const [providerName, ...idParts] = id.split(':');
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new Error(`Storage provider not found: ${providerName}`);
    }

    try {
      // Handle decryption if needed
      if (options.decrypt && idParts.length > 1 && this.sealAccessControl) {
        return await this.downloadEncrypted(idParts, options, provider);
      }

      // Standard download
      const actualId = idParts.join(':') || id; // Handle original format
      return await provider.download(actualId, options);
    } catch (error) {
      throw new Error(`Download failed: ${error}`);
    }
  }

  async delete(id: string): Promise<void> {
    const [providerName, ...idParts] = id.split(':');
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new Error(`Storage provider not found: ${providerName}`);
    }

    const actualId = idParts.join(':') || id;
    await provider.delete(actualId);
  }

  getUrl(id: string): string {
    const [providerName, ...idParts] = id.split(':');
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new Error(`Storage provider not found: ${providerName}`);
    }

    const actualId = idParts.join(':') || id;
    return provider.getUrl(actualId);
  }

  private selectProvider(options: UploadOptions): StorageProvider | undefined {
    switch (this.strategy) {
      case 'cloudinary':
        return this.providers.get('cloudinary');
      
      case 'walrus':
        return this.providers.get('walrus');
      
      case 'hybrid':
        // Use Walrus for large files or when encryption is needed
        if (options.encrypt || (options.maxSize && options.maxSize > 10 * 1024 * 1024)) {
          return this.providers.get('walrus') || this.providers.get('cloudinary');
        }
        // Use Cloudinary for smaller files and images
        return this.providers.get('cloudinary') || this.providers.get('walrus');
      
      default:
        return Array.from(this.providers.values())[0];
    }
  }

  private getFallbackProvider(currentProviderName: string): StorageProvider | undefined {
    const providers = Array.from(this.providers.entries());
    for (const [name, provider] of providers) {
      if (name !== currentProviderName) {
        return provider;
      }
    }
    return undefined;
  }

  private async uploadEncrypted(
    file: File | Buffer, 
    options: UploadOptions, 
    provider: StorageProvider
  ): Promise<UploadResult> {
    if (!this.sealAccessControl || !options.accessPolicy) {
      throw new Error('Seal access control not configured or access policy missing');
    }

    try {
      // Convert file to Uint8Array
      let data: Uint8Array;
      if (file instanceof File) {
        data = new Uint8Array(await file.arrayBuffer());
      } else {
        data = new Uint8Array(file);
      }

      // Encrypt data with Seal
      const encryptionResult = await this.sealAccessControl.createEncryptedStorage(
        data,
        options.accessPolicy,
        { filename: options.filename, contentType: options.contentType }
      );

      // Upload encrypted data
      const uploadResult = await provider.upload(
        Buffer.from(encryptionResult.encryptedData),
        { ...options, contentType: 'application/octet-stream' }
      );

      // Return modified result with encryption metadata
      return {
        ...uploadResult,
        id: `${provider.name}:${uploadResult.id}:${encryptionResult.policyId}:${encryptionResult.keyId}`,
        metadata: {
          ...uploadResult.metadata,
          encrypted: true,
          policyId: encryptionResult.policyId,
          keyId: encryptionResult.keyId,
          originalContentType: options.contentType
        }
      };
    } catch (error) {
      throw new Error(`Encrypted upload failed: ${error}`);
    }
  }

  private async downloadEncrypted(
    idParts: string[], 
    options: DownloadOptions, 
    provider: StorageProvider
  ): Promise<DownloadResult> {
    if (!this.sealAccessControl) {
      throw new Error('Seal access control not configured');
    }

    const [actualId, policyId, keyId] = idParts;
    if (!actualId || !policyId || !keyId) {
      throw new Error('Invalid encrypted file ID format');
    }

    try {
      // Download encrypted data
      const downloadResult = await provider.download(actualId);

      // Decrypt data with Seal (userAddress should come from session/context)
      const userAddress = '0x...'; // TODO: Get from auth context
      const decryptedData = await this.sealAccessControl.decryptStorage(
        new Uint8Array(downloadResult.data),
        keyId,
        userAddress
      );

      return {
        data: Buffer.from(decryptedData),
        contentType: downloadResult.metadata?.originalContentType || 'application/octet-stream',
        size: decryptedData.length,
        metadata: {
          ...downloadResult.metadata,
          decrypted: true,
          policyId,
          keyId
        }
      };
    } catch (error) {
      throw new Error(`Encrypted download failed: ${error}`);
    }
  }

  // Utility methods
  getProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  hasProvider(name: string): boolean {
    return this.providers.has(name);
  }

  getStrategy(): StorageStrategy {
    return this.strategy;
  }

  // Seal-specific methods
  async createAccessPolicy(policy: any) {
    if (!this.sealAccessControl) {
      throw new Error('Seal access control not configured');
    }
    // Implementation depends on specific policy format
    throw new Error('Method not implemented');
  }

  async verifyAccess(keyId: string, userAddress: string): Promise<boolean> {
    if (!this.sealAccessControl) {
      return true; // No access control configured
    }
    
    try {
      return await (this.sealAccessControl as any).verifyAccess(keyId, userAddress);
    } catch (error) {
      console.error('Access verification failed:', error);
      return false;
    }
  }
}