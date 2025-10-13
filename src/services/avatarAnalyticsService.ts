import { prisma } from '@/lib/prisma';

interface AvatarUploadMetrics {
  userId: string;
  uploadStartTime: number;
  uploadEndTime: number;
  fileSize: number;
  originalFormat: string;
  processedFormats: string[];
  processingTime: number;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  compressionRatio?: number;
  variantsGenerated: number;
}

interface AvatarAccessMetrics {
  targetUserId: string;
  viewerUserId?: string;
  accessTime: number;
  avatarType: 'public' | 'private' | 'placeholder';
  isEncrypted: boolean;
  hasAccess: boolean;
  loadTime?: number;
  cacheHit: boolean;
  userAgent?: string;
  referrer?: string;
  errorCode?: string;
}

interface AvatarEngagementMetrics {
  userId: string;
  action: 'view' | 'upload' | 'update' | 'delete' | 'report';
  timestamp: number;
  sessionId?: string;
  metadata?: Record<string, any>;
}

interface AnalyticsConfig {
  enableTracking: boolean;
  batchSize: number;
  flushInterval: number; // milliseconds
  retentionDays: number;
}

export class AvatarAnalyticsService {
  private config: AnalyticsConfig;
  private uploadMetricsBatch: AvatarUploadMetrics[] = [];
  private accessMetricsBatch: AvatarAccessMetrics[] = [];
  private engagementMetricsBatch: AvatarEngagementMetrics[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<AnalyticsConfig>) {
    this.config = {
      enableTracking: process.env.AVATAR_ANALYTICS_ENABLED === 'true' || true,
      batchSize: parseInt(process.env.ANALYTICS_BATCH_SIZE || '50'),
      flushInterval: parseInt(process.env.ANALYTICS_FLUSH_INTERVAL || '30000'), // 30 seconds
      retentionDays: parseInt(process.env.ANALYTICS_RETENTION_DAYS || '90'),
      ...config
    };

    if (this.config.enableTracking) {
      this.startBatchFlushTimer();
    }
  }

  /**
   * Tracks avatar upload metrics
   */
  async trackUpload(metrics: AvatarUploadMetrics): Promise<void> {
    if (!this.config.enableTracking) return;

    try {
      this.uploadMetricsBatch.push(metrics);

      if (this.uploadMetricsBatch.length >= this.config.batchSize) {
        await this.flushUploadMetrics();
      }
    } catch (error) {
      console.error('Failed to track upload metrics:', error);
    }
  }

  /**
   * Tracks avatar access metrics
   */
  async trackAccess(metrics: AvatarAccessMetrics): Promise<void> {
    if (!this.config.enableTracking) return;

    try {
      this.accessMetricsBatch.push(metrics);

      if (this.accessMetricsBatch.length >= this.config.batchSize) {
        await this.flushAccessMetrics();
      }
    } catch (error) {
      console.error('Failed to track access metrics:', error);
    }
  }

  /**
   * Tracks user engagement with avatars
   */
  async trackEngagement(metrics: AvatarEngagementMetrics): Promise<void> {
    if (!this.config.enableTracking) return;

    try {
      this.engagementMetricsBatch.push(metrics);

      if (this.engagementMetricsBatch.length >= this.config.batchSize) {
        await this.flushEngagementMetrics();
      }
    } catch (error) {
      console.error('Failed to track engagement metrics:', error);
    }
  }

  /**
   * Gets upload success rate for a time period
   */
  async getUploadSuccessRate(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<{
    totalUploads: number;
    successfulUploads: number;
    successRate: number;
    averageProcessingTime: number;
    averageFileSize: number;
  }> {
    try {
      const whereClause = {
        timestamp: {
          gte: startDate,
          lte: endDate
        },
        ...(userId && { userId })
      };

      const metrics = await prisma.avatarUploadMetric.findMany({
        where: whereClause
      });

      const totalUploads = metrics.length;
      const successfulUploads = metrics.filter(m => m.success).length;
      const successRate = totalUploads > 0 ? (successfulUploads / totalUploads) * 100 : 0;

      const successfulMetrics = metrics.filter(m => m.success);
      const averageProcessingTime = successfulMetrics.length > 0
        ? successfulMetrics.reduce((sum, m) => sum + m.processingTime, 0) / successfulMetrics.length
        : 0;

      const averageFileSize = metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.fileSize, 0) / metrics.length
        : 0;

      return {
        totalUploads,
        successfulUploads,
        successRate,
        averageProcessingTime,
        averageFileSize
      };
    } catch (error) {
      console.error('Failed to get upload success rate:', error);
      throw error;
    }
  }

