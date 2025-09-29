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
        // Provide the client IDs for each of the auth providers you want to use:
        google: { clientId: googleClientId,redirectUrl: redirectUrl },
        // facebook: { clientId: clientConfig.FACEBOOK_CLIENT_ID },
        // twitch: { clientId: clientConfig.TWITCH_CLIENT_ID }
      },
      client,
      network,
    })

    return unregister
  }, [client, network])

  return null
}
