'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export interface MarkProfileCompleteInput {
  profileObjectId: string
  sealPolicyId?: string
  sealKeyId?: string
}

export type MarkProfileCompleteResult =
  | { status: 'success'; profileObjectId: string }
  | { status: 'error'; error: string }

export async function markProfileCompleteOnChain(
  params: MarkProfileCompleteInput
): Promise<MarkProfileCompleteResult> {
  const session = await auth()

  if (!session?.user?.id) {
    return { status: 'error', error: 'User session not found' }
  }

  if (!params.profileObjectId) {
    return { status: 'error', error: 'Missing profile object id' }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      profileComplete: true,
    },
  })

  return {
    status: 'success',
    profileObjectId: params.profileObjectId,
  }
}
