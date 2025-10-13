import { getMemberByUserId } from "@/app/actions/memberActions";
import { getAuthUserId } from "@/app/actions/authActions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { calculateAge } from "@/lib/util";
import { notFound } from "next/navigation";
import React from "react";
import { MapPin, Calendar, Heart } from "lucide-react";

export default async function MemberDetailedPage({
  params,
}: {
  params: { userId: string };
}) {
  const member = await getMemberByUserId(params.userId);
  const currentUserId = await getAuthUserId();

  if (!member) return notFound();

  const age = calculateAge(member.dateOfBirth);
  const isOwnProfile = currentUserId === params.userId;

  return (
    <div className="space-y-8 px-2">
      {/* Profile Header - Clean & Left-aligned */}
      <div className="space-y-6">
        {/* Name & Badge */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {member.name}
            </h1>
            {isOwnProfile && (
              <Badge variant="secondary" className="text-xs">
                Your Profile
              </Badge>
            )}
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid gap-3 text-base">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span>{age} years old</span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span>{member.city}, {member.country}</span>
          </div>

          {!isOwnProfile && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1.5">
                <Heart className="h-3 w-3" />
                Available
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Profile Description */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-4">About {isOwnProfile ? 'You' : member.name}</h2>
          <p className="text-muted-foreground leading-relaxed">
            {member.description || `${member.name} hasn't written a description yet.`}
          </p>
        </CardContent>
      </Card>

      {/* Additional sections can be added here */}
      {isOwnProfile && (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Profile Management</h2>
            <p className="text-muted-foreground mb-4">
              Manage your profile settings and avatar privacy.
            </p>
            <div className="flex gap-3">
              <a 
                href="/members/edit" 
                className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Edit Profile
              </a>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
