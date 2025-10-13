'use client';

import React, { useState, useEffect } from 'react';
// Temporarily disabled admin features
// import { useAvatarAnalytics } from '@/hooks/useAvatarAnalytics';
// import { AvatarAnalyticsDashboard } from '@/components/AvatarAnalyticsDashboard';
import { cn } from '@/lib/utils';

interface ModerationItem {
  id: string;
  userId: string;
  userName: string;
  avatarUrl: string;
  uploadedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reportCount: number;
  flaggedReason?: string;
  moderatedBy?: string;
  moderatedAt?: string;
}

interface AvatarModerationDashboardProps {
  className?: string;
}

export function AvatarModerationDashboard({ className }: AvatarModerationDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'moderation' | 'reports' | 'analytics'>('overview');
  const [moderationQueue, setModerationQueue] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch moderation queue
  useEffect(() => {
    fetchModerationQueue();
  }, []);

  const fetchModerationQueue = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/avatar/moderation');
      if (response.ok) {
        const data = await response.json();
        setModerationQueue(data.items || []);
      } else {
        throw new Error('Failed to fetch moderation queue');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleModeration = async (itemId: string, action: 'approve' | 'reject', reason?: string) => {
    try {
      const response = await fetch(`/api/admin/avatar/moderation/${itemId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason })
      });

      if (response.ok) {
        await fetchModerationQueue(); // Refresh the queue
      } else {
        throw new Error('Moderation action failed');
      }
    } catch (err) {
      console.error('Moderation error:', err);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', count: null },
    { id: 'moderation', label: 'Moderation Queue', count: moderationQueue.filter(item => item.status === 'pending').length },
    { id: 'reports', label: 'Reports', count: moderationQueue.filter(item => item.reportCount > 0).length },
    { id: 'analytics', label: 'Analytics', count: null }
  ];

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Avatar Management Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor, moderate, and manage avatar content across the platform
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                )}
              >
                {tab.label}
                {tab.count !== null && tab.count > 0 && (
                  <span className="ml-2 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-xs font-medium px-2.5 py-0.5 rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <OverviewTab moderationQueue={moderationQueue} />
          )}

          {activeTab === 'moderation' && (
            <ModerationTab
              items={moderationQueue.filter(item => item.status === 'pending')}
              onModerate={handleModeration}
              loading={loading}
              error={error}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsTab
              items={moderationQueue.filter(item => item.reportCount > 0)}
              onModerate={handleModeration}
            />
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* <AvatarAnalyticsDashboard /> */}
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">Analytics feature temporarily disabled</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ moderationQueue }: { moderationQueue: ModerationItem[] }) {
  const pendingCount = moderationQueue.filter(item => item.status === 'pending').length;
  const reportedCount = moderationQueue.filter(item => item.reportCount > 0).length;
  const approvedCount = moderationQueue.filter(item => item.status === 'approved').length;
  const rejectedCount = moderationQueue.filter(item => item.status === 'rejected').length;

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pending Review"
          value={pendingCount}
          subtitle="Awaiting moderation"
          color="yellow"
          urgent={pendingCount > 10}
        />
        <StatCard
          title="Reported Content"
          value={reportedCount}
          subtitle="User reports"
          color="red"
          urgent={reportedCount > 5}
        />
        <StatCard
          title="Approved Today"
          value={approvedCount}
          subtitle="Content approved"
          color="green"
        />
        <StatCard
          title="Rejected Today"
          value={rejectedCount}
          subtitle="Content rejected"
          color="red"
        />
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Moderation Activity</h3>
        <div className="space-y-3">
          {moderationQueue
            .filter(item => item.moderatedAt)
            .sort((a, b) => new Date(b.moderatedAt!).getTime() - new Date(a.moderatedAt!).getTime())
            .slice(0, 5)
            .map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                <div className="flex items-center space-x-3">
                  <img
                    src={item.avatarUrl}
                    alt="Avatar"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-sm font-medium">{item.userName}</p>
                    <p className="text-xs text-gray-500">
                      {item.status === 'approved' ? 'Approved' : 'Rejected'} by {item.moderatedBy}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(item.moderatedAt!).toLocaleTimeString()}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function ModerationTab({ 
  items, 
  onModerate, 
  loading, 
  error 
}: { 
  items: ModerationItem[];
  onModerate: (id: string, action: 'approve' | 'reject', reason?: string) => void;
  loading: boolean;
  error: string | null;
}) {
  const [selectedItem, setSelectedItem] = useState<ModerationItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">No items pending moderation</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
          <div className="flex items-start space-x-4">
            <img
              src={item.avatarUrl}
              alt="Avatar for review"
              className="w-20 h-20 rounded-lg object-cover"
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">{item.userName}</h4>
                  <p className="text-sm text-gray-500">
                    Uploaded {new Date(item.uploadedAt).toLocaleString()}
                  </p>
                  {item.reportCount > 0 && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {item.reportCount} report(s)
                    </p>
                  )}
                  {item.flaggedReason && (
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      Flagged: {item.flaggedReason}
                    </p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => onModerate(item.id, 'approve')}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setSelectedItem(item)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Reject Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Reject Avatar</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Please provide a reason for rejecting this avatar:
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
              rows={3}
              placeholder="Reason for rejection..."
            />
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => {
                  setSelectedItem(null);
                  setRejectReason('');
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onModerate(selectedItem.id, 'reject', rejectReason);
                  setSelectedItem(null);
                  setRejectReason('');
                }}
                disabled={!rejectReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportsTab({ 
  items, 
  onModerate 
}: { 
  items: ModerationItem[];
  onModerate: (id: string, action: 'approve' | 'reject', reason?: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">No reported content</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="flex items-start space-x-4">
            <img
              src={item.avatarUrl}
              alt="Reported avatar"
              className="w-20 h-20 rounded-lg object-cover"
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-red-800 dark:text-red-200">{item.userName}</h4>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {item.reportCount} report(s) • Uploaded {new Date(item.uploadedAt).toLocaleString()}
                  </p>
                  {item.flaggedReason && (
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      Auto-flagged: {item.flaggedReason}
                    </p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => onModerate(item.id, 'approve')}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  >
                    Keep
                  </button>
                  <button
                    onClick={() => onModerate(item.id, 'reject', 'Reported by users')}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  color: 'green' | 'red' | 'yellow' | 'blue';
  urgent?: boolean;
}

function StatCard({ title, value, subtitle, color, urgent }: StatCardProps) {
  const colorClasses = {
    green: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    red: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
    yellow: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
    blue: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
  };

  return (
    <div className={cn(
      'rounded-lg p-6 relative',
      colorClasses[color],
      urgent && 'ring-2 ring-red-500 ring-opacity-50'
    )}>
      {urgent && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm opacity-75">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}