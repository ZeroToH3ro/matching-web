import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET /api/admin/avatar/moderation - Get moderation queue
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user has admin role (you may want to implement proper role checking)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause based on status filter
    let whereClause: any = {};
    
    if (status === 'pending') {
      whereClause.avatarSettings = {
        path: ['moderationStatus'],
        equals: 'pending'
      };
    } else if (status === 'approved') {
      whereClause.avatarSettings = {
        path: ['moderationStatus'],
        equals: 'approved'
      };
    } else if (status === 'rejected') {
      whereClause.avatarSettings = {
        path: ['moderationStatus'],
        equals: 'rejected'
      };
    }

    // Only include users with avatars
    whereClause.publicAvatarBlobId = { not: null };

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        publicAvatarBlobId: true,
        privateAvatarBlobId: true,
        avatarUploadedAt: true,
        avatarSettings: true,
        member: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        avatarUploadedAt: 'desc'
      },
      take: limit,
      skip: offset
    });

    // Get report counts for each user (this would need a reports table in a real implementation)
    // For now, we'll simulate report counts
    const items = users.map(user => {
      const settings = user.avatarSettings as any || {};
      const reportCount = Math.floor(Math.random() * 5); // Simulated report count
      
      return {
        id: user.id,
        userId: user.id,
        userName: user.member?.name || user.name || 'Unknown User',
        avatarUrl: user.publicAvatarBlobId ? `/api/avatar/${user.id}` : '/placeholder-avatar.png',
        uploadedAt: user.avatarUploadedAt?.toISOString() || new Date().toISOString(),
        status: settings.moderationStatus || 'pending',
        reportCount,
        flaggedReason: settings.flaggedReason,
        moderatedBy: settings.moderatedBy,
        moderatedAt: settings.moderatedAt
      };
    });

    // Get total count for pagination
    const totalCount = await prisma.user.count({
      where: whereClause
    });

    return NextResponse.json({
      success: true,
      items,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    });

  } catch (error) {
    console.error('Failed to get moderation queue:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get moderation queue',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}