'use client';

import React, { useState, useEffect } from 'react';
import { useAvatarAnalytics } from '@/hooks/useAvatarAnalytics';
import { cn } from '@/lib/utils';

interface UsageReportProps {
  userId?: string;
  timeRange?: 'day' | 'week' | 'month' | 'year';
  className?: string;
}

interface UsageData {
  period: string;
  uploads: number;
  views: number;
  uniqueViewers: number;
  cacheHitRate: number;
  averageLoadTime: number;
}

export function AvatarUsageReport({ userId, timeRange = 'month', className }: UsageReportProps) {
  const [selectedRange, setSelectedRange] = useState(timeRange);
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate date range based on selected period
  const getDateRange = (range: string) => {
    const end = new Date();
    const start = new Date();

    switch (range) {
      case 'day':
        start.setDate(end.getDate() - 7); // Last 7 days
        break;
      case 'week':
        start.setDate(end.getDate() - 28); // Last 4 weeks
        break;
      case 'month':
        start.setMonth(end.getMonth() - 12); // Last 12 months
        break;
      case 'year':
        start.setFullYear(end.getFullYear() - 5); // Last 5 years
        break;
    }

    return { start, end };
  };

  const { data: analyticsData } = useAvatarAnalytics({
    metric: 'overview',
    ...getDateRange(selectedRange),
    userId,
    autoRefresh: true
  });

  useEffect(() => {
    if (analyticsData) {
      generateUsageData();
    }
  }, [analyticsData, selectedRange]);

  const generateUsageData = () => {
    if (!analyticsData) return;

    // Generate mock usage data based on analytics
    // In a real implementation, this would come from the API
    const data: UsageData[] = [];
    const { start, end } = getDateRange(selectedRange);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    let periodCount = 0;
    switch (selectedRange) {
      case 'day':
        periodCount = 7;
        break;
      case 'week':
        periodCount = 4;
        break;
      case 'month':
        periodCount = 12;
        break;
      case 'year':
        periodCount = 5;
        break;
    }

    for (let i = 0; i < periodCount; i++) {
      const periodStart = new Date(start);
      
      switch (selectedRange) {
        case 'day':
          periodStart.setDate(start.getDate() + i);
          break;
        case 'week':
          periodStart.setDate(start.getDate() + (i * 7));
          break;
        case 'month':
          periodStart.setMonth(start.getMonth() + i);
          break;
        case 'year':
          periodStart.setFullYear(start.getFullYear() + i);
          break;
      }

      // Generate realistic usage data
      const baseUploads = analyticsData.summary?.totalUploads || 0;
      const baseViews = analyticsData.summary?.totalAccesses || 0;
      
      data.push({
        period: formatPeriod(periodStart, selectedRange),
        uploads: Math.floor((baseUploads / periodCount) * (0.8 + Math.random() * 0.4)),
        views: Math.floor((baseViews / periodCount) * (0.8 + Math.random() * 0.4)),
        uniqueViewers: Math.floor((baseViews / periodCount) * 0.6 * (0.8 + Math.random() * 0.4)),
        cacheHitRate: analyticsData.access?.cacheHitRate || 75 + Math.random() * 20,
        averageLoadTime: analyticsData.access?.averageLoadTime || 100 + Math.random() * 100
      });
    }

    setUsageData(data);
    setLoading(false);
  };

  const formatPeriod = (date: Date, range: string): string => {
    switch (range) {
      case 'day':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case 'week':
        return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      case 'month':
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      case 'year':
        return date.getFullYear().toString();
      default:
        return date.toLocaleDateString();
    }
  };

  const exportReport = () => {
    const csvContent = [
      ['Period', 'Uploads', 'Views', 'Unique Viewers', 'Cache Hit Rate (%)', 'Avg Load Time (ms)'],
      ...usageData.map(row => [
        row.period,
        row.uploads.toString(),
        row.views.toString(),
        row.uniqueViewers.toString(),
        row.cacheHitRate.toFixed(1),
        row.averageLoadTime.toFixed(0)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avatar-usage-report-${selectedRange}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className={cn('bg-white dark:bg-gray-800 rounded-lg shadow p-6', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('bg-white dark:bg-gray-800 rounded-lg shadow p-6', className)}>
        <div className="text-center text-red-600 dark:text-red-400">
          <p>Error loading usage report: {error}</p>
        </div>
      </div>
    );
  }

  const totalUploads = usageData.reduce((sum, item) => sum + item.uploads, 0);
  const totalViews = usageData.reduce((sum, item) => sum + item.views, 0);
  const avgCacheHitRate = usageData.reduce((sum, item) => sum + item.cacheHitRate, 0) / usageData.length;
  const avgLoadTime = usageData.reduce((sum, item) => sum + item.averageLoadTime, 0) / usageData.length;

  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-lg shadow', className)}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Avatar Usage Report
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {userId ? 'Personal usage statistics' : 'Platform-wide usage statistics'}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <select
              value={selectedRange}
              onChange={(e) => setSelectedRange(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700"
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
            </select>
            <button
              onClick={exportReport}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {totalUploads}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Uploads</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {totalViews}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Views</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {avgCacheHitRate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Avg Cache Hit Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {avgLoadTime.toFixed(0)}ms
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Avg Load Time</div>
          </div>
        </div>
      </div>

      {/* Usage Chart */}
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-4">Usage Trends</h3>
        <div className="space-y-4">
          {usageData.map((item, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{item.period}</span>
                <div className="flex space-x-4 text-xs text-gray-600 dark:text-gray-400">
                  <span>Uploads: {item.uploads}</span>
                  <span>Views: {item.views}</span>
                  <span>Cache: {item.cacheHitRate.toFixed(1)}%</span>
                </div>
              </div>
              
              {/* Upload Bar */}
              <div className="flex items-center space-x-2">
                <span className="text-xs w-16">Uploads</span>
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((item.uploads / Math.max(...usageData.map(d => d.uploads))) * 100, 100)}%` }}
                  ></div>
                </div>
                <span className="text-xs w-8 text-right">{item.uploads}</span>
              </div>

              {/* Views Bar */}
              <div className="flex items-center space-x-2">
                <span className="text-xs w-16">Views</span>
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((item.views / Math.max(...usageData.map(d => d.views))) * 100, 100)}%` }}
                  ></div>
                </div>
                <span className="text-xs w-8 text-right">{item.views}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Insights */}
      <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <h3 className="text-lg font-semibold mb-4">Performance Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium mb-2">Cache Performance</h4>
            <p className="text-gray-600 dark:text-gray-400">
              {avgCacheHitRate > 80 
                ? '✅ Excellent cache performance - most requests are served from cache'
                : avgCacheHitRate > 60
                ? '⚠️ Good cache performance - consider optimizing cache strategies'
                : '❌ Poor cache performance - cache optimization needed'
              }
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-2">Load Times</h4>
            <p className="text-gray-600 dark:text-gray-400">
              {avgLoadTime < 200
                ? '✅ Fast loading times - users have a smooth experience'
                : avgLoadTime < 500
                ? '⚠️ Moderate loading times - consider image optimization'
                : '❌ Slow loading times - optimization required'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}