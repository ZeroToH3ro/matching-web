"use client";

import { useState, useEffect } from "react";
import SwipeContainerWithBlockchain from "@/components/SwipeContainerWithBlockchain";
import EmptyState from "@/components/EmptyState";
import { recordSwipe } from "../actions/swipeActions";
import { Spinner } from "@nextui-org/react";

export default function MembersClient() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch members WITH avatars (needed for display)
        const response = await fetch('/api/members/swipe-data?includeAvatars=true');

        if (!response.ok) {
          throw new Error('Failed to fetch members');
        }

        const swipeData = await response.json();
        setData(swipeData);

        // Then fetch avatars in background if needed
        // This keeps the initial page load fast
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load members');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            Discover Matches
          </h1>
        </div>
        <div className="flex justify-center items-center p-12">
          <Spinner size="lg" label="Finding matches for you..." />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            Discover Matches
          </h1>
        </div>
        <div className="p-6 text-center bg-red-50 rounded-lg border border-red-200">
          <p className="text-red-600">{error || 'Failed to load matches'}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-red-700 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (data.members.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <EmptyState />
      </div>
    );
  }

  const handleSwipeAction = async (memberId: string, direction: "left" | "right") => {
    return recordSwipe(memberId, direction);
  };

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
        initialMembers={data.members}
        avatarUrls={data.avatarUrls}
        onSwipeAction={handleSwipeAction}
        currentUserId={data.currentUserId}
        myProfileObjectId={data.myProfileObjectId}
        enableBlockchainByDefault={true}
      />
    </div>
  );
}
