import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { AvatarModerationDashboard } from '@/components/admin/AvatarModerationDashboard';

export default async function AdminAvatarsPage() {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  // Check if user has admin role (you may want to implement proper role checking)
  // For now, we'll assume the check is done in the component
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AvatarModerationDashboard />
      </div>
    </div>
  );
}