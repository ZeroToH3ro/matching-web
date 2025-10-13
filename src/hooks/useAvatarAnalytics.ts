'use client';

import { useState, useEffect, useCallback } from 'react';

interface AnalyticsData {
  uploads?: {
    totalUploads: number;
    successfulUploads: number;
    successRate: number;
    averageProcessingTime: number;
    averageFileSize: number;
  };
  access?: {
    totalAccesses: number;
    publicAccesses: number;
    privateAccesses: number;
    cacheHitRate: number;
    averageLoadTime: number;
    accessesByHour: { [hour: string]: number };
    topViewers: { userId: string; count: number }[];
  };
  errors?: {
    uploadErrorRate: number;
    accessErrorRate: number;
    topUploadErrors: { code: string; count: number; message: string }[];
    topAccessErrors: { code: string; count: number }[];
    errorTrends: { date: string; uploadErrors: number; accessErrors: number }[];
  };
  engagement?: {
    totalActions: number;
    actionBreakdown: { [action: string]: number };
    activeUsers: number;
    averageActionsPerUser: number;
    engagementTrends: { date: string; actions: number; users: number }[];
  };
  summary?: {
    totalUploads: number;
    totalAccesses: number;
    uploadSuccessRate: number;
    cacheHitRate: number;
    uploadErrorRate: number;
    accessErrorRate: number;
    activeUsers: number;
  };
}

interface UseAvatarAnalyticsOptions {
  metric?: 'overview' | 'uploads' | 'access' | 'errors' | 'engagement';
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  refreshInterval?: number; // milliseconds
  autoRefresh?: boolean;
}

interface UseAvatarAnalyticsReturn {
  data: AnalyticsData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setDateRange: (start: Date, end: Date) => void;
  setMetric: (metric: string) => void;
  setUserId: (userId?: string) => void;
}

export function useAvatarAnalytics(
  options: UseAvatarAnalyticsOptions = {}
): UseAvatarAnalyticsReturn {
  const {
    metric = 'overview',
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    endDate = new Date(),
    userId,
    refreshInterval = 60000, // 1 minute
    autoRefresh = false
  } = options;

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMetric, setCurrentMetric] = useState(metric);
  const [currentStartDate, setCurrentStartDate] = useState(startDate);
  const [currentEndDate, setCurrentEndDate] = useState(endDate);
  const [currentUserId, setCurrentUserId] = useState(userId);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        metric: currentMetric,
        startDate: currentStartDate.toISOString(),
        endDate: currentEndDate.toISOString()
      });

      if (currentUserId) {
        params.append('userId', currentUserId);
      }

      const response = await fetch(`/api/avatar/analytics?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error || 'Failed to load analytics');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentMetric, currentStartDate, currentEndDate, currentUserId]);

  // Initial fetch and auto-refresh setup
  useEffect(() => {
    fetchAnalytics();

    let intervalId: NodeJS.Timeout | null = null;
    
    if (autoRefresh && refreshInterval > 0) {
      intervalId = setInterval(fetchAnalytics, refreshInterval);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchAnalytics, autoRefresh, refreshInterval]);

  const setDateRange = useCallback((start: Date, end: Date) => {
    setCurrentStartDate(start);
    setCurrentEndDate(end);
  }, []);

  const setMetric = useCallback((newMetric: string) => {
    setCurrentMetric(newMetric as any);
  }, []);

  const setUserId = useCallback((newUserId?: string) => {
    setCurrentUserId(newUserId);
  }, []);

  return {
    data,
    loading,
    error,
    refresh: fetchAnalytics,
    setDateRange,
    setMetric,
    setUserId
  };
}

// Hook for real-time analytics updates
export function useRealTimeAnalytics(userId?: string) {
  const [recentUploads, setRecentUploads] = useState<number>(0);
  const [recentAccesses, setRecentAccesses] = useState<number>(0);
  const [recentErrors, setRecentErrors] = useState<number>(0);

  useEffect(() => {
    // In a real implementation, this would connect to a WebSocket or Server-Sent Events
    // For now, we'll poll the API every 30 seconds for recent activity
    const fetchRecentActivity = async () => {
      try {
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

        const params = new URLSearchParams({
          metric: 'overview',
          startDate: fiveMinutesAgo.toISOString(),
          endDate: now.toISOString()
        });

        if (userId) {
          params.append('userId', userId);
        }

        const response = await fetch(`/api/avatar/analytics?${params.toString()}`);
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data.summary) {
            setRecentUploads(result.data.summary.totalUploads || 0);
            setRecentAccesses(result.data.summary.totalAccesses || 0);
            setRecentErrors(
              (result.data.errors?.uploadErrorRate || 0) + 
              (result.data.errors?.accessErrorRate || 0)
            );
          }
        }
      } catch (error) {
        console.error('Failed to fetch recent activity:', error);
      }
    };

    fetchRecentActivity();
    const intervalId = setInterval(fetchRecentActivity, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, [userId]);

  return {
    recentUploads,
    recentAccesses,
    recentErrors
  };
}

// Hook for analytics alerts
export function useAnalyticsAlerts() {
  const [alerts, setAlerts] = useState<{
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: Date;
  }[]>([]);

  const { data } = useAvatarAnalytics({
    metric: 'errors',
    autoRefresh: true,
    refreshInterval: 60000 // Check every minute
  });

  useEffect(() => {
    if (!data?.errors) return;

    const newAlerts: typeof alerts = [];

    // Check for high error rates
    if (data.errors.uploadErrorRate > 10) {
      newAlerts.push({
        type: 'error',
        message: `High upload error rate: ${data.errors.uploadErrorRate.toFixed(1)}%`,
        timestamp: new Date()
      });
    }

    if (data.errors.accessErrorRate > 5) {
      newAlerts.push({
        type: 'warning',
        message: `High access error rate: ${data.errors.accessErrorRate.toFixed(1)}%`,
        timestamp: new Date()
      });
    }

    // Check for trending errors
    const recentTrends = data.errors.errorTrends.slice(-7); // Last 7 days
    const avgUploadErrors = recentTrends.reduce((sum, day) => sum + day.uploadErrors, 0) / recentTrends.length;
    const avgAccessErrors = recentTrends.reduce((sum, day) => sum + day.accessErrors, 0) / recentTrends.length;

    if (avgUploadErrors > 5) {
      newAlerts.push({
        type: 'warning',
        message: `Trending upload errors: ${avgUploadErrors.toFixed(1)} per day`,
        timestamp: new Date()
      });
    }

    if (avgAccessErrors > 10) {
      newAlerts.push({
        type: 'warning',
        message: `Trending access errors: ${avgAccessErrors.toFixed(1)} per day`,
        timestamp: new Date()
      });
    }

    setAlerts(newAlerts);
  }, [data]);

  const dismissAlert = useCallback((index: number) => {
    setAlerts(prev => prev.filter((_, i) => i !== index));
  }, []);

  return {
    alerts,
    dismissAlert
  };
}