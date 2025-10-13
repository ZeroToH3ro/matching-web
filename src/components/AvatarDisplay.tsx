"use client";

import React, { useState, useEffect } from 'react';
import { useAvatarFeatureFlags } from '@/hooks/useFeatureFlag';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
// Temporarily disabled report feature
// import ReportAvatarDialog from './ReportAvatarDialog';
import { 
  Eye, 
  EyeOff, 
  Users, 
  Lock, 
  AlertCircle, 
  Loader2,
  Crown,
  Heart,
  Flag,
  MoreVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AvatarDisplayProps, AvatarResult } from '@/lib/types/avatar';
import { getPlaceholderAvatarUrl } from '@/lib/utils/avatarUtils';
import { AVATAR_SIZES } from '@/lib/types/avatar';

interface AvatarDisplayState {
  loading: boolean;
  avatarResult: AvatarResult | null;
  error: string | null;
}

export default function AvatarDisplay({
  userId,
  currentUserId,
  size = 'md',
  className,
  showFallback = true
}: AvatarDisplayProps) {
  // All hooks MUST be called at the top level, before any conditional logic
  const [state, setState] = useState<AvatarDisplayState>({
    loading: true,
    avatarResult: null,
    error: null
  });
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showActions, setShowActions] = useState(false);

  // Get size configuration
  const sizeConfig = AVATAR_SIZES[size];

  // Feature flags - MUST be called before any early returns
  const {
    canDisplayAvatar,
    canUseProgressiveLoading,
    loading: flagsLoading
  } = useAvatarFeatureFlags();

  // Calculate derived values - MUST be after all hooks
  const isOwnProfile = currentUserId === userId;
  const canReport = currentUserId && !isOwnProfile;

  // Load avatar data - MUST be called before any conditional returns
  useEffect(() => {
    let mounted = true;

    const loadAvatar = async () => {
      if (!mounted) return;

      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        // Import avatar service dynamically to avoid SSR issues
        const { getAvatarForUser } = await import('@/app/actions/avatarActions');
        const result = await getAvatarForUser(userId, currentUserId);

        if (!mounted) return;

        if (result.status === 'success' && result.data) {
          setState({
            loading: false,
            avatarResult: {
              url: result.data.url,
              type: result.data.type,
              isEncrypted: result.data.isEncrypted,
              hasAccess: result.data.hasAccess,
              error: result.data.error
            },
            error: null
          });
        } else {
          // Fallback to placeholder
          setState({
            loading: false,
            avatarResult: {
              url: getPlaceholderAvatarUrl(userId, size),
              type: 'placeholder',
              isEncrypted: false,
              hasAccess: false,
              error: result.error
            },
            error: result.error || null
          });
        }
      } catch (error) {
        if (!mounted) return;

        console.error('Failed to load avatar:', error);
        setState({
          loading: false,
          avatarResult: {
            url: getPlaceholderAvatarUrl(userId, size),
            type: 'placeholder',
            isEncrypted: false,
            hasAccess: false,
            error: 'Failed to load avatar'
          },
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };

    loadAvatar();

    return () => {
      mounted = false;
    };
  }, [userId, currentUserId, size]);

  // Handle loading state for feature flags
  if (flagsLoading) {
    return (
      <div className={cn('animate-pulse bg-gray-200 dark:bg-gray-700 rounded-full', className)} style={{ width: sizeConfig.width, height: sizeConfig.height }}>
      </div>
    );
  }

  // Handle disabled display
  if (!canDisplayAvatar) {
    return (
      <div className={cn('bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center', className)} style={{ width: sizeConfig.width, height: sizeConfig.height }}>
        <EyeOff className="w-1/2 h-1/2 text-gray-500" />
      </div>
    );
  }

  // Get avatar status info
  const getAvatarStatus = () => {
    if (!state.avatarResult) return null;

    const { type, isEncrypted, hasAccess, error } = state.avatarResult;

    if (error && type === 'placeholder') {
      return {
        icon: AlertCircle,
        label: 'Error loading avatar',
        color: 'destructive' as const,
        description: error
      };
    }

    if (isOwnProfile) {
      return {
        icon: type === 'private' ? EyeOff : Eye,
        label: type === 'private' ? 'Your private avatar' : 'Your public avatar',
        color: type === 'private' ? 'secondary' : 'default' as const,
        description: type === 'private' 
          ? 'Only visible to your matches' 
          : 'Visible to everyone'
      };
    }

    switch (type) {
      case 'private':
        return {
          icon: hasAccess ? Heart : Lock,
          label: hasAccess ? 'Private avatar (matched)' : 'Private avatar (locked)',
          color: hasAccess ? 'default' : 'secondary' as const,
          description: hasAccess 
            ? 'You can see this because you matched!' 
            : 'Match to see their real photo'
        };
      
      case 'public':
        return {
          icon: Users,
          label: 'Public avatar',
          color: 'outline' as const,
          description: 'Face-swapped for privacy'
        };
      
      case 'placeholder':
        return {
          icon: Users,
          label: 'No avatar',
          color: 'outline' as const,
          description: 'User hasn\'t uploaded an avatar yet'
        };
      
      default:
        return null;
    }
  };

  const avatarStatus = getAvatarStatus();

  // Loading state
  if (state.loading) {
    return (
      <div className={cn("relative", className)}>
        <Avatar 
          className={cn("border-2 border-muted")}
          style={{ width: sizeConfig.width, height: sizeConfig.height }}
        >
          <AvatarFallback className="bg-muted">
            <Loader2 className="h-1/3 w-1/3 animate-spin text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
      </div>
    );
  }

  // Error state with fallback
  if (!state.avatarResult && showFallback) {
    return (
      <div className={cn("relative", className)}>
        <Avatar 
          className={cn("border-2 border-destructive/20")}
          style={{ width: sizeConfig.width, height: sizeConfig.height }}
        >
          <AvatarImage 
            src={getPlaceholderAvatarUrl(userId, size)} 
            alt="Placeholder avatar"
          />
          <AvatarFallback className="bg-destructive/10">
            <AlertCircle className="h-1/3 w-1/3 text-destructive" />
          </AvatarFallback>
        </Avatar>
        
        {avatarStatus && (
          <div className="absolute -top-1 -right-1">
            <Badge variant="destructive" className="h-6 w-6 p-0 rounded-full">
              <AlertCircle className="h-3 w-3" />
            </Badge>
          </div>
        )}
      </div>
    );
  }

  if (!state.avatarResult) {
    return null;
  }

  const { url, type, isEncrypted } = state.avatarResult;

  return (
    <div className={cn("relative group", className)}>
      {/* Main Avatar */}
      <Avatar 
        className={cn(
          "border-2 transition-all duration-200",
          type === 'private' && "border-primary/50 shadow-lg shadow-primary/20",
          type === 'public' && "border-muted",
          type === 'placeholder' && "border-muted-foreground/20",
          "group-hover:scale-105"
        )}
        style={{ width: sizeConfig.width, height: sizeConfig.height }}
      >
        <AvatarImage 
          src={url} 
          alt={`${isOwnProfile ? 'Your' : 'User'} avatar`}
          className={cn(
            "transition-all duration-200",
            type === 'private' && "group-hover:brightness-110"
          )}
        />
        <AvatarFallback className={cn(
          type === 'private' && "bg-primary/10",
          type === 'public' && "bg-muted",
          type === 'placeholder' && "bg-muted-foreground/10"
        )}>
          {avatarStatus?.icon && (
            <avatarStatus.icon className="h-1/3 w-1/3 text-muted-foreground" />
          )}
        </AvatarFallback>
      </Avatar>

      {/* Status Badge */}
      {avatarStatus && (
        <div className="absolute -top-1 -right-1">
          <Badge 
            variant={avatarStatus.color as any}
            className={cn(
              "h-6 w-6 p-0 rounded-full transition-all duration-200",
              "group-hover:scale-110",
              type === 'private' && "bg-primary text-primary-foreground",
              isEncrypted && "animate-pulse"
            )}
          >
            <avatarStatus.icon className="h-3 w-3" />
          </Badge>
        </div>
      )}

      {/* Encryption Indicator */}
      {isEncrypted && type === 'private' && (
        <div className="absolute -bottom-1 -right-1">
          <Badge 
            variant="secondary" 
            className="h-5 w-5 p-0 rounded-full bg-green-500 text-white"
          >
            <Lock className="h-2.5 w-2.5" />
          </Badge>
        </div>
      )}

      {/* Actions Menu (for larger sizes) */}
      {canReport && (size === 'lg' || size === 'xl') && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              className="h-6 w-6 p-0 rounded-full bg-background/80 backdrop-blur-sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowActions(!showActions);
              }}
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
            
            {showActions && (
              <div className="absolute top-full right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 min-w-[120px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowReportDialog(true);
                    setShowActions(false);
                  }}
                >
                  <Flag className="h-3 w-3 mr-2" />
                  Report Avatar
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Report Button (for smaller sizes) */}
      {canReport && (size === 'sm' || size === 'md') && (
        <div className="absolute -top-1 -left-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Button
            variant="secondary"
            size="sm"
            className="h-5 w-5 p-0 rounded-full bg-background/80 backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowReportDialog(true);
            }}
          >
            <Flag className="h-2.5 w-2.5" />
          </Button>
        </div>
      )}

      {/* Hover Tooltip */}
      {avatarStatus && (
        <div className={cn(
          "absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2",
          "bg-popover text-popover-foreground text-xs rounded-md px-2 py-1",
          "border shadow-md whitespace-nowrap z-50",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
          "pointer-events-none"
        )}>
          <div className="font-medium">{avatarStatus.label}</div>
          {avatarStatus.description && (
            <div className="text-muted-foreground text-xs mt-0.5">
              {avatarStatus.description}
            </div>
          )}
          {/* Tooltip Arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-popover" />
        </div>
      )}

      {/* Report Dialog - Temporarily disabled */}
      {/* {canReport && (
        <ReportAvatarDialog
          targetUserId={userId}
          targetUserName="User"
          isOpen={showReportDialog}
          onClose={() => setShowReportDialog(false)}
        />
      )} */}
    </div>
  );
}

