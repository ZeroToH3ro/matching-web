// Mock implementation of @mysten/seal for testing

class MockSealClient {
  constructor(config) {
    this.config = config;
  }

  async generateKey({ policyId, metadata }) {
    const mockKeyId = 'mock-key-' + Math.random().toString(36).substring(7);
    return {
      keyId: mockKeyId
    };
  }

  async encrypt(data, { keyId }) {
    // Simple mock encryption - just return the data with a prefix
    const prefix = new Uint8Array([69, 78, 67]); // 'ENC' prefix
    const result = new Uint8Array(prefix.length + data.length);
    result.set(prefix);
    result.set(data, prefix.length);
    return result;
  }

  async decrypt(encryptedData, { keyId, requesterAddress }) {
    // Simple mock decryption - just remove the prefix
    const prefix = new Uint8Array([69, 78, 67]); // 'ENC' prefix
    if (encryptedData.length > prefix.length) {
      return encryptedData.slice(prefix.length);
    }
    return encryptedData;
  }

  async createPolicy({ rules, threshold }) {
    const mockPolicyId = 'mock-policy-' + Math.random().toString(36).substring(7);
    return {
      policyId: mockPolicyId,
      transactionDigest: 'mock-tx-' + Math.random().toString(36).substring(7)
    };
  }

  async verifyAccess({ keyId, requesterAddress }) {
    // Mock verification - allow access by default
    return {
      hasAccess: true
    };
  }

  async getPolicyInfo(policyId) {
    return {
      policyId,
      rules: [],
      threshold: 1,
      created: Date.now()
    };
  }

  async updatePolicy({ policyId, rules, threshold }) {
    return {
      policyId,
      transactionDigest: 'mock-update-tx-' + Math.random().toString(36).substring(7)
    };
  }

  async revokeAccess({ policyId, userAddress }) {
    return {
      success: true,
      transactionDigest: 'mock-revoke-tx-' + Math.random().toString(36).substring(7)
    };
  }
}

module.exports = {
  SealClient: MockSealClient
};