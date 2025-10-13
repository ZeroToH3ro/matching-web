import React from "react";
import {
  fetchCurrentUserLikeIds,
  fetchLikedMembers,
} from "../actions/likeActions";
import { getAuthUserId } from "../actions/authActions";
import { getUserProfileObjectId } from "../actions/matchOnChainActions";
import ListsTab from "./ListsTab";

export const dynamic = "force-dynamic";

export default async function ListsPage({
  searchParams,
}: {
  searchParams: { type: string };
}) {
  const likeIds = await fetchCurrentUserLikeIds();
  const members = await fetchLikedMembers(
    searchParams.type
  );
  const currentUserId = await getAuthUserId();
  const myProfileObjectId = await getUserProfileObjectId();

  return (
    <div>
      <ListsTab
        members={members}
        likeIds={likeIds}
        currentUserId={currentUserId}
        myProfileObjectId={myProfileObjectId}
      />
    </div>
  );
}
