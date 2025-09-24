// Mock implementation of @mysten/walrus for testing

class MockWalrusClient {
  constructor(config) {
    this.config = config;
    this.suiClient = config.suiClient;
    this.network = config.network || 'testnet';
  }

  async store(data, options = {}) {
    const mockBlobId = 'mock-blob-' + Math.random().toString(36).substring(7);
    return {
      newlyCreated: {
        blobObject: {
          blobId: mockBlobId,
          id: 'mock-object-id',
          storage: {
            endEpoch: options.epochs || 5,
            size: data.length
          }
        }
      },
      blobId: mockBlobId
    };
  }

  async read(blobId) {
    const mockData = new Uint8Array([116, 101, 115, 116]); // 'test' in bytes
    return {
      ok: true,
      arrayBuffer: async () => mockData.buffer,
      headers: {
        get: (key) => key === 'content-type' ? 'application/octet-stream' : null
      },
      statusText: 'OK'
    };
  }

  async getBlobInfo(blobId) {
    return {
      blobId,
      size: 1024,
      endEpoch: 10
    };
  }

  async getStorageNodes() {
    return [
      { id: 'node1', url: 'https://node1.walrus.test' },
      { id: 'node2', url: 'https://node2.walrus.test' }
    ];
  }
}

module.exports = {
  WalrusClient: MockWalrusClient
};