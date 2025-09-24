// Mock implementation of @mysten/sui/client for testing

// Mock getFullnodeUrl function
export function getFullnodeUrl(network) {
  const urls = {
    mainnet: 'https://fullnode.mainnet.sui.io:443',
    testnet: 'https://fullnode.testnet.sui.io:443',
    devnet: 'https://fullnode.devnet.sui.io:443'
  };
  return urls[network] || urls.testnet;
}

// Mock SuiClient class
export class SuiClient {
  constructor(config) {
    this.config = config;
  }

  async getLatestSuiSystemState() {
    return {
      epoch: '123',
      protocolVersion: '1',
      referenceGasPrice: '1000'
    };
  }

  async getBalance({ owner, coinType }) {
    return {
      coinType: coinType || '0x2::sui::SUI',
      coinObjectCount: 1,
      totalBalance: '1000000000',
      lockedBalance: {}
    };
  }

  async getObject({ id, options }) {
    return {
      data: {
        objectId: id,
        version: '1',
        digest: 'mock-digest',
        type: 'mock-type',
        owner: { AddressOwner: 'mock-owner' },
        previousTransaction: 'mock-tx'
      }
    };
  }

  async executeTransactionBlock({ transactionBlock, signer, options }) {
    return {
      digest: 'mock-tx-digest',
      effects: {
        status: { status: 'success' },
        gasUsed: { computationCost: '1000', storageCost: '500', storageRebate: '0' }
      }
    };
  }
}