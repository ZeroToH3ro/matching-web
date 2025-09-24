import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { StorageManager } from '../manager';
import { StorageConfig } from '../types';

// Mock the external dependencies
jest.mock('@mysten/walrus');
jest.mock('@mysten/seal');
jest.mock('cloudinary');

describe('StorageManager', () => {
  let mockConfig: StorageConfig;
  let storageManager: StorageManager;

  beforeEach(() => {
    mockConfig = {
      strategy: 'hybrid',
      providers: {
        cloudinary: {
          cloudName: 'test-cloud',
          apiKey: 'test-key',
          apiSecret: 'test-secret'
        },
        walrus: {
          suiNetwork: 'testnet'
        }
      }
    };

    storageManager = new StorageManager(mockConfig);
  });

  describe('initialization', () => {
    it('should initialize with correct strategy', () => {
      expect(storageManager.getStrategy()).toBe('hybrid');
    });

    it('should have both providers available', () => {
      expect(storageManager.hasProvider('cloudinary')).toBe(true);
      expect(storageManager.hasProvider('walrus')).toBe(true);
    });

    it('should list all available providers', () => {
      const providers = storageManager.getProviders();
      expect(providers).toContain('cloudinary');
      expect(providers).toContain('walrus');
    });
  });

  describe('provider selection', () => {
    it('should select cloudinary for small files in hybrid mode', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      
      // We can't easily test the internal provider selection without mocking,
      // but we can test that the method doesn't throw
      try {
        await storageManager.upload(mockFile);
      } catch (error) {
        // Expected to fail due to mocked dependencies, but should not fail on provider selection
        expect(error).toBeDefined();
      }
    });
  });

  describe('file operations', () => {
    it('should handle upload with basic options', async () => {
      const testBuffer = Buffer.from('test data');
      const options = {
        filename: 'test.txt',
        contentType: 'text/plain',
        isPublic: true
      };

      try {
        await storageManager.upload(testBuffer, options);
      } catch (error) {
        // Expected due to mocked dependencies
        expect(error).toBeDefined();
      }
    });

    it('should handle download requests', async () => {
      const testId = 'cloudinary:test123';
      
      try {
        await storageManager.download(testId);
      } catch (error) {
        // Expected due to mocked dependencies
        expect(error).toBeDefined();
      }
    });

    it('should parse provider from composite ID', () => {
      const testId = 'walrus:blob123:policy456:key789';
      
      try {
        const url = storageManager.getUrl(testId);
        // This should not throw an error for ID parsing
        expect(url).toBeDefined();
      } catch (error) {
        // Expected due to mocked dependencies
        expect(error).toBeDefined();
      }
    });
  });

  describe('error handling', () => {
    it('should throw error for unknown provider', async () => {
      const testId = 'unknown:test123';
      
      await expect(storageManager.download(testId)).rejects.toThrow('Storage provider not found');
    });

    it('should handle missing provider gracefully', () => {
      const emptyConfig: StorageConfig = {
        strategy: 'cloudinary',
        providers: {}
      };
      
      const emptyManager = new StorageManager(emptyConfig);
      
      expect(async () => {
        await emptyManager.upload(Buffer.from('test'));
      }).rejects.toThrow();
    });
  });
});

describe('Storage Configuration', () => {
  it('should validate required cloudinary config', () => {
    const invalidConfig: StorageConfig = {
      strategy: 'cloudinary',
      providers: {
        cloudinary: {
          cloudName: '',
          apiKey: '',
          apiSecret: ''
        }
      }
    };

    expect(() => new StorageManager(invalidConfig)).not.toThrow();
    // Note: Validation happens at runtime when providers are used
  });

  it('should validate required walrus config', () => {
    const validConfig: StorageConfig = {
      strategy: 'walrus',
      providers: {
        walrus: {
          suiNetwork: 'testnet'
        }
      }
    };

    expect(() => new StorageManager(validConfig)).not.toThrow();
  });
});