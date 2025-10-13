'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface FeatureFlag {
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
  userSegments: string[];
  conditions: any[];
  metadata: {
    description: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
  };
}

interface RolloutConfig {
  strategy: 'percentage' | 'user_segments' | 'conditional' | 'hybrid';
  percentage: number;
  segments: string[];
  conditions: any[];
  enabledUsers: string[];
  disabledUsers: string[];
}

interface FeatureFlagDashboardProps {
  className?: string;
}

export function FeatureFlagDashboard({ className }: FeatureFlagDashboardProps) {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [showRolloutModal, setShowRolloutModal] = useState(false);

  useEffect(() => {
    fetchFlags();
  }, []);

  const fetchFlags = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/feature-flags');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch flags: ${response.status}`);
      }

      const data = await response.json();
      setFlags(data.flags || []);
      setStatistics(data.statistics || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const toggleFlag = async (flagKey: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagKey, enabled })
      });

      if (!response.ok) {
        throw new Error('Failed to update flag');
      }

      await fetchFlags(); // Refresh flags
    } catch (err) {
      console.error('Failed to toggle flag:', err);
    }
  };

  const updateRollout = async (flagKey: string, config: RolloutConfig) => {
    try {
      const response = await fetch(`/api/admin/feature-flags/${flagKey}/rollout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        throw new Error('Failed to update rollout');
      }

      await fetchFlags(); // Refresh flags
      setShowRolloutModal(false);
      setSelectedFlag(null);
    } catch (err) {
      console.error('Failed to update rollout:', err);
    }
  };

  if (loading) {
    return (
      <div className={cn('p-6 bg-white dark:bg-gray-800 rounded-lg shadow', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-6 bg-white dark:bg-gray-800 rounded-lg shadow', className)}>
        <div className="text-center text-red-600 dark:text-red-400">
          <p className="text-lg font-semibold mb-2">Error Loading Feature Flags</p>
          <p className="text-sm mb-4">{error}</p>
          <button
            onClick={fetchFlags}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Feature Flag Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Control feature rollouts and manage user access
            </p>
          </div>
          <button
            onClick={fetchFlags}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Statistics */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {statistics.totalFlags}
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">Total Flags</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {statistics.enabledFlags}
              </div>
              <div className="text-sm text-green-700 dark:text-green-300">Enabled Flags</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {statistics.flagsWithRollout}
              </div>
              <div className="text-sm text-purple-700 dark:text-purple-300">With Rollout</div>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {statistics.cacheSize}
              </div>
              <div className="text-sm text-orange-700 dark:text-orange-300">Cached Users</div>
            </div>
          </div>
        )}
      </div>

      {/* Feature Flags List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">Feature Flags</h2>
        </div>
        
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {flags.map((flag) => (
            <div key={flag.key} className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      {flag.key}
                    </h3>
                    <span className={cn(
                      'px-2 py-1 text-xs font-medium rounded-full',
                      flag.enabled
                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                        : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                    )}>
                      {flag.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    {flag.rolloutPercentage < 100 && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                        {flag.rolloutPercentage}% Rollout
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {flag.metadata.description}
                  </p>
                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>Updated: {new Date(flag.metadata.updatedAt).toLocaleDateString()}</span>
                    <span>By: {flag.metadata.createdBy}</span>
                    {flag.userSegments.length > 0 && (
                      <span>Segments: {flag.userSegments.join(', ')}</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      setSelectedFlag(flag);
                      setShowRolloutModal(true);
                    }}
                    className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Configure Rollout
                  </button>
                  
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={flag.enabled}
                      onChange={(e) => toggleFlag(flag.key, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rollout Configuration Modal */}
      {showRolloutModal && selectedFlag && (
        <RolloutConfigModal
          flag={selectedFlag}
          onSave={(config) => updateRollout(selectedFlag.key, config)}
          onClose={() => {
            setShowRolloutModal(false);
            setSelectedFlag(null);
          }}
        />
      )}
    </div>
  );
}

interface RolloutConfigModalProps {
  flag: FeatureFlag;
  onSave: (config: RolloutConfig) => void;
  onClose: () => void;
}

function RolloutConfigModal({ flag, onSave, onClose }: RolloutConfigModalProps) {
  const [config, setConfig] = useState<RolloutConfig>({
    strategy: 'percentage',
    percentage: flag.rolloutPercentage,
    segments: flag.userSegments,
    conditions: flag.conditions,
    enabledUsers: [],
    disabledUsers: []
  });

  const handleSave = () => {
    onSave(config);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Configure Rollout: {flag.key}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            ×
          </button>
        </div>

        <div className="space-y-6">
          {/* Strategy Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Rollout Strategy</label>
            <select
              value={config.strategy}
              onChange={(e) => setConfig(prev => ({ ...prev, strategy: e.target.value as any }))}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
            >
              <option value="percentage">Percentage-based</option>
              <option value="user_segments">User Segments</option>
              <option value="conditional">Conditional</option>
              <option value="hybrid">Hybrid (All conditions)</option>
            </select>
          </div>

          {/* Percentage Configuration */}
          {(config.strategy === 'percentage' || config.strategy === 'hybrid') && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Rollout Percentage: {config.percentage}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={config.percentage}
                onChange={(e) => setConfig(prev => ({ ...prev, percentage: parseInt(e.target.value) }))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          )}

          {/* User Segments */}
          {(config.strategy === 'user_segments' || config.strategy === 'hybrid') && (
            <div>
              <label className="block text-sm font-medium mb-2">User Segments</label>
              <div className="space-y-2">
                {['all', 'admin', 'premium', 'beta', 'new_user', 'standard'].map(segment => (
                  <label key={segment} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.segments.includes(segment)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setConfig(prev => ({ ...prev, segments: [...prev.segments, segment] }));
                        } else {
                          setConfig(prev => ({ ...prev, segments: prev.segments.filter(s => s !== segment) }));
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="capitalize">{segment.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Explicit User Lists */}
          <div>
            <label className="block text-sm font-medium mb-2">Enabled Users (comma-separated)</label>
            <textarea
              value={config.enabledUsers.join(', ')}
              onChange={(e) => setConfig(prev => ({ 
                ...prev, 
                enabledUsers: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              }))}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
              rows={2}
              placeholder="user1, user2, user3..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Disabled Users (comma-separated)</label>
            <textarea
              value={config.disabledUsers.join(', ')}
              onChange={(e) => setConfig(prev => ({ 
                ...prev, 
                disabledUsers: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              }))}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
              rows={2}
              placeholder="user1, user2, user3..."
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}