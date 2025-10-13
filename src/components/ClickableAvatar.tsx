"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { 
  Eye, 
  Upload, 
  Users, 
  MoreVertical,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClickableAvatarProps {
  currentAvatar?: {
    publicUrl?: string;
    privateUrl?: string;
  };
  onViewAvatar: () => void;
  onUploadAvatar: () => void;
  onFileSelect?: (file: File) => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showMenu?: boolean;
  userName?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
  xl: 'h-40 w-40'
};

const iconSizes = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4', 
  lg: 'h-5 w-5',
  xl: 'h-8 w-8'
};

export default function ClickableAvatar({
  currentAvatar,
  onViewAvatar,
  onUploadAvatar,
  onFileSelect,
  size = 'lg',
  className,
  showMenu = true,
  userName
}: ClickableAvatarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMenuOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (showMenu) {
        setIsMenuOpen(!isMenuOpen);
      } else {
        onViewAvatar();
      }
    } else if (event.key === 'Escape') {
      setIsMenuOpen(false);
    }
  };

  const handleAvatarClick = () => {
    if (showMenu) {
      setIsMenuOpen(!isMenuOpen);
    } else {
      onViewAvatar();
    }
  };

  const handleMenuAction = (action: 'view' | 'upload' | 'browse') => {
    setIsMenuOpen(false);
    if (action === 'view') {
      onViewAvatar();
    } else if (action === 'upload') {
      onUploadAvatar();
    } else if (action === 'browse') {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileSelect) {
      onFileSelect(file);
    }
  };

  const hasAvatar = currentAvatar?.publicUrl || currentAvatar?.privateUrl;

  return (
    <div className={cn("relative inline-block", className)}>
      {/* Avatar Button */}
      <button
        ref={buttonRef}
        onClick={handleAvatarClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "relative group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full transition-all duration-200",
          "hover:scale-105 active:scale-95",
          isHovered && "shadow-lg"
        )}
        aria-label={hasAvatar ? "View or upload avatar" : "Upload avatar"}
        tabIndex={0}
      >
        <Avatar 
          className={cn(sizeClasses[size], "transition-all duration-200 border-0", className)}
          style={{ border: 'none', outline: 'none' }}
        >
          <AvatarImage 
            src={currentAvatar?.publicUrl} 
            alt={userName ? `${userName}'s avatar` : "User avatar"}
            style={{ border: 'none' }}
          />
          <AvatarFallback 
            className="bg-muted border-0"
            style={{ border: 'none' }}
          >
            <Users className={iconSizes[size]} />
          </AvatarFallback>
        </Avatar>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Hover Overlay */}
        {showMenu && (
          <div 
            className={cn(
              "absolute inset-0 bg-black/40 rounded-full flex items-center justify-center transition-opacity duration-200",
              isHovered || isMenuOpen ? "opacity-100" : "opacity-0"
            )}
          >
            <ChevronDown className={cn(iconSizes[size], "text-white")} />
          </div>
        )}

        {/* Menu Indicator */}
        {showMenu && (
          <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1">
            <MoreVertical className="h-2 w-2" />
          </div>
        )}
      </button>

      {/* Context Menu */}
      {showMenu && isMenuOpen && (
        <div
          ref={menuRef}
          className={cn(
            "absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50",
            "bg-background border border-border rounded-lg shadow-lg min-w-[160px]",
            "animate-in fade-in-0 zoom-in-95 duration-200"
          )}
          role="menu"
          aria-orientation="vertical"
        >
          <div className="py-1">
            {/* View Avatar Option */}
            {hasAvatar && (
              <button
                onClick={() => handleMenuAction('view')}
                className={cn(
                  "w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors",
                  "flex items-center gap-2 focus:outline-none focus:bg-muted"
                )}
                role="menuitem"
              >
                <Eye className="h-4 w-4" />
                View Avatar
              </button>
            )}

            {/* Browse Files Option */}
            <button
              onClick={() => handleMenuAction('browse')}
              className={cn(
                "w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors",
                "flex items-center gap-2 focus:outline-none focus:bg-muted"
              )}
              role="menuitem"
            >
              <Upload className="h-4 w-4" />
              {hasAvatar ? 'Change Avatar' : 'Upload Avatar'}
            </button>

            {/* Upload Modal Option (if onFileSelect not provided) */}
            {!onFileSelect && (
              <button
                onClick={() => handleMenuAction('upload')}
                className={cn(
                  "w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors",
                  "flex items-center gap-2 focus:outline-none focus:bg-muted"
                )}
                role="menuitem"
              >
                <Upload className="h-4 w-4" />
                Upload Options
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}