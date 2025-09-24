import { StorageManager } from './manager';
import { StorageConfig, StorageStrategy } from './types';
import { SealConfig } from './providers/seal';

// Export types
export * from './types';
export * from './providers/seal';

// Environment-based configuration
const getStorageConfig = (): StorageConfig => {
  const strategy = (process.env.STORAGE_STRATEGY as StorageStrategy) || 'hybrid';
  
  return {
    strategy,
    providers: {
      cloudinary: {
        cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!,
        apiKey: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY!,
        apiSecret: process.env.CLOUDINARY_API_SECRET!,
      },
      walrus: {
        suiNetwork: (process.env.SUI_NETWORK as 'mainnet' | 'testnet' | 'devnet') || 'testnet',
        privateKey: process.env.SUI_PRIVATE_KEY,
        // Real Walrus testnet URLs from official Seal example (can be overridden via env vars)
        publisherUrls: process.env.WALRUS_PUBLISHER_URLS?.split(',').map(url => url.trim()) || [
          'https://publisher.walrus-testnet.walrus.space',
          'https://wal-publisher-testnet.staketab.org',
          'https://walrus-testnet-publisher.redundex.com',
          'https://walrus-testnet-publisher.nodes.guru',
          'https://publisher.walrus.banansen.dev',
          'https://walrus-testnet-publisher.everstake.one'
        ],
        aggregatorUrls: process.env.WALRUS_AGGREGATOR_URLS?.split(',').map(url => url.trim()) || [
          'https://aggregator.walrus-testnet.walrus.space',
          'https://wal-aggregator-testnet.staketab.org',
          'https://walrus-testnet-aggregator.redundex.com',
          'https://walrus-testnet-aggregator.nodes.guru',
          'https://aggregator.walrus.banansen.dev',
          'https://walrus-testnet-aggregator.everstake.one'
        ]
      }
    }
  };
};

const getSealConfig = (): SealConfig | undefined => {
  if (!process.env.SEAL_ENABLED) {
    return undefined;
  }

  // Parse server configs from environment variable
  const serverConfigs = process.env.SEAL_SERVER_OBJECT_IDS
    ? process.env.SEAL_SERVER_OBJECT_IDS.split(',').map(objectId => ({
        objectId: objectId.trim(),
        weight: 1
      }))
    : undefined;

  return {
    suiNetwork: (process.env.SUI_NETWORK as 'mainnet' | 'testnet' | 'devnet') || 'testnet',
    privateKey: process.env.SUI_PRIVATE_KEY,
    packageId: process.env.SEAL_PACKAGE_ID,
    serverConfigs
  };
};

// Create singleton storage manager instance
let storageManager: StorageManager | null = null;

export const getStorageManager = (): StorageManager => {
  if (!storageManager) {
    const config = getStorageConfig();
    const sealConfig = getSealConfig();
    storageManager = new StorageManager(config, sealConfig);
  }
  return storageManager;
};

// Convenience functions
export const uploadFile = async (
  file: File | Buffer, 
  options?: Parameters<StorageManager['upload']>[1]
) => {
  const manager = getStorageManager();
  return manager.upload(file, options);
};

export const downloadFile = async (
  id: string,
  options?: Parameters<StorageManager['download']>[1]
) => {
  const manager = getStorageManager();
  return manager.download(id, options);
};

export const deleteFile = async (id: string) => {
  const manager = getStorageManager();
  return manager.delete(id);
};

export const getFileUrl = (id: string) => {
  const manager = getStorageManager();
  return manager.getUrl(id);
};

// Development/testing utilities
export const createStorageManager = (config: StorageConfig, sealConfig?: SealConfig) => {
  return new StorageManager(config, sealConfig);
};

// Error classes
export class StorageError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'StorageError';
  }
}

export class AccessDeniedError extends StorageError {
  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'AccessDeniedError';
  }
}

export class ProviderError extends StorageError {
  constructor(provider: string, message: string, cause?: Error) {
    super(`${provider}: ${message}`);
    this.name = 'ProviderError';
    this.cause = cause;
  }
}