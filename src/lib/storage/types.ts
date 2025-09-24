export interface StorageProvider {
  name: string;
  upload(file: File | Buffer, options?: UploadOptions): Promise<UploadResult>;
  download(id: string, options?: DownloadOptions): Promise<DownloadResult>;
  delete(id: string): Promise<void>;
  getUrl(id: string): string;
}

export interface UploadOptions {
  filename?: string;
  contentType?: string;
  isPublic?: boolean;
  maxSize?: number;
  encrypt?: boolean;
  accessPolicy?: AccessPolicy;
}

export interface DownloadOptions {
  decrypt?: boolean;
}

export interface UploadResult {
  id: string;
  url: string;
  size: number;
  contentType: string;
  provider: string;
  metadata?: Record<string, any>;
}

export interface DownloadResult {
  data: Buffer;
  contentType: string;
  size: number;
  metadata?: Record<string, any>;
}

export interface AccessPolicy {
  rules: AccessRule[];
  threshold?: number;
}

export interface AccessRule {
  type: 'wallet' | 'role' | 'subscription' | 'time';
  value: string | number;
  operation: 'allow' | 'deny';
}

export type StorageStrategy = 'cloudinary' | 'walrus' | 'hybrid';

export interface StorageConfig {
  strategy: StorageStrategy;
  providers: {
    cloudinary?: CloudinaryConfig;
    walrus?: WalrusConfig;
  };
}

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export interface WalrusConfig {
  suiNetwork: 'mainnet' | 'testnet' | 'devnet';
  privateKey?: string;
  publisherUrls?: string[];
  aggregatorUrls?: string[];
}