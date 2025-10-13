"use client";
import LikeButton from "@/components/LikeButton";
import LikeButtonWithBlockchain from "@/components/LikeButtonWithBlockchain";
import PresenceDot from "@/components/PresenceDot";

import { calculateAge } from "@/lib/util";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Member } from "@prisma/client";
import Link from "next/link";
import React, { useState, useEffect, useCallback } from "react";
import { MapPin, Verified } from "lucide-react";
import Image from "next/image";
import { pusherClient } from "@/lib/pusher";

type Props = {
  member: Member & {
    user?: {
      profileObjectId: string | null;
      walletAddress: string | null;
    };
  };
  likeIds: string[];
  myProfileObjectId?: string | null;
  currentUserId?: string;
};

export default function MemberCard({ member, likeIds, myProfileObjectId, currentUserId }: Props) {
  const hasLiked = likeIds.includes(member.userId);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(member.image); // Start with fallback

  // Use blockchain-enabled button if both users have on-chain profiles
  const useBlockchainLike = !!(myProfileObjectId && member.user?.walletAddress);

  // Extract fetchAvatar as a callback so it can be reused
  const fetchAvatar = useCallback(async () => {
    try {
      console.log(`🔍 [MemberCard] Fetching avatar for ${member.name}:`, {
        targetUserId: member.userId,
        viewerUserId: currentUserId,
        hasCurrentUser: !!currentUserId
      });

      const { getAvatarForUser } = await import('@/app/actions/avatarActions');
      const result = await getAvatarForUser(member.userId, currentUserId);

      console.log(`📸 [MemberCard] Avatar result for ${member.name}:`, {
        status: result.status,
        type: result.data?.type,
        isEncrypted: result.data?.isEncrypted,
        hasAccess: result.data?.hasAccess,
        url: result.data?.url?.substring(0, 50) + '...'
      });

      if (result.status === 'success' && result.data) {
        setAvatarUrl(result.data.url);
      } else {
        // Fallback to member.image
        console.warn(`⚠️ [MemberCard] Avatar fetch failed for ${member.name}, using fallback`);
        setAvatarUrl(member.image);
      }
    } catch (error) {
      console.error(`❌ [MemberCard] Failed to fetch avatar for ${member.name}:`, error);
      setAvatarUrl(member.image);
    }
  }, [member.userId, currentUserId, member.image, member.name]);

  // Fetch appropriate avatar based on match status on mount
  useEffect(() => {
    fetchAvatar();
  }, [fetchAvatar]);

  // ✅ Listen for real-time avatar refresh events when users match
  useEffect(() => {
    if (!currentUserId) return;

    console.log(`🔌 [MemberCard] Subscribing to avatar:refresh for user ${currentUserId}`);
    const channel = pusherClient.subscribe(`private-${currentUserId}`);

    channel.bind('avatar:refresh', (data: { userId: string; reason: string }) => {
      console.log('🔄 [MemberCard] Avatar refresh event received:', data);

      // Refetch avatar if this is the user whose avatar should be refreshed
      if (data.userId === member.userId) {
        console.log(`✅ [MemberCard] Refreshing avatar for ${member.name} due to ${data.reason}`);
        fetchAvatar();
      }
    });

    return () => {
      console.log(`🔌 [MemberCard] Unsubscribing from avatar:refresh for user ${currentUserId}`);
      channel.unbind('avatar:refresh');
      pusherClient.unsubscribe(`private-${currentUserId}`);
    };
  }, [currentUserId, member.userId, fetchAvatar, member.name]);

  console.log("[MemberCard] Render:", {
    memberId: member.userId,
    memberName: member.name,
    useBlockchainLike,
    myProfileObjectId,
    memberWalletAddress: member.user?.walletAddress,
    avatarUrl
  });

  const preventLinkAction = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Link href={`/members/${member.userId}`} className="group block">
      <Card className="overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 bg-gradient-to-br from-background to-muted/20">
        <CardContent className="p-0 relative">
          {/* Image Container with Overlay */}
          <div className="relative aspect-[3/4] overflow-hidden">
            {/* Avatar with match-based display */}
            <Image
              alt={member.name}
              fill
              src={avatarUrl || "/images/user.png"}
              className="object-cover transition-transform duration-700 group-hover:scale-110"
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 16vw"
              onError={() => {
                console.log('Image load failed, falling back to placeholder');
                setAvatarUrl("/images/user.png");
              }}
            />

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-500" />

            {/* Top Actions */}
            <div onClick={preventLinkAction} className="absolute top-0 left-0 right-0 p-3 flex justify-between items-start z-20">
              <div className="flex gap-2 items-center">
                <PresenceDot member={member} />
                {member.userId && (
                  <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm hover:bg-background/90 transition-colors">
                    <Verified className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </div>
              <div className="transform transition-transform duration-300 group-hover:scale-110">
                {useBlockchainLike && member.user?.walletAddress ? (
                  <LikeButtonWithBlockchain
                    targetId={member.userId}
                    targetUserAddress={member.user.walletAddress}
                    hasLiked={hasLiked}
                    myProfileObjectId={myProfileObjectId!}
                  />
                ) : (
                  <LikeButton targetId={member.userId} hasLiked={hasLiked} />
                )}
              </div>
            </div>

            {/* Bottom Info */}
            <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    {member.name}
                  </h3>
                  <span className="text-lg font-medium text-white/90">
                    {calculateAge(member.dateOfBirth)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-white/80">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="text-sm font-medium">
                    {member.city}
                  </span>
                </div>
              </div>

              {/* Hover: Show Description Preview */}
              <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 max-h-0 group-hover:max-h-20 overflow-hidden">
                <p className="text-sm text-white/70 line-clamp-2">
                  {member.description || "No description available"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
