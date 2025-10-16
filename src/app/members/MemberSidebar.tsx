"use client";

import PresenceDot from "@/components/PresenceDot";
import { calculateAge } from "@/lib/util";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { Member } from "@prisma/client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { ArrowLeft, MapPin, User, MessageSquare, Images, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import ClickableAvatar from "@/components/ClickableAvatar";
import AvatarViewModal from "@/components/AvatarViewModal";
import AvatarUploadModal from "@/components/AvatarUploadModal";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";

type Props = {
  member: Member;
  navLinks: { name: string; href: string }[];
};

const iconMap: Record<string, React.ElementType> = {
  Profile: User,
  Photos: Images,
  Chat: MessageSquare,
  Likes: Heart,
};

export default function MemberSidebar({ member, navLinks }: Props) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isAvatarModalOpen, setIsAvatarModalOpen] = React.useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isMounted, setIsMounted] = React.useState(false);
  const [avatarData, setAvatarData] = React.useState<{
    publicUrl?: string;
    privateUrl?: string;
  } | null>(null);

  // Check if this is current user's profile
  const isCurrentUser = session?.user?.id === member.userId;

  // Ensure component is mounted before rendering portal
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch user's avatar from avatar service
  React.useEffect(() => {
    const fetchAvatar = async () => {
      try {
        if (isCurrentUser) {
          // For current user, use avatar info API to get both avatars
          const response = await fetch('/api/avatar/info');
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              setAvatarData({
                publicUrl: data.data.publicUrl,
                privateUrl: data.data.privateUrl
              });
            }
          }
        } else {
          // For other users, use getAvatarForUser with match context
          const { getAvatarForUser } = await import('@/app/actions/avatarActions');
          const result = await getAvatarForUser(member.userId, session?.user?.id);
          
          console.log('MemberSidebar avatar result:', {
            targetUserId: member.userId,
            viewerUserId: session?.user?.id,
            result: result
          });
          
          if (result.status === 'success' && result.data) {
            // Set the appropriate URL based on what the service returned
            if (result.data.type === 'public') {
              console.log('Setting public avatar:', result.data.url);
              setAvatarData({
                publicUrl: result.data.url,
                privateUrl: undefined
              });
            } else if (result.data.type === 'private') {
              console.log('Setting private avatar:', result.data.url);
              setAvatarData({
                publicUrl: undefined,
                privateUrl: result.data.url
              });
            } else {
              console.log('No avatar or placeholder:', result.data.type);
              setAvatarData({
                publicUrl: undefined,
                privateUrl: undefined
              });
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch avatar:', error);
      }
    };

    fetchAvatar();
  }, [isCurrentUser, member.userId, session?.user?.id]);



  // Handle avatar modal actions
  const handleViewAvatar = () => {
    setIsAvatarModalOpen(true);
  };

  const handleUploadAvatar = () => {
    setIsUploadModalOpen(true);
  };

  const handleUploadComplete = async () => {
    // Refresh avatar data instead of reloading the page
    try {
      if (isCurrentUser) {
        const response = await fetch('/api/avatar/info');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setAvatarData({
              publicUrl: data.data.publicUrl,
              privateUrl: data.data.privateUrl
            });
          }
        }
      } else {
        // For other users, refresh with match context
        const { getAvatarForUser } = await import('@/app/actions/avatarActions');
        const result = await getAvatarForUser(member.userId, session?.user?.id);
        
        if (result.status === 'success' && result.data) {
          // Set the appropriate URL based on what the service returned
          if (result.data.type === 'public') {
            setAvatarData({
              publicUrl: result.data.url,
              privateUrl: undefined
            });
          } else if (result.data.type === 'private') {
            setAvatarData({
              publicUrl: undefined,
              privateUrl: result.data.url
            });
          } else {
            // Placeholder or error case
            setAvatarData({
              publicUrl: undefined,
              privateUrl: undefined
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to refresh avatar:', error);
    }
    
    // Close upload modal
    setIsUploadModalOpen(false);
    setSelectedFile(null);
  };

  const handleFileSelect = (file: File) => {
    // Set selected file and open upload modal
    setSelectedFile(file);
    setIsUploadModalOpen(true);
  };

  return (
    <Card className="w-full mt-10 border-0 shadow-xl bg-gradient-to-br from-background to-muted/20 md:sticky md:top-24">
      <CardHeader className="pb-0 px-4 md:px-6">
        <div className="flex flex-col items-center space-y-3 md:space-y-4 pt-4 md:pt-6">
          {/* Clickable Profile Avatar */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-pink-600 to-purple-600 rounded-full opacity-75 blur group-hover:opacity-100 transition duration-300" />
            <div className="relative">
              <ClickableAvatar
                currentAvatar={{
                  publicUrl: isCurrentUser 
                    ? (avatarData?.privateUrl || avatarData?.publicUrl || member.image || undefined)
                    : (avatarData?.publicUrl || avatarData?.privateUrl || member.image || undefined),
                  privateUrl: avatarData?.privateUrl || undefined
                }}
                onViewAvatar={handleViewAvatar}
                onUploadAvatar={handleUploadAvatar}
                onFileSelect={handleFileSelect}
                size="xl"
                userName={member.name}
                className="border-0"
              />
              <div className="absolute bottom-2 right-2">
                <PresenceDot member={member} />
              </div>
            </div>
          </div>

          {/* Name and Age */}
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-xl md:text-2xl font-bold tracking-tight">
                {member.name}
              </h2>
              <Badge variant="secondary" className="text-sm md:text-base">
                {calculateAge(member.dateOfBirth)}
              </Badge>
            </div>

            {/* Location */}
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="text-xs md:text-sm">
                {member.city}, {member.country}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 md:px-6 pt-4 md:pt-6">
        <Separator className="mb-4 md:mb-6" />

        {/* Navigation Links */}
        <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible">
          {navLinks.map((link) => {
            const Icon = iconMap[link.name] || User;
            const isActive = pathname === link.href;

            return (
              <Link
                href={link.href}
                key={link.name}
                className={cn(
                  "flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg font-semibold transition-all duration-300 group flex-shrink-0 md:flex-shrink",
                  isActive
                    ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/30"
                    : "hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 text-gray-700 hover:text-gray-900 hover:shadow-sm"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 md:h-5 md:w-5 transition-transform duration-300 group-hover:scale-110",
                    isActive ? "text-white" : "text-gray-600"
                  )}
                />
                <span className="text-sm md:text-base whitespace-nowrap">{link.name}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse shadow-sm hidden md:block" />
                )}
              </Link>
            );
          })}
        </nav>
      </CardContent>

      <CardFooter className="px-4 md:px-6 pb-4 md:pb-6">
        <div className="space-y-2 w-full">
          <Button
            asChild
            variant="outline"
            className="w-full group hover:bg-primary hover:text-primary-foreground transition-all duration-300"
          >
            <Link href="/members" className="flex items-center justify-center gap-2">
              <ArrowLeft className="h-3.5 w-3.5 md:h-4 md:w-4 transition-transform duration-300 group-hover:-translate-x-1" />
              <span className="text-sm md:text-base">Back to Match</span>
            </Link>
          </Button>
        </div>
      </CardFooter>

      {/* Modals rendered via portal after mount to avoid hydration issues */}
      {isMounted && createPortal(
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999999, pointerEvents: isAvatarModalOpen || isUploadModalOpen ? 'auto' : 'none' }}
          suppressHydrationWarning
        >
          <AvatarViewModal
            isOpen={isAvatarModalOpen}
            onClose={() => setIsAvatarModalOpen(false)}
            publicAvatar={member.image || undefined}
            privateAvatar={undefined} // TODO: Get from user avatar fields
            userName={member.name}
            canDownload={true}
            isOwnProfile={true}
          />

          <AvatarUploadModal
            isOpen={isUploadModalOpen}
            onClose={() => {
              setIsUploadModalOpen(false);
              setSelectedFile(null);
            }}
            onUploadComplete={handleUploadComplete}
            userName={member.name}
            preSelectedFile={selectedFile || undefined}
          />
        </div>,
        document.body
      )}
    </Card>
  );
}
