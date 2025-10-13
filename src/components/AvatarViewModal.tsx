"use client";

import React, { useEffect } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  X, 
  Eye, 
  EyeOff, 
  Users, 
  Crown,
  Download,
  Share2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvatarViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  publicAvatar?: string;
  privateAvatar?: string;
  userName?: string;
  canDownload?: boolean;
  isOwnProfile?: boolean;
}

export default function AvatarViewModal({
  isOpen,
  onClose,
  publicAvatar,
  privateAvatar,
  userName,
  canDownload = false,
  isOwnProfile = false
}: AvatarViewModalProps) {
  
  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.removeEventListener('keydown', handleEscKey);
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen, onClose]);

  // Handle backdrop click
  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleDownload = async (imageUrl: string, type: 'public' | 'private') => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${userName || 'avatar'}-${type}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[999999] bg-black/80 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-modal-title"
    >
      <div 
        className={cn(
          "bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto",
          "animate-in fade-in-0 zoom-in-95 duration-300"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 id="avatar-modal-title" className="text-xl font-semibold">
              {isOwnProfile ? 'Your Avatar' : `${userName}'s Avatar`}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isOwnProfile 
                ? 'View your public and private avatar versions'
                : 'Avatar versions based on your relationship'
              }
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="rounded-full"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Public Avatar */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  <Eye className="h-3 w-3 mr-1" />
                  Public
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Visible to everyone
                </span>
              </div>
              
              <div className="relative group">
                <Avatar className="h-48 w-48 mx-auto border-2 border-muted">
                  <AvatarImage 
                    src={publicAvatar} 
                    alt={`${userName}'s public avatar`}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-muted">
                    <Users className="h-16 w-16" />
                  </AvatarFallback>
                </Avatar>
                
                {/* Download button for public avatar */}
                {publicAvatar && canDownload && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDownload(publicAvatar, 'public')}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                )}
              </div>

              <div className="text-center space-y-2">
                <p className="text-sm font-medium">Public Version</p>
                <p className="text-xs text-muted-foreground">
                  {isOwnProfile 
                    ? 'This is what everyone sees on your profile'
                    : 'This version is visible to all users'
                  }
                </p>
                {isOwnProfile && (
                  <p className="text-xs text-muted-foreground">
                    Face-swapped for privacy protection
                  </p>
                )}
              </div>
            </div>

            {/* Private Avatar */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                  <EyeOff className="h-3 w-3 mr-1" />
                  Private
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {isOwnProfile ? 'Visible to matches only' : 'Visible because you matched'}
                </span>
              </div>
              
              <div className="relative group">
                <Avatar className="h-48 w-48 mx-auto border-2 border-muted">
                  <AvatarImage 
                    src={privateAvatar} 
                    alt={`${userName}'s private avatar`}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-muted">
                    <Crown className="h-16 w-16" />
                  </AvatarFallback>
                </Avatar>
                
                {/* Download button for private avatar */}
                {privateAvatar && canDownload && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDownload(privateAvatar, 'private')}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                )}
              </div>

              <div className="text-center space-y-2">
                <p className="text-sm font-medium">Private Version</p>
                <p className="text-xs text-muted-foreground">
                  {isOwnProfile 
                    ? 'Your original photo, encrypted and only visible to matches'
                    : 'Original photo, visible because you matched'
                  }
                </p>
                {isOwnProfile && (
                  <p className="text-xs text-muted-foreground">
                    Encrypted with Seal Protocol
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* No avatars message */}
          {!publicAvatar && !privateAvatar && (
            <div className="text-center py-12">
              <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">No Avatar Available</p>
              <p className="text-muted-foreground">
                {isOwnProfile 
                  ? 'Upload an avatar to get started'
                  : 'This user hasn\'t uploaded an avatar yet'
                }
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border bg-muted/20">
          <div className="text-xs text-muted-foreground">
            {isOwnProfile ? (
              <span>💡 Tip: Your private avatar is encrypted and only visible to your matches</span>
            ) : (
              <span>🔒 This user's private avatar is visible because you matched</span>
            )}
          </div>
          
          <div className="flex gap-2">
            {canDownload && (publicAvatar || privateAvatar) && (
              <Button variant="outline" size="sm">
                <Share2 className="h-3 w-3 mr-1" />
                Share
              </Button>
            )}
            <Button onClick={onClose} size="sm">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}