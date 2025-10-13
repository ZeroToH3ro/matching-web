/**
 * Utility functions for image optimization and responsive loading
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ResponsiveImageConfig {
  sizes: { [key: string]: ImageDimensions };
  formats: string[];
  qualities: { [format: string]: number };
}

export const defaultImageConfig: ResponsiveImageConfig = {
  sizes: {
    sm: { width: 64, height: 64 },
    md: { width: 128, height: 128 },
    lg: { width: 256, height: 256 },
    xl: { width: 512, height: 512 }
  },
  formats: ['webp', 'jpeg'],
  qualities: {
    webp: 85,
    jpeg: 90,
    png: 95
  }
};

/**
 * Generates srcSet string for responsive images
 */
export function generateSrcSet(
  baseUrl: string,
  userId: string,
  format: string,
  sizes: string[] = ['sm', 'md', 'lg', 'xl']
): string {
  return sizes
    .map(size => {
      const dimensions = defaultImageConfig.sizes[size];
      if (!dimensions) return null;
      
      const url = `${baseUrl}/api/avatar/${userId}/${size}/${format}`;
      return `${url} ${dimensions.width}w`;
    })
    .filter(Boolean)
    .join(', ');
}

/**
 * Generates sizes attribute for responsive images
 */
export function generateSizesAttribute(
  breakpoints?: { [breakpoint: string]: string }
): string {
  const defaultBreakpoints = {
    '(max-width: 64px)': '64px',
    '(max-width: 128px)': '128px',
    '(max-width: 256px)': '256px'
  };

  const sizesMap = breakpoints || defaultBreakpoints;
  const sizesArray = Object.entries(sizesMap).map(([query, size]) => `${query} ${size}`);
  sizesArray.push('512px'); // Default size

  return sizesArray.join(', ');
}

/**
 * Detects WebP support in the browser
 */
export function supportsWebP(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    const webP = new Image();
    webP.onload = webP.onerror = () => {
      resolve(webP.height === 2);
    };
    webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  });
}

/**
 * Gets the optimal image format based on browser support
 */
export async function getOptimalFormat(): Promise<'webp' | 'jpeg'> {
  const webpSupported = await supportsWebP();
  return webpSupported ? 'webp' : 'jpeg';
}

/**
 * Calculates the appropriate image size based on container dimensions
 */
export function calculateOptimalSize(
  containerWidth: number,
  containerHeight: number,
  devicePixelRatio: number = 1
): string {
  const targetWidth = containerWidth * devicePixelRatio;
  const targetHeight = containerHeight * devicePixelRatio;
  const targetArea = targetWidth * targetHeight;

  // Find the best matching size
  const sizes = Object.entries(defaultImageConfig.sizes);
  let bestSize = 'md';
  let bestMatch = Infinity;

  for (const [sizeKey, dimensions] of sizes) {
    const sizeArea = dimensions.width * dimensions.height;
    const difference = Math.abs(sizeArea - targetArea);
    
    if (difference < bestMatch) {
      bestMatch = difference;
      bestSize = sizeKey;
    }
  }

  return bestSize;
}

/**
 * Preloads critical images for better performance
 */
export function preloadCriticalImages(imageUrls: string[]): void {
  if (typeof window === 'undefined') return;

  imageUrls.forEach(url => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    document.head.appendChild(link);
  });
}

/**
 * Creates a low-quality image placeholder (LQIP) data URL
 */
export function generateLQIP(
  width: number = 20,
  height: number = 20,
  color: string = '#f3f4f6'
): string {
  if (typeof window === 'undefined') {
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${color}"/>
      </svg>
    `)}`;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  
  return canvas.toDataURL('image/jpeg', 0.1);
}

/**
 * Intersection Observer for lazy loading images
 */
export function createImageIntersectionObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options?: IntersectionObserverInit
): IntersectionObserver | null {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return null;
  }

  return new IntersectionObserver(callback, {
    rootMargin: '50px',
    threshold: 0.1,
    ...options
  });
}

/**
 * Estimates image loading time based on connection speed
 */
export function estimateLoadingTime(
  imageSizeBytes: number,
  connectionType?: string
): number {
  // Connection speed estimates (bytes per second)
  const connectionSpeeds: { [key: string]: number } = {
    'slow-2g': 50 * 1024,      // 50 KB/s
    '2g': 250 * 1024,          // 250 KB/s
    '3g': 750 * 1024,          // 750 KB/s
    '4g': 1.5 * 1024 * 1024,   // 1.5 MB/s
    'wifi': 5 * 1024 * 1024    // 5 MB/s (default)
  };

  const speed = connectionSpeeds[connectionType || 'wifi'];
  return Math.ceil(imageSizeBytes / speed);
}

/**
 * Gets network information if available
 */
export function getNetworkInfo(): {
  effectiveType?: string;
  downlink?: number;
  saveData?: boolean;
} {
  if (typeof window === 'undefined' || !('navigator' in window)) {
    return {};
  }

  const nav = navigator as any;
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

  if (!connection) {
    return {};
  }

  return {
    effectiveType: connection.effectiveType,
    downlink: connection.downlink,
    saveData: connection.saveData
  };
}

/**
 * Determines if images should be optimized based on network conditions
 */
export function shouldOptimizeForNetwork(): boolean {
  const networkInfo = getNetworkInfo();
  
  // Optimize for slow connections or when save-data is enabled
  if (networkInfo.saveData) return true;
  if (networkInfo.effectiveType === 'slow-2g' || networkInfo.effectiveType === '2g') return true;
  if (networkInfo.downlink && networkInfo.downlink < 1) return true;
  
  return false;
}

/**
 * React hook for managing responsive image loading
 */
export function useResponsiveImage(
  baseUrl: string,
  userId: string,
  size: string = 'md'
) {
  const [format, setFormat] = React.useState<'webp' | 'jpeg'>('jpeg');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getOptimalFormat().then(setFormat);
  }, []);

  const imageUrl = `${baseUrl}/api/avatar/${userId}/${size}/${format}`;
  const srcSet = generateSrcSet(baseUrl, userId, format);
  const sizes = generateSizesAttribute();

  return {
    imageUrl,
    srcSet,
    sizes,
    format,
    loading,
    error,
    setLoading,
    setError
  };
}

// Re-export React for the hook
import React from 'react';