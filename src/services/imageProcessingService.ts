import sharp from 'sharp';

interface ImageProcessingConfig {
  formats: ('webp' | 'jpeg' | 'png')[];
  sizes: { [key: string]: { width: number; height: number; quality?: number } };
  defaultQuality: number;
  maxFileSize: number; // in bytes
}

interface ProcessedImage {
  buffer: Buffer;
  format: string;
  width: number;
  height: number;
  size: number;
}

export interface ImageVariant {
  size: string;
  format: string;
  buffer: Buffer;
  width: number;
  height: number;
  fileSize: number;
}

export class ImageProcessingService {
  private config: ImageProcessingConfig;

  constructor(config?: Partial<ImageProcessingConfig>) {
    this.config = {
      formats: ['webp', 'jpeg'],
      sizes: {
        sm: { width: 64, height: 64, quality: 80 },
        md: { width: 128, height: 128, quality: 85 },
        lg: { width: 256, height: 256, quality: 90 },
        xl: { width: 512, height: 512, quality: 95 },
        original: { width: 1024, height: 1024, quality: 95 }
      },
      defaultQuality: 85,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      ...config
    };
  }

  /**
   * Processes an image file into multiple formats and sizes
   */
  async processImage(
    inputBuffer: Buffer,
    options?: {
      formats?: ('webp' | 'jpeg' | 'png')[];
      sizes?: string[];
      quality?: number;
    }
  ): Promise<ImageVariant[]> {
    try {
      const formats = options?.formats || this.config.formats;
      const sizes = options?.sizes || Object.keys(this.config.sizes);
      const quality = options?.quality || this.config.defaultQuality;

      // Validate input
      const metadata = await sharp(inputBuffer).metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error('Invalid image: unable to read dimensions');
      }

      const variants: ImageVariant[] = [];

      // Process each size
      for (const sizeKey of sizes) {
        const sizeConfig = this.config.sizes[sizeKey];
        if (!sizeConfig) continue;

        // Process each format for this size
        for (const format of formats) {
          try {
            const processed = await this.processImageVariant(
              inputBuffer,
              sizeConfig,
              format,
              sizeConfig.quality || quality
            );

            variants.push({
              size: sizeKey,
              format,
              buffer: processed.buffer,
              width: processed.width,
              height: processed.height,
              fileSize: processed.size
            });
          } catch (error) {
            console.warn(`Failed to process ${sizeKey} ${format}:`, error);
          }
        }
      }

      return variants;
    } catch (error) {
      console.error('Image processing failed:', error);
      throw new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Processes a single image variant
   */
  private async processImageVariant(
    inputBuffer: Buffer,
    sizeConfig: { width: number; height: number },
    format: string,
    quality: number
  ): Promise<ProcessedImage> {
    let pipeline = sharp(inputBuffer)
      .resize(sizeConfig.width, sizeConfig.height, {
        fit: 'cover',
        position: 'center'
      });

    // Apply format-specific processing
    switch (format) {
      case 'webp':
        pipeline = pipeline.webp({ 
          quality,
          effort: 4, // Balance between compression and speed
          smartSubsample: true
        });
        break;
      case 'jpeg':
        pipeline = pipeline.jpeg({ 
          quality,
          progressive: true,
          mozjpeg: true // Better compression
        });
        break;
      case 'png':
        pipeline = pipeline.png({ 
          quality,
          compressionLevel: 8,
          progressive: true
        });
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    const buffer = await pipeline.toBuffer();
    const metadata = await sharp(buffer).metadata();

    return {
      buffer,
      format,
      width: metadata.width || sizeConfig.width,
      height: metadata.height || sizeConfig.height,
      size: buffer.length
    };
  }

  /**
   * Optimizes an image for web delivery
   */
  async optimizeForWeb(
    inputBuffer: Buffer,
    targetFormat: 'webp' | 'jpeg' = 'webp',
    maxWidth: number = 1024,
    quality: number = 85
  ): Promise<ProcessedImage> {
    try {
      const metadata = await sharp(inputBuffer).metadata();
      const width = Math.min(metadata.width || maxWidth, maxWidth);
      const height = Math.round((width / (metadata.width || 1)) * (metadata.height || 1));

      return await this.processImageVariant(
        inputBuffer,
        { width, height },
        targetFormat,
        quality
      );
    } catch (error) {
      console.error('Web optimization failed:', error);
      throw error;
    }
  }

  /**
   * Creates a progressive JPEG for better loading experience
   */
  async createProgressiveJpeg(
    inputBuffer: Buffer,
    quality: number = 85
  ): Promise<ProcessedImage> {
    try {
      const buffer = await sharp(inputBuffer)
        .jpeg({
          quality,
          progressive: true,
          mozjpeg: true
        })
        .toBuffer();

      const metadata = await sharp(buffer).metadata();

      return {
        buffer,
        format: 'jpeg',
        width: metadata.width || 0,
        height: metadata.height || 0,
        size: buffer.length
      };
    } catch (error) {
      console.error('Progressive JPEG creation failed:', error);
      throw error;
    }
  }

  /**
   * Generates a low-quality placeholder for progressive loading
   */
  async generatePlaceholder(
    inputBuffer: Buffer,
    width: number = 20,
    quality: number = 20
  ): Promise<ProcessedImage> {
    try {
      const buffer = await sharp(inputBuffer)
        .resize(width, null, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality })
        .toBuffer();

      const metadata = await sharp(buffer).metadata();

      return {
        buffer,
        format: 'jpeg',
        width: metadata.width || width,
        height: metadata.height || Math.round(width * 0.75),
        size: buffer.length
      };
    } catch (error) {
      console.error('Placeholder generation failed:', error);
      throw error;
    }
  }

  /**
   * Validates image format and size
   */
  async validateImage(inputBuffer: Buffer): Promise<{
    valid: boolean;
    error?: string;
    metadata?: sharp.Metadata;
  }> {
    try {
      const metadata = await sharp(inputBuffer).metadata();

      if (!metadata.width || !metadata.height) {
        return { valid: false, error: 'Invalid image dimensions' };
      }

      if (inputBuffer.length > this.config.maxFileSize) {
        return { 
          valid: false, 
          error: `File too large: ${Math.round(inputBuffer.length / 1024 / 1024)}MB (max: ${Math.round(this.config.maxFileSize / 1024 / 1024)}MB)` 
        };
      }

      const supportedFormats = ['jpeg', 'png', 'webp', 'gif', 'tiff'];
      if (!metadata.format || !supportedFormats.includes(metadata.format)) {
        return { valid: false, error: `Unsupported format: ${metadata.format}` };
      }

      return { valid: true, metadata };
    } catch (error) {
      return { 
        valid: false, 
        error: `Image validation failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Gets optimal format based on browser support
   */
  getOptimalFormat(acceptHeader?: string): 'webp' | 'jpeg' {
    if (acceptHeader && acceptHeader.includes('image/webp')) {
      return 'webp';
    }
    return 'jpeg';
  }

  /**
   * Calculates compression ratio
   */
  calculateCompressionRatio(originalSize: number, compressedSize: number): number {
    return Math.round(((originalSize - compressedSize) / originalSize) * 100);
  }

  /**
   * Gets processing statistics
   */
  async getProcessingStats(variants: ImageVariant[]): Promise<{
    totalVariants: number;
    totalSize: number;
    averageCompression: number;
    formatBreakdown: { [format: string]: number };
    sizeBreakdown: { [size: string]: number };
  }> {
    const totalSize = variants.reduce((sum, v) => sum + v.fileSize, 0);
    const formatBreakdown: { [format: string]: number } = {};
    const sizeBreakdown: { [size: string]: number } = {};

    variants.forEach(variant => {
      formatBreakdown[variant.format] = (formatBreakdown[variant.format] || 0) + 1;
      sizeBreakdown[variant.size] = (sizeBreakdown[variant.size] || 0) + 1;
    });

    return {
      totalVariants: variants.length,
      totalSize,
      averageCompression: 0, // Would need original size to calculate
      formatBreakdown,
      sizeBreakdown
    };
  }
}

// Singleton instance
let imageProcessingService: ImageProcessingService | null = null;

export function getImageProcessingService(): ImageProcessingService {
  if (!imageProcessingService) {
    imageProcessingService = new ImageProcessingService();
  }
  return imageProcessingService;
}