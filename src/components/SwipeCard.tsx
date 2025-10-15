"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Verified, Heart, X, Info } from "lucide-react";
import Image from "next/image";
import { calculateAge } from "@/lib/util";
import type { Member } from "@prisma/client";
import PresenceDot from "@/components/PresenceDot";

type Props = {
  member: Member & {
    user?: {
      profileObjectId: string | null;
      walletAddress: string | null;
    };
  };
  avatarUrl: string | null;
  onSwipe: (direction: "left" | "right") => void;
  onInfoClick: () => void;
};

export default function SwipeCard({ member, avatarUrl, onSwipe, onInfoClick }: Props) {
  const [exitX, setExitX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  // Color overlay for swipe feedback
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    
    const swipeThreshold = 100;
    
    if (info.offset.x > swipeThreshold) {
      // Swiped right - Like
      setExitX(300);
      onSwipe("right");
    } else if (info.offset.x < -swipeThreshold) {
      // Swiped left - Pass
      setExitX(-300);
      onSwipe("left");
    } else {
      // Return to center
      x.set(0);
    }
  };

  return (
    <motion.div
      ref={cardRef}
      style={{
        x,
        rotate,
        opacity,
        cursor: isDragging ? "grabbing" : "grab",
      }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      animate={exitX !== 0 ? { x: exitX } : {}}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="absolute w-full max-w-sm select-none"
    >
      <Card className="overflow-hidden border-2 shadow-2xl bg-gradient-to-br from-background to-muted/20">
        <CardContent className="p-0 relative">
          {/* Swipe Feedback Overlays */}
          <motion.div
            style={{ opacity: likeOpacity }}
            className="absolute inset-0 z-10 bg-green-500/30 flex items-center justify-center pointer-events-none"
          >
            <div className="border-4 border-green-500 rounded-full p-4 rotate-[-20deg]">
              <Heart className="h-16 w-16 text-green-500 fill-green-500" />
            </div>
          </motion.div>

          <motion.div
            style={{ opacity: nopeOpacity }}
            className="absolute inset-0 z-10 bg-red-500/30 flex items-center justify-center pointer-events-none"
          >
            <div className="border-4 border-red-500 rounded-full p-4 rotate-[20deg]">
              <X className="h-16 w-16 text-red-500" strokeWidth={4} />
            </div>
          </motion.div>

          {/* Image Container */}
          <div className="relative aspect-[3/4]">
            <Image
              alt={member.name}
              fill
              src={avatarUrl || "/images/user.png"}
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 500px"
              priority
              draggable={false}
            />

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {/* Top Badge */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-20">
              <div className="flex gap-2 items-center">
                <PresenceDot member={member} />
                {member.userId && (
                  <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                    <Verified className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </div>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onInfoClick();
                }}
                className="bg-background/80 backdrop-blur-sm rounded-full p-2 hover:bg-background transition-colors"
              >
                <Info className="h-5 w-5" />
              </button>
            </div>

            {/* Bottom Info */}
            <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
              <div className="space-y-3">
                <div className="flex items-baseline gap-3">
                  <h2 className="text-3xl font-bold text-white tracking-tight">
                    {member.name}
                  </h2>
                  <span className="text-2xl font-medium text-white/90">
                    {calculateAge(member.dateOfBirth)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-white/90">
                  <MapPin className="h-4 w-4" />
                  <span className="text-base font-medium">{member.city}</span>
                </div>

                {member.description && (
                  <p className="text-sm text-white/80 line-clamp-3 mt-2">
                    {member.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
