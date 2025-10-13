import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// POST /api/admin/avatar/moderation/[itemId] - Moderate avatar
export async function POST(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user has admin role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, name: true }
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { itemId } = params;
    const body = await request.json();
    const { action, reason } = body;

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    // Get the user being moderated
    const targetUser = await prisma.user.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        avatarSettings: true,
        publicAvatarBlobId: true,
        privateAvatarBlobId: true
      }
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!targetUser.publicAvatarBlobId) {
      return NextResponse.json(
        { error: 'User has no avatar to moderate' },
        { status: 400 }
      );
    }

    // Update avatar settings with moderation decision
    const currentSettings = targetUser.avatarSettings as any || {};
    const updatedSettings = {
      ...currentSettings,
      moderationStatus: action === 'approve' ? 'approved' : 'rejected',
      moderatedBy: user.name || session.user.id,
      moderatedAt: new Date().toISOString(),
      ...(action === 'reject' && reason && { rejectionReason: reason })
    };

    // If rejecting, we might want to disable the avatar
    if (action === 'reject') {
      updatedSettings.enabled = false;
    }

    await prisma.user.update({
      where: { id: itemId },
      data: {
        avatarSettings: updatedSettings
      }
    });

    // Log the moderation action (in a real implementation, you'd have a moderation log table)
    console.log(`Avatar moderation: ${action} for user ${itemId} by ${session.user.id}`, {
      action,
      reason,
      moderatedBy: session.user.id,
      timestamp: new Date().toISOString()
    });

    // If this was a rejection, you might want to notify the user
    if (action === 'reject') {
      // TODO: Send notification to user about avatar rejection
      console.log(`Avatar rejected for user ${itemId}: ${reason}`);
    }

    return NextResponse.json({
      success: true,
      message: `Avatar ${action}d successfully`,
      data: {
        userId: itemId,
        action,
        moderatedBy: user.name || session.user.id,
        moderatedAt: new Date().toISOString(),
        reason
      }
    });

  } catch (error) {
    console.error('Failed to moderate avatar:', error);
    return NextResponse.json(
      { 
        error: 'Failed to moderate avatar',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}