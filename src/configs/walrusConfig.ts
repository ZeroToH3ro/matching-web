import type { WalrusClientConfig } from '@mysten/walrus'

export const walrusConfig: Pick<
  WalrusClientConfig,
  'uploadRelay' | 'storageNodeClientOptions' | 'wasmUrl'
> = {
  uploadRelay: {
    timeout: 600_000,
    host: 'https://upload-relay.testnet.walrus.space',
    sendTip: {
      max: 1_000
    }
  }
}
