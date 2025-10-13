'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface FeatureFlagHookResult {
  isEnabled: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface FeatureFlagConfig {
  flagKey: string;
  defaultValue?: boolean;
  refreshInterval?: number; // milliseconds
  userId?: string;
}

export function useFeatureFlag(config: FeatureFlagConfig): FeatureFlagHookResult {
  const { user, loading: userLoading, error: userError } = useCurrentUser();
  const [isEnabled, setIsEnabled] = useState(config.defaultValue ?? false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Destructure config to avoid dependency issues
  const { flagKey, defaultValue, refreshInterval, userId: configUserId } = config;
  const userId = configUserId || user?.id;

  // If there's a user context error, fall back to default values
  if (userError && !configUserId) {
    return {
      isEnabled: defaultValue ?? false,
      loading: false,
      error: null,
      refresh: async () => {}
    };
  }

  const checkFeatureFlag = useCallback(async () => {
    if (!userId) {
      setIsEnabled(defaultValue ?? false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/feature-flags/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flagKey,
          userId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to check feature flag: ${response.status}`);
      }

      const data = await response.json();
      setIsEnabled(data.enabled ?? defaultValue ?? false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setIsEnabled(defaultValue ?? false);
      console.error(`Feature flag check failed for ${flagKey}:`, err);
    } finally {
      setLoading(false);
    }
  }, [flagKey, defaultValue, userId]);

  // Initial check
  useEffect(() => {
    checkFeatureFlag();
  }, [checkFeatureFlag]);

  // Refresh interval
  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(checkFeatureFlag, refreshInterval);
    return () => clearInterval(interval);
  }, [checkFeatureFlag, refreshInterval]);

  return {
    isEnabled,
    loading,
    error,
    refresh: checkFeatureFlag
  };
}

// Hook for checking multiple feature flags
export function useFeatureFlags(
  flagKeys: string[], 
  defaultValues?: boolean[], 
  userId?: string
): {
  flags: { [key: string]: boolean };
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const { user, loading: userLoading, error: userError } = useCurrentUser();
  const [flags, setFlags] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentUserId = userId || user?.id;

  // If there's a user context error and no explicit userId, return defaults
  if (userError && !userId) {
    const defaultFlags: { [key: string]: boolean } = {};
    flagKeys.forEach((key, index) => {
      defaultFlags[key] = defaultValues?.[index] ?? false;
    });
    
    return {
      flags: defaultFlags,
      loading: false,
      error: null,
      refresh: async () => {}
    };
  }

  // Stabilize arrays to prevent infinite loops
  const stableFlagKeys = useMemo(() => flagKeys, [flagKeys.join(',')]);
  const stableDefaultValues = useMemo(() => defaultValues, [defaultValues?.join(',')]);

  const checkFeatureFlags = useCallback(async () => {
    if (!currentUserId) {
      const defaultFlags: { [key: string]: boolean } = {};
      stableFlagKeys.forEach((key, index) => {
        defaultFlags[key] = stableDefaultValues?.[index] ?? false;
      });
      setFlags(defaultFlags);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/feature-flags/check-multiple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flagKeys: stableFlagKeys,
          userId: currentUserId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to check feature flags: ${response.status}`);
      }

      const data = await response.json();
      setFlags(data.flags || {});
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      
      // Set default values on error
      const defaultFlags: { [key: string]: boolean } = {};
      stableFlagKeys.forEach((key, index) => {
        defaultFlags[key] = stableDefaultValues?.[index] ?? false;
      });
      setFlags(defaultFlags);
      
      console.error('Feature flags check failed:', err);
    } finally {
      setLoading(false);
    }
  }, [stableFlagKeys, stableDefaultValues, currentUserId]);

  useEffect(() => {
    checkFeatureFlags();
  }, [checkFeatureFlags]);

  return {
    flags,
    loading,
    error,
    refresh: checkFeatureFlags
  };
}

// Hook for avatar-specific feature flags
export function useAvatarFeatureFlags(userId?: string) {
  // Use useMemo to create stable arrays
  const avatarFlags = useMemo(() => [
    'avatar_upload_enabled',
    'avatar_display_enabled',
    'avatar_face_swap_enabled',
    'avatar_encryption_enabled',
    'avatar_progressive_loading_enabled',
    'avatar_cdn_enabled'
  ], []);

  const defaultValues = useMemo(() => [
    true, // avatar_upload_enabled
    true, // avatar_display_enabled
    true, // avatar_face_swap_enabled
    true, // avatar_encryption_enabled
    false, // avatar_progressive_loading_enabled (default off)
    true  // avatar_cdn_enabled
  ], []);

  const { flags, loading, error, refresh } = useFeatureFlags(
    avatarFlags, 
    defaultValues,
    userId
  );

  return {
    canUploadAvatar: flags.avatar_upload_enabled ?? true,
    canDisplayAvatar: flags.avatar_display_enabled ?? true,
    canUseFaceSwap: flags.avatar_face_swap_enabled ?? true,
    canUseEncryption: flags.avatar_encryption_enabled ?? true,
    canUseProgressiveLoading: flags.avatar_progressive_loading_enabled ?? false,
    canUseCDN: flags.avatar_cdn_enabled ?? true,
    loading,
    error,
    refresh
  };
}

