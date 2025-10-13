'use client';

import React, { useState, useEffect } from 'react';
import AvatarUpload from '@/components/AvatarUpload';
import AvatarDisplay from '@/components/AvatarDisplay';
import { cn } from '@/lib/utils';

interface AvatarSettings {
  enabled: boolean;
  visibility: 'matches_only' | 'premium_matches' | 'all_matches';
  expiryDays?: number;
  allowDownload: boolean;
  moderationStatus: 'pending' | 'approved' | 'rejected';
}

interface AvatarStats {
  totalViews: number;
  uniqueViewers: number;
  lastViewed?: string;
  uploadDate?: string;
  fileSize?: number;
  format?: string;
}

interface AvatarManagementPanelProps {
  userId: string;
  className?: string;
}

export function AvatarManagementPanel({ userId, className }: AvatarManagementPanelProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'settings' | 'stats' | 'privacy'>('upload');
  const [settings, setSettings] = useState<AvatarSettings>({
    enabled: true,
    visibility: 'matches_only',
    allowDownload: false,
    moderationStatus: 'pending'
  });
  const [stats, setStats] = useState<AvatarStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasAvatar, setHasAvatar] = useState(false);

  useEffect(() => {
    fetchAvatarInfo();
  }, [userId]);

  const fetchAvatarInfo = async () => {
    try {
      const response = await fetch(`/api/avatar/info`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSettings(data.settings || settings);
          setStats(data.stats || null);
          setHasAvatar(data.hasAvatar || false);
        }
      }
    } catch (error) {
      console.error('Failed to fetch avatar info:', error);
    }
  };

  const updateSettings = async (newSettings: Partial<AvatarSettings>) => {
    try {
      setLoading(true);
      const response = await fetch('/api/avatar/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });

      if (response.ok) {
        setSettings(prev => ({ ...prev, ...newSettings }));
      } else {
        throw new Error('Failed to update settings');
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteAvatar = async () => {
    if (!confirm('Are you sure you want to delete your avatar? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/avatar/settings', {
        method: 'DELETE'
      });

      if (response.ok) {
        setHasAvatar(false);
        setStats(null);
        await fetchAvatarInfo();
      } else {
        throw new Error('Failed to delete avatar');
      }
    } catch (error) {
      console.error('Failed to delete avatar:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'upload', label: 'Upload Avatar', icon: '📷' },
    { id: 'settings', label: 'Privacy Settings', icon: '🔒' },
    { id: 'stats', label: 'Statistics', icon: '📊' },
    { id: 'privacy', label: 'Privacy Guide', icon: '🛡️' }
  ];

  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-lg shadow', className)}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Avatar Management
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Manage your profile avatar and privacy settings
        </p>
      </div>

      {/* Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center space-x-2',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'upload' && (
          <UploadTab
            userId={userId}
            hasAvatar={hasAvatar}
            onUploadComplete={() => {
              setHasAvatar(true);
              fetchAvatarInfo();
            }}
            onDelete={deleteAvatar}
            loading={loading}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            settings={settings}
            onUpdateSettings={updateSettings}
            loading={loading}
            hasAvatar={hasAvatar}
          />
        )}

        {activeTab === 'stats' && (
          <StatsTab stats={stats} hasAvatar={hasAvatar} />
        )}

        {activeTab === 'privacy' && (
          <PrivacyTab />
        )}
      </div>
    </div>
  );
}

function UploadTab({ 
  userId, 
  hasAvatar, 
  onUploadComplete, 
  onDelete, 
  loading 
}: {
  userId: string;
  hasAvatar: boolean;
  onUploadComplete: () => void;
  onDelete: () => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Current Avatar */}
      {hasAvatar && (
        <div className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <AvatarDisplay key={`avatar-${userId}`} userId={userId} currentUserId={userId} size="lg" />
          <div className="flex-1">
            <h3 className="font-medium">Current Avatar</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your avatar is visible to matched users based on your privacy settings
            </p>
          </div>
          <button
            onClick={onDelete}
            disabled={loading}
            className="px-4 py-2 text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
          >
            Delete
          </button>
        </div>
      )}

      {/* Upload Interface */}
      <div>
        <h3 className="font-medium mb-4">
          {hasAvatar ? 'Update Avatar' : 'Upload Avatar'}
        </h3>
        <AvatarUpload
          onUploadComplete={onUploadComplete}
          onError={(error) => console.error('Upload error:', error)}
        />
      </div>

      {/* Upload Guidelines */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
          Avatar Guidelines
        </h4>
        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <li>• Use a clear, recent photo of yourself</li>
          <li>• Ensure good lighting and image quality</li>
          <li>• Avoid group photos or images with multiple people</li>
          <li>• Keep content appropriate and respectful</li>
          <li>• Maximum file size: 5MB</li>
          <li>• Supported formats: JPEG, PNG, WebP</li>
        </ul>
      </div>
    </div>
  );
}

function SettingsTab({ 
  settings, 
  onUpdateSettings, 
  loading, 
  hasAvatar 
}: {
  settings: AvatarSettings;
  onUpdateSettings: (settings: Partial<AvatarSettings>) => void;
  loading: boolean;
  hasAvatar: boolean;
}) {
  if (!hasAvatar) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          Upload an avatar first to configure privacy settings
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Avatar Visibility */}
      <div>
        <h3 className="font-medium mb-4">Avatar Visibility</h3>
        <div className="space-y-3">
          <label className="flex items-center">
            <input
              type="radio"
              name="visibility"
              value="matches_only"
              checked={settings.visibility === 'matches_only'}
              onChange={(e) => onUpdateSettings({ visibility: e.target.value as any })}
              disabled={loading}
              className="mr-3"
            />
            <div>
              <div className="font-medium">Matches Only</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Only users you've matched with can see your avatar
              </div>
            </div>
          </label>

          <label className="flex items-center">
            <input
              type="radio"
              name="visibility"
              value="premium_matches"
              checked={settings.visibility === 'premium_matches'}
              onChange={(e) => onUpdateSettings({ visibility: e.target.value as any })}
              disabled={loading}
              className="mr-3"
            />
            <div>
              <div className="font-medium">Premium Matches Only</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Only premium users you've matched with can see your avatar
              </div>
            </div>
          </label>

          <label className="flex items-center">
            <input
              type="radio"
              name="visibility"
              value="all_matches"
              checked={settings.visibility === 'all_matches'}
              onChange={(e) => onUpdateSettings({ visibility: e.target.value as any })}
              disabled={loading}
              className="mr-3"
            />
            <div>
              <div className="font-medium">All Matches</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                All matched users can see your avatar (less private)
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Avatar Status */}
      <div>
        <h3 className="font-medium mb-4">Avatar Status</h3>
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div>
            <div className="font-medium">Avatar Sharing</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {settings.enabled ? 'Your avatar is visible to matched users' : 'Your avatar is hidden'}
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => onUpdateSettings({ enabled: e.target.checked })}
              disabled={loading}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Additional Settings */}
      <div>
        <h3 className="font-medium mb-4">Additional Settings</h3>
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <div className="font-medium">Allow Download</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Allow matched users to download your avatar
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.allowDownload}
              onChange={(e) => onUpdateSettings({ allowDownload: e.target.checked })}
              disabled={loading}
              className="rounded"
            />
          </label>

          <div>
            <label className="block font-medium mb-2">
              Auto-expire after (days)
            </label>
            <select
              value={settings.expiryDays || ''}
              onChange={(e) => onUpdateSettings({ 
                expiryDays: e.target.value ? parseInt(e.target.value) : undefined 
              })}
              disabled={loading}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
            >
              <option value="">Never expire</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
            </select>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Automatically hide your avatar after the specified period
            </p>
          </div>
        </div>
      </div>

      {/* Moderation Status */}
      {settings.moderationStatus && (
        <div className={cn(
          'p-4 rounded-lg border',
          settings.moderationStatus === 'approved' && 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
          settings.moderationStatus === 'pending' && 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
          settings.moderationStatus === 'rejected' && 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        )}>
          <div className="font-medium">
            Moderation Status: {settings.moderationStatus.charAt(0).toUpperCase() + settings.moderationStatus.slice(1)}
          </div>
          <div className="text-sm mt-1">
            {settings.moderationStatus === 'approved' && 'Your avatar has been approved and is visible to matched users.'}
            {settings.moderationStatus === 'pending' && 'Your avatar is under review. It will be visible once approved.'}
            {settings.moderationStatus === 'rejected' && 'Your avatar was rejected. Please upload a new one following our guidelines.'}
          </div>
        </div>
      )}
    </div>
  );
}

