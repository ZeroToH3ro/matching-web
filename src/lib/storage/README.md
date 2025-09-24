# Storage Library Documentation

This library provides a unified interface for managing file storage across multiple providers including traditional cloud storage (Cloudinary) and decentralized storage (Walrus Protocol) with optional access control (Seal Protocol).

## Overview

The storage system supports three strategies:
- **`cloudinary`**: Traditional cloud storage only
- **`walrus`**: Decentralized storage only
- **`hybrid`**: Automatic fallback from Walrus to Cloudinary

## Quick Start

```typescript
import { uploadFile, downloadFile, deleteFile, getFileUrl } from '@/lib/storage';

// Upload a file
const result = await uploadFile(file, {
  filename: 'avatar.jpg',
  contentType: 'image/jpeg',
  isPublic: true,
  maxSize: 5 * 1024 * 1024 // 5MB
});

// Get file URL
const url = getFileUrl(result.id);

// Download file
const download = await downloadFile(result.id);

// Delete file
await deleteFile(result.id);
```

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Storage strategy: cloudinary | walrus | hybrid
STORAGE_STRATEGY="hybrid"

# Cloudinary (required for cloudinary/hybrid strategies)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="your-cloud-name"
NEXT_PUBLIC_CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# Sui Blockchain (required for walrus/hybrid strategies)
SUI_NETWORK="testnet"
SUI_PRIVATE_KEY="your-sui-private-key"

# Walrus Protocol (optional - uses default testnet URLs if not provided)
WALRUS_PUBLISHER_URLS="https://custom-publisher1.com,https://custom-publisher2.com"
WALRUS_AGGREGATOR_URLS="https://custom-aggregator1.com,https://custom-aggregator2.com"

# Seal Protocol (optional - for access control)
SEAL_ENABLED="false"
SEAL_PACKAGE_ID="your-seal-package-id"
SEAL_SERVER_OBJECT_IDS="server-object-id-1,server-object-id-2"
```

### Default Configuration

The system comes pre-configured with real Walrus testnet endpoints:

**Publisher URLs:**
- `https://publisher.walrus-testnet.walrus.space`
- `https://wal-publisher-testnet.staketab.org`
- `https://walrus-testnet-publisher.redundex.com`
- `https://walrus-testnet-publisher.nodes.guru`
- `https://publisher.walrus.banansen.dev`
- `https://walrus-testnet-publisher.everstake.one`

**Aggregator URLs:**
- `https://aggregator.walrus-testnet.walrus.space`
- `https://wal-aggregator-testnet.staketab.org`
- `https://walrus-testnet-aggregator.redundex.com`
- `https://walrus-testnet-aggregator.nodes.guru`
- `https://aggregator.walrus.banansen.dev`
- `https://walrus-testnet-aggregator.everstake.one`

## API Reference

### Core Functions

#### `uploadFile(file, options?)`

Uploads a file using the configured storage strategy.

**Parameters:**
- `file: File | Buffer` - The file to upload
- `options?: UploadOptions` - Upload configuration

**Options:**
```typescript
interface UploadOptions {
  filename?: string;           // Custom filename
  contentType?: string;        // MIME type
  isPublic?: boolean;         // Public access (default: true)
  maxSize?: number;           // Max file size in bytes
  encrypt?: boolean;          // Enable Seal encryption
  accessPolicy?: AccessPolicy; // Access control rules
}
```

**Returns:**
```typescript
interface UploadResult {
  id: string;                 // Unique file identifier
  url: string;               // Direct access URL
  size: number;              // File size in bytes
  contentType: string;       // MIME type
  provider: string;          // Provider used ('cloudinary' | 'walrus')
  metadata?: Record<string, any>; // Provider-specific metadata
}
```

#### `downloadFile(id, options?)`

Downloads a file by its ID.

**Parameters:**
- `id: string` - File identifier from upload result
- `options?: DownloadOptions` - Download configuration

**Options:**
```typescript
interface DownloadOptions {
  decrypt?: boolean; // Decrypt if encrypted with Seal
}
```

**Returns:**
```typescript
interface DownloadResult {
  data: Buffer;              // File content
  contentType: string;       // MIME type
  size: number;             // File size
  metadata?: Record<string, any>; // Additional metadata
}
```

#### `deleteFile(id)`

Deletes a file by its ID.

**Parameters:**
- `id: string` - File identifier

**Note:** Walrus files are immutable and cannot be deleted. They will expire after their storage period.

#### `getFileUrl(id)`

Gets the direct access URL for a file.

**Parameters:**
- `id: string` - File identifier

**Returns:** `string` - Direct access URL

### Advanced Usage

#### Custom Storage Manager

```typescript
import { createStorageManager, StorageConfig } from '@/lib/storage';

const config: StorageConfig = {
  strategy: 'walrus',
  providers: {
    walrus: {
      suiNetwork: 'testnet',
      privateKey: 'your-private-key',
      publisherUrls: ['https://custom-publisher.com'],
      aggregatorUrls: ['https://custom-aggregator.com']
    }
  }
};

const manager = createStorageManager(config);
const result = await manager.upload(file);
```

