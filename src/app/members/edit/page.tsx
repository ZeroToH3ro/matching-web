import React from "react";
import dynamic from "next/dynamic";
import { getAuthUserId } from "@/app/actions/authActions";
import { getMemberByUserId } from "@/app/actions/memberActions";
import { notFound } from "next/navigation";
import CardInnerWrapper from "@/components/CardInnerWrapper";
import { prisma } from "@/lib/prisma";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { checkProfileExists } from "@/lib/contracts/matchingMe";

// Disable SSR for EditForm to avoid hydration errors
const EditForm = dynamic(() => import("./EditForm"), {
  ssr: false,
  loading: () => <div className="text-center p-4">Loading form...</div>,
});

export default async function MemberEditPage() {
  const userId = await getAuthUserId();

  const member = await getMemberByUserId(userId);

  if (!member) return notFound();

  // Get user wallet info from database
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      profileObjectId: true,
      walletAddress: true,
    },
  });

  let hasOnChainProfile = false;

  console.log("[EditPage] User data:", {
    userId,
    walletAddress: user?.walletAddress,
    profileObjectId: user?.profileObjectId,
  });

  // If wallet connected, check on blockchain
  if (user?.walletAddress) {
    try {
      const client = new SuiClient({ url: getFullnodeUrl("testnet") });
      const result = await checkProfileExists(client, user.walletAddress);

      hasOnChainProfile = result.exists;

      console.log("[EditPage] Blockchain check result:", {
        walletAddress: user.walletAddress,
        onChainExists: result.exists,
        onChainProfileId: result.profileId,
        dbProfileId: user.profileObjectId,
      });

      // Sync database if needed
      if (result.exists && result.profileId && user.profileObjectId !== result.profileId) {
        console.warn("[EditPage] Database profileObjectId mismatch, updating...");
        await prisma.user.update({
          where: { id: userId },
          data: { profileObjectId: result.profileId },
        });
      }
    } catch (error) {
      console.error("[EditPage] Error checking on-chain profile:", error);
      // Don't fallback to database - if blockchain check fails, profile doesn't exist
      hasOnChainProfile = false;
    }
  } else {
    console.log("[EditPage] No wallet address, profile does not exist");
  }

  console.log("[EditPage] Final hasOnChainProfile:", hasOnChainProfile);

  return (
    <CardInnerWrapper
      header="Edit Profile"
      body={<EditForm member={member} hasOnChainProfile={hasOnChainProfile} />}
    />
  );
}
