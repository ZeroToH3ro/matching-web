import { auth } from '@/auth'
import { getUserInfoForNav } from '@/app/actions/userActions'
import TopNavClient from './TopNavClient'

export default async function TopNav() {
  const session = await auth()
  const userInfo = session?.user ? await getUserInfoForNav() : null

  return (
    <TopNavClient
      initialUserInfo={userInfo || null}
      initialRole={session?.user?.role || null}
    />
  )
}