#### Access Control with Seal

```typescript
import { uploadFile } from '@/lib/storage';

const accessPolicy = {
  rules: [
    {
      type: 'wallet',
      value: '0x1234567890abcdef',
      operation: 'allow'
    },
    {
      type: 'subscription',
      value: 'premium',
      operation: 'allow'
    }
  ],
  threshold: 1 // At least 1 rule must be satisfied
};

const result = await uploadFile(file, {
  encrypt: true,
  accessPolicy
});
```

## Storage Strategies

### Cloudinary Strategy

Uses traditional cloud storage with CDN delivery.

**Benefits:**
- Fast global CDN
- Image transformations
- Reliable infrastructure
- Immediate availability

**Use cases:**
- Public images
- Frequently accessed files
- When you need image transformations

### Walrus Strategy

Uses decentralized blob storage on the Sui blockchain.

**Benefits:**
- Decentralized and censorship-resistant
- Cost-effective for large files
- Immutable storage
- No vendor lock-in

**Use cases:**
- Large media files
- Archival storage
- Decentralized applications
- Cost-sensitive applications

**Limitations:**
- Files cannot be deleted (immutable)
- Potential latency for first access
- Requires Sui network connectivity

### Hybrid Strategy

Attempts Walrus first, falls back to Cloudinary on failure.

**Benefits:**
- Best of both worlds
- Automatic failover
- Cost optimization
- Reliability

**Use cases:**
- Production applications
- When you want decentralization but need reliability
- Mixed file types (small images → Cloudinary, large files → Walrus)

## Error Handling

The library includes comprehensive error handling:

```typescript
import {
  StorageError,
  AccessDeniedError,
  ProviderError
} from '@/lib/storage';

try {
  await uploadFile(file);
} catch (error) {
  if (error instanceof AccessDeniedError) {
    // Handle access denied
  } else if (error instanceof ProviderError) {
    // Handle provider-specific error
    console.log('Provider:', error.provider);
  } else if (error instanceof StorageError) {
    // Handle general storage error
  }
}
```

## Testing

The library includes comprehensive test coverage with mocked providers:

```bash
npm test -- src/lib/storage
```

Test files are located in:
- `src/lib/storage/__tests__/`
- `src/lib/__mocks__/@mysten/` (SDK mocks)

## Architecture

```
src/lib/storage/
├── index.ts              # Main exports and convenience functions
├── manager.ts            # StorageManager orchestrates providers
├── types.ts              # TypeScript interfaces
├── providers/
│   ├── cloudinary.ts     # Cloudinary implementation
│   ├── walrus.ts         # Walrus Protocol implementation
│   └── seal.ts           # Seal Protocol access control
└── __tests__/            # Test files
```

## Best Practices

### File Size Considerations

- **Cloudinary**: Best for files < 10MB
- **Walrus**: Cost-effective for files > 1MB
- **Hybrid**: Automatically optimizes based on size and availability

### Security

- Never expose private keys in client-side code
- Use environment variables for sensitive configuration
- Implement proper access controls with Seal when needed
- Validate file types and sizes before upload

### Performance

- Use appropriate content types for better caching
- Consider file compression for large uploads
- Implement client-side validation to reduce server load
- Cache file URLs when possible

### Monitoring

```typescript
import { getStorageManager } from '@/lib/storage';

const manager = getStorageManager();
// Monitor which provider is being used
console.log('Active strategy:', manager.config.strategy);
```

## Troubleshooting

### Common Issues

1. **"SUI_PRIVATE_KEY not set"**
   - Add your Sui private key to environment variables
   - Generate one using: `sui client new-address`

2. **"Failed to upload to Walrus"**
   - Check network connectivity to Walrus endpoints
   - Verify Sui network is accessible
   - Try hybrid strategy for automatic fallback

3. **"Cloudinary credentials invalid"**
   - Verify your Cloudinary configuration
   - Check API key and secret are correct

4. **"Seal encryption failed"**
   - Ensure SEAL_ENABLED=true and required configs are set
   - Verify server object IDs are valid

### Debug Mode

Enable debug logging by setting:

```bash
DEBUG=storage:*
```

## Migration Guide

### From Direct Cloudinary

```typescript
// Old
import { v2 as cloudinary } from 'cloudinary';
const result = await cloudinary.uploader.upload(file);

// New
import { uploadFile } from '@/lib/storage';
const result = await uploadFile(file);
```

### From Custom Storage

Replace your existing storage calls with the unified interface while maintaining the same functionality.

## Roadmap

- [ ] IPFS provider support
- [ ] Arweave integration
- [ ] Advanced caching strategies
- [ ] File deduplication
- [ ] Automatic provider health checks
- [ ] Real-time upload progress
- [ ] Batch upload operations