import { auth } from "@/auth";
import { getMemberByUserId } from "@/app/actions/memberActions";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch member and user data in parallel
    const [member, user] = await Promise.all([
      getMemberByUserId(session.user.id),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          profileObjectId: true,
          walletAddress: true,
        },
      }),
    ]);

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Trust database instead of checking blockchain
    const hasOnChainProfile = !!user?.profileObjectId;
    const walletAddress = user?.walletAddress || session.user.id;

    return NextResponse.json({
      member,
      hasOnChainProfile,
      walletAddress,
    });
  } catch (error) {
    console.error("Error fetching profile data:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile data" },
      { status: 500 }
    );
  }
}
