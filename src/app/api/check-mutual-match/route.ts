import { getAuthUserId } from "@/app/actions/authActions";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { targetUserId } = await req.json();
    const currentUserId = await getAuthUserId();

    // Check if target user has liked current user
    const reverseLike = await prisma.like.findUnique({
      where: {
        sourceUserId_targetUserId: {
          sourceUserId: targetUserId,
          targetUserId: currentUserId,
        },
      },
    });

    return NextResponse.json({
      isMutualMatch: !!reverseLike,
    });
  } catch (error) {
    console.error("[API] Check mutual match error:", error);
    return NextResponse.json(
      { isMutualMatch: false, error: "Failed to check mutual match" },
      { status: 500 }
    );
  }
}
