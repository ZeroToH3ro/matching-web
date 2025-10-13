'use server';

import { getAuthUserId } from './authActions';
import { ContentModerationService } from '@/services/contentModerationService';
import { prisma } from '@/lib/prisma';

export interface ReportResult {
  status: 'success' | 'error';
  reportId?: string;
  message?: string;
  error?: string;
}

export interface ReportReason {
  id: string;
  label: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

// Predefined report reasons
export const REPORT_REASONS: ReportReason[] = [
  {
    id: 'inappropriate_content',
    label: 'Inappropriate Content',
    description: 'Contains inappropriate, offensive, or disturbing content',
    severity: 'high'
  },
  {
    id: 'nudity',
    label: 'Nudity or Sexual Content',
    description: 'Contains nudity or sexually explicit content',
    severity: 'high'
  },
  {
    id: 'fake_profile',
    label: 'Fake Profile',
    description: 'Using someone else\'s photos or fake identity',
    severity: 'medium'
  },
  {
    id: 'spam',
    label: 'Spam or Misleading',
    description: 'Spam, scam, or misleading content',
    severity: 'medium'
  },
  {
    id: 'harassment',
    label: 'Harassment',
    description: 'Harassment, bullying, or threatening behavior',
    severity: 'high'
  },
  {
    id: 'violence',
    label: 'Violence or Dangerous Content',
    description: 'Promotes violence or dangerous activities',
    severity: 'high'
  },
  {
    id: 'copyright',
    label: 'Copyright Violation',
    description: 'Uses copyrighted content without permission',
    severity: 'low'
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Other reason not listed above',
    severity: 'low'
  }
];

/**
 * Reports a user's avatar for inappropriate content
 */
export async function reportAvatar(
  targetUserId: string,
  reasonId: string,
  additionalDetails?: string
): Promise<ReportResult> {
  try {
    const reporterId = await getAuthUserId();
    
    if (reporterId === targetUserId) {
      return {
        status: 'error',
        error: 'You cannot report your own avatar'
      };
    }

    // Validate reason
    const reason = REPORT_REASONS.find(r => r.id === reasonId);
    if (!reason) {
      return {
        status: 'error',
        error: 'Invalid report reason'
      };
    }

    // Check if user has already reported this avatar
    const existingReport = await checkExistingReport(reporterId, targetUserId, 'avatar');
    if (existingReport) {
      return {
        status: 'error',
        error: 'You have already reported this avatar'
      };
    }

    // Check if target user exists and has an avatar
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { 
        id: true, 
        publicAvatarBlobId: true, 
        privateAvatarBlobId: true 
      } as any
    }) as any;

    if (!targetUser) {
      return {
        status: 'error',
        error: 'User not found'
      };
    }

    if (!targetUser.publicAvatarBlobId && !targetUser.privateAvatarBlobId) {
      return {
        status: 'error',
        error: 'User has no avatar to report'
      };
    }

    // Create the report
    const moderationService = new ContentModerationService();
    const reportId = await moderationService.createContentReport(
      targetUserId,
      'avatar',
      targetUser.publicAvatarBlobId || targetUser.privateAvatarBlobId,
      reporterId,
      `${reason.label}: ${additionalDetails || reason.description}`
    );

    // Log the report in database (placeholder)
    await logReport(reporterId, targetUserId, 'avatar', reasonId, additionalDetails);

    // If it's a high severity report, immediately flag for review
    if (reason.severity === 'high') {
      await flagForImmediateReview(targetUserId, reportId, reason);
    }

    return {
      status: 'success',
      reportId,
      message: 'Report submitted successfully. Our moderation team will review it shortly.'
    };

  } catch (error) {
    console.error('Failed to report avatar:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to submit report'
    };
  }
}

/**
 * Reports a user's profile for inappropriate content
 */
