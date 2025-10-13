import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { AvatarManagementPanel } from '@/components/user/AvatarManagementPanel';
import { AvatarUsageReport } from '@/components/AvatarUsageReport';

export default async function ProfileAvatarPage() {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Page Header */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Avatar Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage your profile avatar, privacy settings, and view usage statistics
            </p>
          </div>

          {/* Avatar Management Panel */}
          <AvatarManagementPanel userId={session.user.id} />

          {/* Usage Report */}
          <AvatarUsageReport userId={session.user.id} />
        </div>
      </div>
    </div>
  );
}