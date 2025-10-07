import { auth } from "@/auth";
import { getUserInfoForNav } from "@/app/actions/userActions";
import TopNavGlass from "./TopNavGlass";

export default async function TopNavGlassWrapper() {
  const session = await auth();
  const userInfo = session?.user ? await getUserInfoForNav() : null;

  return (
    <TopNavGlass
      initialUserInfo={userInfo || null}
      initialRole={session?.user?.role || null}
    />
  );
}