  /**
   * Gets avatar access patterns
   */
  async getAccessPatterns(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<{
    totalAccesses: number;
    publicAccesses: number;
    privateAccesses: number;
    cacheHitRate: number;
    averageLoadTime: number;
    accessesByHour: { [hour: string]: number };
    topViewers: { userId: string; count: number }[];
  }> {
    try {
      const whereClause = {
        timestamp: {
          gte: startDate,
          lte: endDate
        },
        ...(userId && { targetUserId: userId })
      };

      const metrics = await prisma.avatarAccessMetric.findMany({
        where: whereClause
      });

      const totalAccesses = metrics.length;
      const publicAccesses = metrics.filter(m => m.avatarType === 'public').length;
      const privateAccesses = metrics.filter(m => m.avatarType === 'private').length;

      const cacheHits = metrics.filter(m => m.cacheHit).length;
      const cacheHitRate = totalAccesses > 0 ? (cacheHits / totalAccesses) * 100 : 0;

      const metricsWithLoadTime = metrics.filter(m => m.loadTime !== null);
      const averageLoadTime = metricsWithLoadTime.length > 0
        ? metricsWithLoadTime.reduce((sum, m) => sum + (m.loadTime || 0), 0) / metricsWithLoadTime.length
        : 0;

      // Group accesses by hour
      const accessesByHour: { [hour: string]: number } = {};
      metrics.forEach(metric => {
        const hour = new Date(metric.timestamp).getHours().toString().padStart(2, '0');
        accessesByHour[hour] = (accessesByHour[hour] || 0) + 1;
      });

      // Get top viewers
      const viewerCounts: { [userId: string]: number } = {};
      metrics.forEach(metric => {
        if (metric.viewerUserId) {
          viewerCounts[metric.viewerUserId] = (viewerCounts[metric.viewerUserId] || 0) + 1;
        }
      });

      const topViewers = Object.entries(viewerCounts)
        .map(([userId, count]) => ({ userId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalAccesses,
        publicAccesses,
        privateAccesses,
        cacheHitRate,
        averageLoadTime,
        accessesByHour,
        topViewers
      };
    } catch (error) {
      console.error('Failed to get access patterns:', error);
      throw error;
    }
  }

  /**
   * Gets error rate statistics
   */
  async getErrorRates(
    startDate: Date,
    endDate: Date
  ): Promise<{
    uploadErrorRate: number;
    accessErrorRate: number;
    topUploadErrors: { code: string; count: number; message: string }[];
    topAccessErrors: { code: string; count: number }[];
    errorTrends: { date: string; uploadErrors: number; accessErrors: number }[];
  }> {
    try {
      const [uploadMetrics, accessMetrics] = await Promise.all([
        prisma.avatarUploadMetric.findMany({
          where: {
            timestamp: { gte: startDate, lte: endDate }
          }
        }),
        prisma.avatarAccessMetric.findMany({
          where: {
            timestamp: { gte: startDate, lte: endDate }
          }
        })
      ]);

      // Upload error rate
      const totalUploads = uploadMetrics.length;
      const failedUploads = uploadMetrics.filter(m => !m.success).length;
      const uploadErrorRate = totalUploads > 0 ? (failedUploads / totalUploads) * 100 : 0;

      // Access error rate
      const totalAccesses = accessMetrics.length;
      const failedAccesses = accessMetrics.filter(m => m.errorCode).length;
      const accessErrorRate = totalAccesses > 0 ? (failedAccesses / totalAccesses) * 100 : 0;

      // Top upload errors
      const uploadErrorCounts: { [code: string]: { count: number; message: string } } = {};
      uploadMetrics.filter(m => !m.success && m.errorCode).forEach(metric => {
        const code = metric.errorCode!;
        if (!uploadErrorCounts[code]) {
          uploadErrorCounts[code] = { count: 0, message: metric.errorMessage || 'Unknown error' };
        }
        uploadErrorCounts[code].count++;
      });

      const topUploadErrors = Object.entries(uploadErrorCounts)
        .map(([code, { count, message }]) => ({ code, count, message }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Top access errors
      const accessErrorCounts: { [code: string]: number } = {};
      accessMetrics.filter(m => m.errorCode).forEach(metric => {
        const code = metric.errorCode!;
        accessErrorCounts[code] = (accessErrorCounts[code] || 0) + 1;
      });

      const topAccessErrors = Object.entries(accessErrorCounts)
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Error trends by day
      const errorTrends: { date: string; uploadErrors: number; accessErrors: number }[] = [];
      const dayMs = 24 * 60 * 60 * 1000;
      
      for (let date = new Date(startDate); date <= endDate; date = new Date(date.getTime() + dayMs)) {
        const dayStart = new Date(date);
        const dayEnd = new Date(date.getTime() + dayMs - 1);
        
        const dayUploadErrors = uploadMetrics.filter(m => 
          !m.success && 
          new Date(m.timestamp) >= dayStart && 
          new Date(m.timestamp) <= dayEnd
        ).length;

        const dayAccessErrors = accessMetrics.filter(m => 
          m.errorCode && 
          new Date(m.timestamp) >= dayStart && 
          new Date(m.timestamp) <= dayEnd
        ).length;

        errorTrends.push({
          date: date.toISOString().split('T')[0],
          uploadErrors: dayUploadErrors,
          accessErrors: dayAccessErrors
        });
      }

      return {
        uploadErrorRate,
        accessErrorRate,
        topUploadErrors,
        topAccessErrors,
        errorTrends
      };
    } catch (error) {
      console.error('Failed to get error rates:', error);
      throw error;
    }
  }

  /**
   * Gets user engagement statistics
   */
  async getUserEngagement(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<{
    totalActions: number;
    actionBreakdown: { [action: string]: number };
    activeUsers: number;
    averageActionsPerUser: number;
    engagementTrends: { date: string; actions: number; users: number }[];
  }> {
    try {
      const whereClause = {
        timestamp: {
          gte: startDate,
          lte: endDate
        },
        ...(userId && { userId })
      };

      const metrics = await prisma.avatarEngagementMetric.findMany({
        where: whereClause
      });

      const totalActions = metrics.length;
      
      // Action breakdown
      const actionBreakdown: { [action: string]: number } = {};
      metrics.forEach(metric => {
        actionBreakdown[metric.action] = (actionBreakdown[metric.action] || 0) + 1;
      });

      // Active users
      const uniqueUsers = new Set(metrics.map(m => m.userId));
      const activeUsers = uniqueUsers.size;
      const averageActionsPerUser = activeUsers > 0 ? totalActions / activeUsers : 0;

      // Engagement trends by day
      const engagementTrends: { date: string; actions: number; users: number }[] = [];
      const dayMs = 24 * 60 * 60 * 1000;
      
      for (let date = new Date(startDate); date <= endDate; date = new Date(date.getTime() + dayMs)) {
        const dayStart = new Date(date);
        const dayEnd = new Date(date.getTime() + dayMs - 1);
        
        const dayMetrics = metrics.filter(m => 
          new Date(m.timestamp) >= dayStart && 
          new Date(m.timestamp) <= dayEnd
        );

        const dayUsers = new Set(dayMetrics.map(m => m.userId));

        engagementTrends.push({
          date: date.toISOString().split('T')[0],
          actions: dayMetrics.length,
          users: dayUsers.size
        });
      }

      return {
        totalActions,
        actionBreakdown,
        activeUsers,
        averageActionsPerUser,
        engagementTrends
      };
    } catch (error) {
      console.error('Failed to get user engagement:', error);
      throw error;
    }
  }

  /**
   * Flushes all pending metrics to database
   */
  async flushAllMetrics(): Promise<void> {
    await Promise.all([
      this.flushUploadMetrics(),
      this.flushAccessMetrics(),
      this.flushEngagementMetrics()
    ]);
  }

  /**
   * Cleans up old metrics based on retention policy
   */
  async cleanupOldMetrics(): Promise<{
    uploadMetricsDeleted: number;
    accessMetricsDeleted: number;
    engagementMetricsDeleted: number;
  }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      const [uploadResult, accessResult, engagementResult] = await Promise.all([
        prisma.avatarUploadMetric.deleteMany({
          where: { timestamp: { lt: cutoffDate } }
        }),
        prisma.avatarAccessMetric.deleteMany({
          where: { timestamp: { lt: cutoffDate } }
        }),
        prisma.avatarEngagementMetric.deleteMany({
          where: { timestamp: { lt: cutoffDate } }
        })
      ]);

      return {
        uploadMetricsDeleted: uploadResult.count,
        accessMetricsDeleted: accessResult.count,
        engagementMetricsDeleted: engagementResult.count
      };
    } catch (error) {
      console.error('Failed to cleanup old metrics:', error);
      throw error;
    }
  }

  /**
   * Starts the batch flush timer
   */
  private startBatchFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      try {
        await this.flushAllMetrics();
      } catch (error) {
        console.error('Failed to flush metrics batch:', error);
      }
    }, this.config.flushInterval);
  }

  /**
   * Flushes upload metrics to database
   */
  private async flushUploadMetrics(): Promise<void> {
    if (this.uploadMetricsBatch.length === 0) return;

    try {
      const batch = [...this.uploadMetricsBatch];
      this.uploadMetricsBatch = [];

      await prisma.avatarUploadMetric.createMany({
        data: batch.map(metrics => ({
          userId: metrics.userId,
          timestamp: new Date(metrics.uploadEndTime),
          fileSize: metrics.fileSize,
          originalFormat: metrics.originalFormat,
          processedFormats: metrics.processedFormats,
          processingTime: metrics.processingTime,
          success: metrics.success,
          errorCode: metrics.errorCode,
          errorMessage: metrics.errorMessage,
          compressionRatio: metrics.compressionRatio,
          variantsGenerated: metrics.variantsGenerated
        }))
      });
    } catch (error) {
      console.error('Failed to flush upload metrics:', error);
      // Re-add failed batch to retry later
      this.uploadMetricsBatch.unshift(...this.uploadMetricsBatch);
    }
  }

  /**
   * Flushes access metrics to database
   */
  private async flushAccessMetrics(): Promise<void> {
    if (this.accessMetricsBatch.length === 0) return;

    try {
      const batch = [...this.accessMetricsBatch];
      this.accessMetricsBatch = [];

      await prisma.avatarAccessMetric.createMany({
        data: batch.map(metrics => ({
          targetUserId: metrics.targetUserId,
          viewerUserId: metrics.viewerUserId,
          timestamp: new Date(metrics.accessTime),
          avatarType: metrics.avatarType,
          isEncrypted: metrics.isEncrypted,
          hasAccess: metrics.hasAccess,
          loadTime: metrics.loadTime,
          cacheHit: metrics.cacheHit,
          userAgent: metrics.userAgent,
          referrer: metrics.referrer,
          errorCode: metrics.errorCode
        }))
      });
    } catch (error) {
      console.error('Failed to flush access metrics:', error);
      // Re-add failed batch to retry later
      this.accessMetricsBatch.unshift(...this.accessMetricsBatch);
    }
  }

  /**
   * Flushes engagement metrics to database
   */
  private async flushEngagementMetrics(): Promise<void> {
    if (this.engagementMetricsBatch.length === 0) return;

    try {
      const batch = [...this.engagementMetricsBatch];
      this.engagementMetricsBatch = [];

      await prisma.avatarEngagementMetric.createMany({
        data: batch.map(metrics => ({
          userId: metrics.userId,
          action: metrics.action,
          timestamp: new Date(metrics.timestamp),
          sessionId: metrics.sessionId,
          metadata: metrics.metadata as any
        }))
      });
    } catch (error) {
      console.error('Failed to flush engagement metrics:', error);
      // Re-add failed batch to retry later
      this.engagementMetricsBatch.unshift(...this.engagementMetricsBatch);
    }
  }

  /**
   * Stops the analytics service and flushes remaining metrics
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flushAllMetrics();
  }
}

// Singleton instance
let avatarAnalyticsService: AvatarAnalyticsService | null = null;

export function getAvatarAnalyticsService(): AvatarAnalyticsService {
  if (!avatarAnalyticsService) {
    avatarAnalyticsService = new AvatarAnalyticsService();
  }
  return avatarAnalyticsService;
}