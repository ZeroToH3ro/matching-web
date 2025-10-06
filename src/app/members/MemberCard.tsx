"use client";
import LikeButton from "@/components/LikeButton";
import LikeButtonWithBlockchain from "@/components/LikeButtonWithBlockchain";
import PresenceDot from "@/components/PresenceDot";
import { calculateAge } from "@/lib/util";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Member } from "@prisma/client";
import Link from "next/link";
import React from "react";
import { MapPin, Verified } from "lucide-react";
import Image from "next/image";

type Props = {
  member: Member & {
    user?: {
      profileObjectId: string | null;
      walletAddress: string | null;
    };
  };
  likeIds: string[];
  myProfileObjectId?: string | null;
};

export default function MemberCard({ member, likeIds, myProfileObjectId }: Props) {
  const hasLiked = likeIds.includes(member.userId);

  // Use blockchain-enabled button if both users have on-chain profiles
  const useBlockchainLike = !!(myProfileObjectId && member.user?.walletAddress);

  console.log("[MemberCard] Render:", {
    memberId: member.userId,
    memberName: member.name,
    useBlockchainLike,
    myProfileObjectId,
    memberWalletAddress: member.user?.walletAddress,
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
            <Image
              alt={member.name}
              fill
              src={member.image || "/images/user.png"}
              className="object-cover transition-transform duration-700 group-hover:scale-110"
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 16vw"
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
