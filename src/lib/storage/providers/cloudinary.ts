import { v2 as cloudinary } from 'cloudinary';
import type { 
  StorageProvider, 
  UploadOptions, 
  UploadResult, 
  DownloadOptions, 
  DownloadResult,
  CloudinaryConfig 
} from '../types';

export class CloudinaryStorageProvider implements StorageProvider {
  public readonly name = 'cloudinary';
  private config: CloudinaryConfig;

  constructor(config: CloudinaryConfig) {
    this.config = config;
    
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret
    });
  }

  async upload(file: File | Buffer, options: UploadOptions = {}): Promise<UploadResult> {
    try {
      let data: Buffer;
      let size: number;
      let contentType: string;

      if (file instanceof File) {
        data = Buffer.from(await file.arrayBuffer());
        size = file.size;
        contentType = file.type || options.contentType || 'application/octet-stream';
      } else {
        data = file;
        size = file.length;
        contentType = options.contentType || 'application/octet-stream';
      }

      // Validate file size
      if (options.maxSize && size > options.maxSize) {
        throw new Error(`File size ${size} exceeds maximum ${options.maxSize} bytes`);
      }

      // Convert buffer to base64 data URI
      const base64Data = `data:${contentType};base64,${data.toString('base64')}`;

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(base64Data, {
        public_id: options.filename?.split('.')[0], // Remove extension
        resource_type: 'auto',
        access_mode: options.isPublic ? 'public' : 'authenticated',
        ...(options.filename && { original_filename: options.filename })
      });

      return {
        id: result.public_id,
        url: result.secure_url,
        size: result.bytes,
        contentType: contentType,
        provider: this.name,
        metadata: {
          publicId: result.public_id,
          version: result.version,
          signature: result.signature,
          format: result.format,
          resourceType: result.resource_type,
          createdAt: result.created_at,
          etag: result.etag
        }
      };
    } catch (error) {
      throw new Error(`Cloudinary upload failed: ${error}`);
    }
  }

  async download(id: string, options: DownloadOptions = {}): Promise<DownloadResult> {
    try {
      // Get the URL and fetch the resource
      const url = this.getUrl(id);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to download resource: ${response.statusText}`);
      }

      const data = Buffer.from(await response.arrayBuffer());
      
      return {
        data,
        contentType: response.headers.get('content-type') || 'application/octet-stream',
        size: data.length,
        metadata: {
          publicId: id,
          url: url
        }
      };
    } catch (error) {
      throw new Error(`Cloudinary download failed: ${error}`);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(id);
    } catch (error) {
      throw new Error(`Cloudinary delete failed: ${error}`);
    }
  }

  getUrl(id: string, transformations?: string[]): string {
    if (transformations && transformations.length > 0) {
      const transformString = transformations.join(',');
      return cloudinary.url(id, { transformation: transformString });
    }
    return cloudinary.url(id);
  }

  // Additional Cloudinary-specific methods
  async getResourceInfo(publicId: string) {
    try {
      return await cloudinary.api.resource(publicId);
    } catch (error) {
      throw new Error(`Failed to get resource info: ${error}`);
    }
  }

  generateSignature(params: Record<string, any>, apiSecret: string) {
    return cloudinary.utils.api_sign_request(params, apiSecret);
  }
}