'use server';

import { prisma } from '@/lib/prisma';
import type { Member, Photo } from '@prisma/client';
import { addYears } from 'date-fns';
import { getAuthUserId } from './authActions';
import type { GetMemberParams, PaginatedResponse } from '@/types';
import { unstable_cache } from 'next/cache';
import { CACHE_TAGS, CACHE_REVALIDATE } from '@/lib/cache';

export type MemberWithUser = Member & {
    user: {
        profileObjectId: string | null;
        walletAddress: string | null;
    };
};

function getAgeRange(ageRange: string): Date[] {
    const [minAge, maxAge] = ageRange.split(',');
    const currentDate = new Date();
    const minDob = addYears(currentDate, -maxAge - 1);
    const maxDob = addYears(currentDate, -minAge);

    return [minDob, maxDob];
}

// Cache key generator
const getCacheKey = (params: GetMemberParams, userId: string) => {
    return `members-${userId}-${JSON.stringify(params)}`;
};

// Cached member count function
const getCachedMemberCount = unstable_cache(
    async (whereClause: any) => {
        return await prisma.member.count(whereClause);
    },
    ['member-count'],
    {
        revalidate: CACHE_REVALIDATE.MEDIUM,
        tags: [CACHE_TAGS.MEMBERS]
    }
);

// Main query function
async function fetchMembers({
    ageRange = '18,100',
    gender = 'male,female',
    orderBy = 'updated',
    pageNumber = '1',
    pageSize = '12',
    userId
}: GetMemberParams & { userId: string }): Promise<PaginatedResponse<MemberWithUser>> {
    const [minDob, maxDob] = getAgeRange(ageRange);
    const selectedGender = gender.split(',');
    const page = parseInt(pageNumber);
    const limit = parseInt(pageSize);
    const skip = (page - 1) * limit;

    const membersSelect = {
        where: {
            AND: [
                { dateOfBirth: { gte: minDob } },
                { dateOfBirth: { lte: maxDob } },
                { gender: { in: selectedGender } },
            ],
            NOT: {
                userId
            }
        },
    };

    const count = await getCachedMemberCount(membersSelect);

    const members = await prisma.member.findMany({
        ...membersSelect,
        orderBy: { [orderBy]: 'desc' },
        skip,
        take: limit,
        include: {
            user: {
                select: {
                    profileObjectId: true,
                    walletAddress: true,
                }
            }
        }
    });

    // Sync wallet addresses in background (non-blocking)
    // If walletAddress is missing but userId is a valid wallet, use userId as fallback
    const membersWithWallets = members.map((member) => {
        if (!member.user.walletAddress && member.userId.startsWith('0x')) {
            // Sync in background without blocking the response
            prisma.user.update({
                where: { id: member.userId },
                data: { walletAddress: member.userId }
            }).catch((error) => {
                console.error(`[getMembers] Failed to sync wallet for ${member.userId}:`, error);
            });

            // Use userId as walletAddress for this response
            member.user.walletAddress = member.userId;
        }
        return member;
    });

    return {
        items: membersWithWallets,
        totalCount: count
    };
}

// Export wrapper with caching
export async function getMembers(params: GetMemberParams): Promise<PaginatedResponse<MemberWithUser>> {
    const userId = await getAuthUserId();

    try {
        return await fetchMembers({ ...params, userId });
    } catch (error) {
        console.log(error);
        throw error;
    }
}

export async function getMemberByUserId(userId: string) {
    try {
        return prisma.member.findUnique({ where: { userId } })
    } catch (error) {
        console.log(error);
    }
}

export async function getMemberPhotosByUserId(userId: string) {
    const currentUserId = await getAuthUserId();

    const member = await prisma.member.findUnique({
        where: { userId },
        select: { photos: { where: currentUserId === userId ? {} : { isApproved: true } } }
    });

    if (!member) return null;

    return member.photos.map(p => p) as Photo[];
}

export async function updateLastActive() {
    const userId = await getAuthUserId();

    try {
        return prisma.member.update({
            where: { userId },
            data: { updated: new Date() }
        })
    } catch (error) {
        console.log(error);
        throw error;
    }
}