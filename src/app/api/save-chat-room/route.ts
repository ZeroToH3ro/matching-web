import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUserId } from '@/app/actions/authActions';

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId();
    const body = await request.json();

    const { chatRoomId, chatAllowlistId, currentUserId, targetUserId } = body;

    if (!chatRoomId || !chatAllowlistId || !currentUserId || !targetUserId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify user is authenticated and is one of the participants
    if (userId !== currentUserId && userId !== targetUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Save to database
    const chatRoom = await prisma.chatRoom.upsert({
      where: {
        chatRoomId,
      },
      update: {
        chatAllowlistId,
      },
      create: {
        chatRoomId,
        chatAllowlistId,
        participant1: currentUserId,
        participant2: targetUserId,
      },
    });

    console.log('[save-chat-room] Saved:', chatRoom);

    return NextResponse.json({
      success: true,
      chatRoom,
    });
  } catch (error: any) {
    console.error('[save-chat-room] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save chat room' },
      { status: 500 }
    );
  }
}
