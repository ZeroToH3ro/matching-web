import { auth } from "@/auth";
import { getAvatarUrlsForMembers } from "@/app/actions/swipeActions";
import { getUserProfileObjectId } from "@/app/actions/matchOnChainActions";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeAvatars = searchParams.get('includeAvatars') === 'true';

    // Optimized: Direct query without extra includes
    const members = await prisma.member.findMany({
      where: {
        userId: {
          not: session.user.id,
        },
      },
      select: {
        id: true,
        userId: true,
        name: true,
        image: true,
        gender: true,
        dateOfBirth: true,
        city: true,
        country: true,
        description: true,
        created: true,
        updated: true,
      },
      take: 20,
      orderBy: {
        updated: 'desc',
      },
    });

    // Shuffle
    const shuffled = members.sort(() => Math.random() - 0.5);

    if (shuffled.length === 0) {
      return NextResponse.json({
        members: [],
        totalCount: 0,
        avatarUrls: {},
        currentUserId: session.user.id,
        myProfileObjectId: null,
      });
    }

    // Get user data for members in a separate optimized query
    const userIds = shuffled.map(m => m.userId);
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
        profileObjectId: true,
        walletAddress: true,
      },
    });

    // Map user data to members
    const usersMap = new Map(users.map(u => [u.id, u]));
    const membersWithUser = shuffled.map(member => ({
      ...member,
      user: usersMap.get(member.userId) || {
        profileObjectId: null,
        walletAddress: null,
      },
    }));

    // Get profile object ID (fast - from database)
    const myProfileObjectId = await getUserProfileObjectId();

    // Conditionally fetch avatars (only when requested)
    let avatarUrls = {};
    if (includeAvatars) {
      avatarUrls = await getAvatarUrlsForMembers(userIds);
    }

    return NextResponse.json({
      members: membersWithUser,
      totalCount: membersWithUser.length,
      avatarUrls,
      currentUserId: session.user.id,
      myProfileObjectId,
    });
  } catch (error) {
    console.error("Error fetching swipe data:", error);
    return NextResponse.json(
      { error: "Failed to fetch swipe data" },
      { status: 500 }
    );
  }
}