// Convenience components for common use cases
export function ProfileAvatar({ 
  userId, 
  currentUserId, 
  className 
}: { 
  userId: string; 
  currentUserId?: string; 
  className?: string; 
}) {
  return (
    <AvatarDisplay
      key={`profile-avatar-${userId}`}
      userId={userId}
      currentUserId={currentUserId}
      size="xl"
      className={className}
    />
  );
}

export function CardAvatar({ 
  userId, 
  currentUserId, 
  className 
}: { 
  userId: string; 
  currentUserId?: string; 
  className?: string; 
}) {
  return (
    <AvatarDisplay
      key={`card-avatar-${userId}`}
      userId={userId}
      currentUserId={currentUserId}
      size="lg"
      className={className}
    />
  );
}

export function ListAvatar({ 
  userId, 
  currentUserId, 
  className 
}: { 
  userId: string; 
  currentUserId?: string; 
  className?: string; 
}) {
  return (
    <AvatarDisplay
      key={`list-avatar-${userId}`}
      userId={userId}
      currentUserId={currentUserId}
      size="md"
      className={className}
    />
  );
}

export function SmallAvatar({ 
  userId, 
  currentUserId, 
  className 
}: { 
  userId: string; 
  currentUserId?: string; 
  className?: string; 
}) {
  return (
    <AvatarDisplay
      key={`small-avatar-${userId}`}
      userId={userId}
      currentUserId={currentUserId}
      size="sm"
      className={className}
    />
  );
}