import { WalrusClient } from '@mysten/walrus';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import type { 
  StorageProvider, 
  UploadOptions, 
  UploadResult, 
  DownloadOptions, 
  DownloadResult,
  WalrusConfig 
} from '../types';

export class WalrusStorageProvider implements StorageProvider {
  public readonly name = 'walrus';
  private walrusClient: WalrusClient;
  private suiClient: SuiClient;
  private config: WalrusConfig;

  constructor(config: WalrusConfig) {
    this.config = config;
    
    // Initialize Sui client
    this.suiClient = new SuiClient({
      url: getFullnodeUrl(config.suiNetwork)
    });

    // Initialize Walrus client
    this.walrusClient = new WalrusClient({
      network: config.suiNetwork === 'devnet' ? 'testnet' : config.suiNetwork,
      suiClient: this.suiClient
    });
  }

  async upload(file: File | Buffer, options: UploadOptions = {}): Promise<UploadResult> {
    try {
      // Convert File to Uint8Array if needed
      let data: Uint8Array;
      let size: number;
      let contentType: string;

      if (file instanceof File) {
        data = new Uint8Array(await file.arrayBuffer());
        size = file.size;
        contentType = file.type || options.contentType || 'application/octet-stream';
      } else {
        data = new Uint8Array(file);
        size = file.length;
        contentType = options.contentType || 'application/octet-stream';
      }

      // Validate file size
      if (options.maxSize && size > options.maxSize) {
        throw new Error(`File size ${size} exceeds maximum ${options.maxSize} bytes`);
      }

      // Store blob in Walrus using HTTP API (based on Seal example pattern)
      const publisherUrl = this.getPublisherUrl();
      const epochs = 5; // Store for 5 epochs by default

      const response = await fetch(`${publisherUrl}/v1/blobs?epochs=${epochs}`, {
        method: 'PUT',
        body: data as BodyInit,
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to upload to Walrus: ${response.statusText}`);
      }

      const result = await response.json();
      const blobId = result.newlyCreated?.blobObject?.blobId || result.alreadyCertified?.blobId;

      if (!blobId) {
        throw new Error('Invalid response from Walrus publisher - missing blobId');
      }

      return {
        id: blobId,
        url: this.getUrl(blobId),
        size,
        contentType,
        provider: this.name,
        metadata: {
          blobId,
          epochs,
          ...result
        }
      };
    } catch (error) {
      throw new Error(`Walrus upload failed: ${error}`);
    }
  }

  async download(id: string, options: DownloadOptions = {}): Promise<DownloadResult> {
    try {
      // Read blob from Walrus using HTTP API (based on Seal example pattern)
      const aggregatorUrl = this.getAggregatorUrl();
      const response = await fetch(`${aggregatorUrl}/v1/${id}`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`Failed to download from Walrus: ${response.statusText}`);
      }

      const data = Buffer.from(await response.arrayBuffer());

      return {
        data,
        contentType: response.headers.get('content-type') || 'application/octet-stream',
        size: data.length,
        metadata: {
          blobId: id
        }
      };
    } catch (error) {
      throw new Error(`Walrus download failed: ${error}`);
    }
  }

  async delete(id: string): Promise<void> {
    // Walrus doesn't support deletion - blobs are immutable
    // This is a no-op for compatibility with the interface
    console.warn(`Walrus doesn't support deletion of blob ${id}. Blob will expire after storage period.`);
  }

  getUrl(id: string): string {
    return `${this.getAggregatorUrl()}/v1/${id}`;
  }

  private getPublisherUrl(): string {
    // Use configured URLs or fallback to defaults
    const publishers = this.config.publisherUrls || (
      this.config.suiNetwork === 'mainnet'
        ? ['https://publisher.walrus.space'] // TODO: Add real mainnet URLs when available
        : ['https://publisher.walrus-testnet.walrus.space'] // Fallback testnet URL
    );

    // Return random publisher for load balancing (like in Seal example)
    return publishers[Math.floor(Math.random() * publishers.length)];
  }

  private getAggregatorUrl(): string {
    // Use configured URLs or fallback to defaults
    const aggregators = this.config.aggregatorUrls || (
      this.config.suiNetwork === 'mainnet'
        ? ['https://aggregator.walrus.space'] // TODO: Add real mainnet URLs when available
        : ['https://aggregator.walrus-testnet.walrus.space'] // Fallback testnet URL
    );

    // Return random aggregator for load balancing (like in Seal example)
    return aggregators[Math.floor(Math.random() * aggregators.length)];
  }

  // Additional Walrus-specific methods would require the actual SDK methods
  // These are placeholder implementations for the interface
  async getBlobInfo(blobId: string) {
    // TODO: Implement when Walrus SDK provides blob info methods
    throw new Error('getBlobInfo not implemented - Walrus SDK method not available');
  }

  async getStorageNodes() {
    // TODO: Implement when Walrus SDK provides storage node methods
    throw new Error('getStorageNodes not implemented - Walrus SDK method not available');
  }
}