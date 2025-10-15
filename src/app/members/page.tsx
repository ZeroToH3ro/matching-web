import React from "react";
import { getRandomizedMembers, getAvatarUrlsForMembers, recordSwipe } from "../actions/swipeActions";
import { getAuthUserId } from "../actions/authActions";
import { getUserProfileObjectId } from "../actions/matchOnChainActions";
import SwipeContainerWithBlockchain from "@/components/SwipeContainerWithBlockchain";
import EmptyState from "@/components/EmptyState";

// Force dynamic rendering since we use auth headers
export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const { items: members, totalCount } = await getRandomizedMembers();
  const currentUserId = await getAuthUserId();
  const myProfileObjectId = await getUserProfileObjectId();

  if (members.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <EmptyState />
      </div>
    );
  }

  // Pre-fetch avatar URLs for all members
  const memberIds = members.map((m) => m.userId);
  const avatarUrls = await getAvatarUrlsForMembers(memberIds);

  // Server action for handling swipes
  async function handleSwipeAction(memberId: string, direction: "left" | "right") {
    "use server";
    return recordSwipe(memberId, direction);
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
          Discover Matches
        </h1>
      </div>

      {/* Swipe Container with Blockchain Support (Default) */}
      <SwipeContainerWithBlockchain
        initialMembers={members}
        avatarUrls={avatarUrls}
        onSwipeAction={handleSwipeAction}
        currentUserId={currentUserId}
        myProfileObjectId={myProfileObjectId}
        enableBlockchainByDefault={true}
      />
    </div>
  );
}