function StatsTab({ stats, hasAvatar }: { stats: AvatarStats | null; hasAvatar: boolean }) {
  if (!hasAvatar || !stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          {!hasAvatar ? 'Upload an avatar to see statistics' : 'No statistics available yet'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {stats.totalViews}
          </div>
          <div className="text-sm text-blue-700 dark:text-blue-300">Total Views</div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {stats.uniqueViewers}
          </div>
          <div className="text-sm text-green-700 dark:text-green-300">Unique Viewers</div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {stats.fileSize ? `${(stats.fileSize / (1024 * 1024)).toFixed(1)}MB` : 'N/A'}
          </div>
          <div className="text-sm text-purple-700 dark:text-purple-300">File Size</div>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {stats.format || 'N/A'}
          </div>
          <div className="text-sm text-orange-700 dark:text-orange-300">Format</div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        <h3 className="font-medium mb-4">Timeline</h3>
        <div className="space-y-3">
          {stats.uploadDate && (
            <div className="flex justify-between">
              <span>Avatar Uploaded</span>
              <span className="text-gray-600 dark:text-gray-400">
                {new Date(stats.uploadDate).toLocaleDateString()}
              </span>
            </div>
          )}
          {stats.lastViewed && (
            <div className="flex justify-between">
              <span>Last Viewed</span>
              <span className="text-gray-600 dark:text-gray-400">
                {new Date(stats.lastViewed).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PrivacyTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium mb-4">How Avatar Privacy Works</h3>
        <div className="space-y-4 text-sm">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">🔒 Encryption</h4>
            <p className="text-blue-700 dark:text-blue-300">
              Your private avatar is encrypted using Seal Protocol and can only be decrypted by users you've matched with.
            </p>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">👥 Match-Based Access</h4>
            <p className="text-green-700 dark:text-green-300">
              Only users you've mutually matched with can see your real avatar. Others see a face-swapped version.
            </p>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-2">🎭 Face Swapping</h4>
            <p className="text-purple-700 dark:text-purple-300">
              A face-swapped version of your avatar is shown to non-matched users, protecting your identity while maintaining engagement.
            </p>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-orange-800 dark:text-orange-200 mb-2">⚡ Automatic Management</h4>
            <p className="text-orange-700 dark:text-orange-300">
              Avatar access is automatically granted when you match with someone and revoked if you unmatch or block them.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-4">Privacy Tips</h3>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li>• Start with "Matches Only" visibility for maximum privacy</li>
          <li>• Regularly review who has access to your avatar</li>
          <li>• Use the auto-expire feature for temporary sharing</li>
          <li>• Disable download if you don't want users to save your avatar</li>
          <li>• Report any inappropriate use of your avatar</li>
        </ul>
      </div>
    </div>
  );
}