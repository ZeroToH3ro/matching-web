import { useSuiClientContext } from '@mysten/dapp-kit'
import { isEnokiNetwork, registerEnokiWallets } from '@mysten/enoki'
import { useEffect } from 'react'

interface Props {
  googleClientId: string
  enokiApiKey: string
  redirectUrl: string
}

export function RegisterEnokiWallets({ googleClientId, enokiApiKey,redirectUrl }: Props) {
  const { client, network } = useSuiClientContext()

  useEffect(() => {
    if (!isEnokiNetwork(network)) return

    const { unregister } = registerEnokiWallets({
      apiKey: enokiApiKey,
      providers: {
        google: { clientId: googleClientId,redirectUrl: redirectUrl },
      },
      client,
      network,
    })

    return unregister
  }, [client, network])

  return null
}