export async function reportProfile(
  targetUserId: string,
  reasonId: string,
  additionalDetails?: string
): Promise<ReportResult> {
  try {
    const reporterId = await getAuthUserId();
    
    if (reporterId === targetUserId) {
      return {
        status: 'error',
        error: 'You cannot report your own profile'
      };
    }

    // Validate reason
    const reason = REPORT_REASONS.find(r => r.id === reasonId);
    if (!reason) {
      return {
        status: 'error',
        error: 'Invalid report reason'
      };
    }

    // Check if user has already reported this profile
    const existingReport = await checkExistingReport(reporterId, targetUserId, 'profile');
    if (existingReport) {
      return {
        status: 'error',
        error: 'You have already reported this profile'
      };
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true }
    });

    if (!targetUser) {
      return {
        status: 'error',
        error: 'User not found'
      };
    }

    // Create the report
    const moderationService = new ContentModerationService();
    const reportId = await moderationService.createContentReport(
      targetUserId,
      'profile',
      targetUserId,
      reporterId,
      `${reason.label}: ${additionalDetails || reason.description}`
    );

    // Log the report
    await logReport(reporterId, targetUserId, 'profile', reasonId, additionalDetails);

    // Handle high severity reports
    if (reason.severity === 'high') {
      await flagForImmediateReview(targetUserId, reportId, reason);
    }

    return {
      status: 'success',
      reportId,
      message: 'Report submitted successfully. Our moderation team will review it shortly.'
    };

  } catch (error) {
    console.error('Failed to report profile:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to submit report'
    };
  }
}

/**
 * Gets available report reasons
 */
export async function getReportReasons(): Promise<ReportReason[]> {
  return REPORT_REASONS;
}

/**
 * Gets user's report history (for rate limiting)
 */
export async function getUserReportHistory(): Promise<{
  totalReports: number;
  recentReports: number;
  canReport: boolean;
  cooldownUntil?: Date;
}> {
  try {
    const userId = await getAuthUserId();
    
    // TODO: Query actual report history from database
    // For now, return default values
    return {
      totalReports: 0,
      recentReports: 0,
      canReport: true
    };

  } catch (error) {
    console.error('Failed to get user report history:', error);
    return {
      totalReports: 0,
      recentReports: 0,
      canReport: false
    };
  }
}

/**
 * Checks if user has already reported specific content
 */
async function checkExistingReport(
  reporterId: string, 
  targetUserId: string, 
  contentType: string
): Promise<boolean> {
  try {
    // TODO: Query reports table to check for existing reports
    // For now, return false (no existing report)
    return false;

  } catch (error) {
    console.error('Failed to check existing report:', error);
    return false;
  }
}

/**
 * Logs a report in the database
 */
async function logReport(
  reporterId: string,
  targetUserId: string,
  contentType: string,
  reasonId: string,
  additionalDetails?: string
): Promise<void> {
  try {
    // TODO: Store report in reports table
    console.log('[Reporting] Report logged:', {
      reporterId,
      targetUserId,
      contentType,
      reasonId,
      additionalDetails,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Failed to log report:', error);
    // Don't throw - logging failure shouldn't break reporting
  }
}

/**
 * Flags high-severity reports for immediate review
 */
async function flagForImmediateReview(
  targetUserId: string,
  reportId: string,
  reason: ReportReason
): Promise<void> {
  try {
    console.log(`[Reporting] High severity report flagged for immediate review:`, {
      targetUserId,
      reportId,
      reason: reason.label,
      severity: reason.severity
    });

    // TODO: Implement immediate review flagging
    // - Add to priority moderation queue
    // - Send notification to moderators
    // - Potentially auto-hide content pending review

  } catch (error) {
    console.error('Failed to flag for immediate review:', error);
  }
}

/**
 * Blocks a user (admin action)
 */
export async function blockUserByModerator(
  targetUserId: string,
  reason: string,
  duration?: number // Duration in hours, undefined for permanent
): Promise<ReportResult> {
  try {
    const moderatorId = await getAuthUserId();
    
    // TODO: Verify moderator permissions
    
    // TODO: Implement user blocking
    console.log('[Reporting] User blocked by moderator:', {
      targetUserId,
      moderatorId,
      reason,
      duration,
      timestamp: new Date()
    });

    return {
      status: 'success',
      message: `User blocked ${duration ? `for ${duration} hours` : 'permanently'}`
    };

  } catch (error) {
    console.error('Failed to block user:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to block user'
    };
  }
}