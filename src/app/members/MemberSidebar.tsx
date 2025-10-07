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
import Image from "next/image";
import { cn } from "@/lib/utils";

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

  return (
    <Card className="w-full mt-10 border-0 shadow-xl bg-gradient-to-br from-background to-muted/20 sticky top-24">
      <CardHeader className="pb-0">
        <div className="flex flex-col items-center space-y-4 pt-6">
          {/* Profile Image with Ring */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-pink-600 to-purple-600 rounded-full opacity-75 blur group-hover:opacity-100 transition duration-300" />
            <div className="relative">
              <Image
                height={160}
                width={160}
                src={member.image || "/images/user.png"}
                alt="User profile"
                className="rounded-full aspect-square object-cover ring-4 ring-background"
              />
              <div className="absolute bottom-2 right-2">
                <PresenceDot member={member} />
              </div>
            </div>
          </div>

          {/* Name and Age */}
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">
                {member.name}
              </h2>
              <Badge variant="secondary" className="text-base">
                {calculateAge(member.dateOfBirth)}
              </Badge>
            </div>

            {/* Location */}
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span className="text-sm">
                {member.city}, {member.country}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-6 pt-6">
        <Separator className="mb-6" />

        {/* Navigation Links */}
        <nav className="space-y-2">
          {navLinks.map((link) => {
            const Icon = iconMap[link.name] || User;
            const isActive = pathname === link.href;

            return (
              <Link
                href={link.href}
                key={link.name}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg font-semibold transition-all duration-300 group",
                  isActive
                    ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/30"
                    : "hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 text-gray-700 hover:text-gray-900 hover:shadow-sm"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform duration-300 group-hover:scale-110",
                    isActive ? "text-white" : "text-gray-600"
                  )}
                />
                <span className="text-base">{link.name}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse shadow-sm" />
                )}
              </Link>
            );
          })}
        </nav>
      </CardContent>

      <CardFooter className="px-6 pb-6">
        <Button
          asChild
          variant="outline"
          className="w-full group hover:bg-primary hover:text-primary-foreground transition-all duration-300"
        >
          <Link href="/members" className="flex items-center justify-center gap-2">
            <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
            <span>Back to Browse</span>
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
