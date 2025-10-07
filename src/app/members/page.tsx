import React from "react";
import { getMembers } from "../actions/memberActions";
import MemberCard from "./MemberCard";
import { fetchCurrentUserLikeIds } from "../actions/likeActions";
import PaginationComponent from "@/components/PaginationComponent";
import type { GetMemberParams } from "@/types";
import EmptyState from "@/components/EmptyState";
import { getUserProfileObjectId } from "../actions/matchOnChainActions";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: GetMemberParams;
}) {
  const { items: members, totalCount } = await getMembers(searchParams) as { items: any[]; totalCount: number };

  const likeIds = await fetchCurrentUserLikeIds();
  const myProfileObjectId = await getUserProfileObjectId();

  if (members.length === 0) return <EmptyState />;

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
          Discover Matches
        </h1>
        <p className="text-muted-foreground">
          {totalCount} {totalCount === 1 ? "person" : "people"} waiting to connect with you
        </p>
      </div>

      {/* Members Grid with Staggered Animation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 animate-in fade-in duration-700">
        {members.map((member, index) => (
          <div
            key={member.id}
            style={{
              animationDelay: `${index * 75}ms`,
              animationFillMode: "backwards",
            }}
            className="animate-in fade-in slide-in-from-bottom-4"
          >
            <MemberCard
              member={member}
              likeIds={likeIds}
              myProfileObjectId={myProfileObjectId}
            />
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-center pt-4">
        <PaginationComponent totalCount={totalCount} />
      </div>
    </div>
  );
}
