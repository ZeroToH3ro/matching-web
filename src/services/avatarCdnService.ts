import { getStorageManager } from '@/lib/storage';

interface CdnConfig {
  enabled: boolean;
  baseUrl?: string;
  cacheTtl: number;
  imageFormats: string[];
  imageSizes: { [key: string]: { width: number; height: number } };
}

interface CdnImageOptions {
  format?: 'webp' | 'jpeg' | 'png' | 'auto';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'original';
  quality?: number;
}

export class AvatarCdnService {
  private config: CdnConfig;
  private storageManager = getStorageManager();

  constructor(config?: Partial<CdnConfig>) {
    this.config = {
      enabled: process.env.CDN_ENABLED === 'true' || false,
      baseUrl: process.env.CDN_BASE_URL,
      cacheTtl: 86400, // 24 hours
      imageFormats: ['webp', 'jpeg'],
      imageSizes: {
        sm: { width: 64, height: 64 },
        md: { width: 128, height: 128 },
        lg: { width: 256, height: 256 },
        xl: { width: 512, height: 512 }
      },
      ...config
    };
  }

  /**
   * Gets the optimized CDN URL for a public avatar
   */
  getCdnUrl(
    blobId: string,
    options: CdnImageOptions = {}
  ): string {
    if (!this.config.enabled || !this.config.baseUrl) {
      // Fallback to direct storage URL
      return this.storageManager.getUrl(blobId);
    }

    const {
      format = 'auto',
      size = 'md',
      quality = 85
    } = options;

    // Build CDN URL with transformations
    const params = new URLSearchParams();
    
    if (format !== 'auto') {
      params.set('f', format);
    }
    
    if (size !== 'original' && this.config.imageSizes[size]) {
      const { width, height } = this.config.imageSizes[size];
      params.set('w', width.toString());
      params.set('h', height.toString());
      params.set('c', 'fill'); // Crop to fill dimensions
    }
    
    params.set('q', quality.toString());
    
    // Add cache control
    params.set('cache', this.config.cacheTtl.toString());

    const queryString = params.toString();
    return `${this.config.baseUrl}/avatar/${blobId}${queryString ? `?${queryString}` : ''}`;
  }

  /**
   * Gets multiple CDN URLs for different formats and sizes (for responsive images)
   */
  getResponsiveUrls(blobId: string): {
    webp: { [size: string]: string };
    jpeg: { [size: string]: string };
    srcSet: string;
    sizes: string;
  } {
    const webpUrls: { [size: string]: string } = {};
    const jpegUrls: { [size: string]: string } = {};
    const srcSetEntries: string[] = [];

    Object.keys(this.config.imageSizes).forEach(size => {
      const { width } = this.config.imageSizes[size];
      
      webpUrls[size] = this.getCdnUrl(blobId, { format: 'webp', size: size as any });
      jpegUrls[size] = this.getCdnUrl(blobId, { format: 'jpeg', size: size as any });
      
      srcSetEntries.push(`${webpUrls[size]} ${width}w`);
    });

    return {
      webp: webpUrls,
      jpeg: jpegUrls,
      srcSet: srcSetEntries.join(', '),
      sizes: '(max-width: 64px) 64px, (max-width: 128px) 128px, (max-width: 256px) 256px, 512px'
    };
  }

  /**
   * Preloads an avatar image to CDN cache
   */
  async preloadToCache(blobId: string): Promise<boolean> {
    if (!this.config.enabled || !this.config.baseUrl) {
      return false;
    }

    try {
      // Make a HEAD request to warm up the CDN cache
      const url = this.getCdnUrl(blobId);
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.error('Failed to preload avatar to CDN:', error);
      return false;
    }
  }

  /**
   * Invalidates CDN cache for a specific avatar
   */
  async invalidateCdnCache(blobId: string): Promise<boolean> {
    if (!this.config.enabled || !this.config.baseUrl) {
      return false;
    }

    try {
      // This would typically call a CDN API to purge cache
      // Implementation depends on CDN provider (CloudFlare, AWS CloudFront, etc.)
      
      // For now, we'll make a request with cache-busting parameter
      const url = `${this.config.baseUrl}/purge/avatar/${blobId}`;
      const response = await fetch(url, { method: 'POST' });
      return response.ok;
    } catch (error) {
      console.error('Failed to invalidate CDN cache:', error);
      return false;
    }
  }

  /**
   * Gets CDN cache headers for avatar responses
   */
  getCacheHeaders(isPublic: boolean = true): Record<string, string> {
    if (isPublic) {
      return {
        'Cache-Control': `public, max-age=${this.config.cacheTtl}, s-maxage=${this.config.cacheTtl * 2}`,
        'Vary': 'Accept',
        'X-Content-Type-Options': 'nosniff'
      };
    } else {
      // Private avatars should not be cached by CDN
      return {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      };
    }
  }

  /**
   * Generates optimized image HTML for avatars
   */
  generateImageHtml(
    blobId: string,
    alt: string,
    className?: string,
    size: 'sm' | 'md' | 'lg' | 'xl' = 'md'
  ): string {
    if (!this.config.enabled) {
      const url = this.storageManager.getUrl(blobId);
      return `<img src="${url}" alt="${alt}" class="${className || ''}" />`;
    }

    const responsive = this.getResponsiveUrls(blobId);
    const fallbackUrl = this.getCdnUrl(blobId, { format: 'jpeg', size });

    return `
      <picture class="${className || ''}">
        <source 
          srcset="${responsive.srcSet}" 
          sizes="${responsive.sizes}" 
          type="image/webp"
        />
        <img 
          src="${fallbackUrl}" 
          srcset="${Object.entries(responsive.jpeg).map(([s, url]) => 
            `${url} ${this.config.imageSizes[s].width}w`
          ).join(', ')}"
          sizes="${responsive.sizes}"
          alt="${alt}"
          loading="lazy"
          decoding="async"
        />
      </picture>
    `.trim();
  }

  /**
   * Gets performance metrics for CDN usage
   */
  async getCdnMetrics(): Promise<{
    enabled: boolean;
    baseUrl?: string;
    cacheHitRate?: number;
    bandwidth?: string;
    requests?: number;
  }> {
    return {
      enabled: this.config.enabled,
      baseUrl: this.config.baseUrl,
      // These would typically come from CDN provider APIs
      cacheHitRate: undefined,
      bandwidth: undefined,
      requests: undefined
    };
  }

  /**
   * Checks if CDN is available and responding
   */
  async healthCheck(): Promise<boolean> {
    if (!this.config.enabled || !this.config.baseUrl) {
      return false;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/health`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      return response.ok;
    } catch (error) {
      console.error('CDN health check failed:', error);
      return false;
    }
  }
}

// Singleton instance
let avatarCdnService: AvatarCdnService | null = null;

export function getAvatarCdnService(): AvatarCdnService {
  if (!avatarCdnService) {
    avatarCdnService = new AvatarCdnService();
  }
  return avatarCdnService;
}