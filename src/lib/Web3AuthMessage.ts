export class Web3AuthMessage {
  constructor(
    public appName: string,
    public walletAddress: string,
    public nonce: string
  ) {}

  toString() {
    return `Sign this message to authenticate with ${this.appName}.

This request will NOT trigger any blockchain transaction or cost any gas.

Session: "${this.nonce}"
Wallet address: "${this.walletAddress}"
`
  }

  static fromString(s: string) {
    const { x: appName } =
      s.match(/authenticate with (?<x>.+?)\./)?.groups ?? {}
    const { x: nonce } = s.match(/Session: "(?<x>.+?)"/)?.groups ?? {}
    const { x: walletAddress } =
      s.match(/Wallet address: "(?<x>.+?)"/)?.groups ?? {}
    if (!appName || !nonce || !walletAddress)
      throw new Error('Invalid message format')

    return new Web3AuthMessage(appName, walletAddress, nonce)
  }
}
