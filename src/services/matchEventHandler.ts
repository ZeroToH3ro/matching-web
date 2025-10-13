import { prisma } from '@/lib/prisma';
import { updateAvatarPermissions } from '@/app/actions/avatarActions';

export interface MatchEvent {
  type: 'match_created' | 'match_deleted' | 'match_blocked';
  userA: string;
  userB: string;
  matchId?: string;
  timestamp: Date;
}

export class MatchEventHandler {
  /**
   * Handles match creation events and grants avatar access
   */
  async handleMatchCreated(userA: string, userB: string, matchId?: string): Promise<void> {
    try {
      console.log(`[MatchEventHandler] Processing match created: ${userA} <-> ${userB}`);

      // Grant avatar access for both users
      await Promise.allSettled([
        this.grantAvatarAccess(userA, userB),
        this.grantAvatarAccess(userB, userA)
      ]);

      // Update match status in database to indicate mutual match
      await this.updateMatchStatus(userA, userB, 1); // 1 = active match

      console.log(`[MatchEventHandler] Avatar access granted for match: ${userA} <-> ${userB}`);

    } catch (error) {
      console.error('[MatchEventHandler] Failed to handle match created:', error);
      // Don't throw - this is a background operation
    }
  }

  /**
   * Handles match deletion events and revokes avatar access
   */
  async handleMatchDeleted(userA: string, userB: string): Promise<void> {
    try {
      console.log(`[MatchEventHandler] Processing match deleted: ${userA} <-> ${userB}`);

      // Revoke avatar access for both users
      await Promise.allSettled([
        this.revokeAvatarAccess(userA, userB),
        this.revokeAvatarAccess(userB, userA)
      ]);

      // Remove match records from database
      await this.removeMatchRecords(userA, userB);

      console.log(`[MatchEventHandler] Avatar access revoked for deleted match: ${userA} <-> ${userB}`);

    } catch (error) {
      console.error('[MatchEventHandler] Failed to handle match deleted:', error);
      // Don't throw - this is a background operation
    }
  }

  /**
   * Handles match blocking events and revokes avatar access
   */
  async handleMatchBlocked(userA: string, userB: string): Promise<void> {
    try {
      console.log(`[MatchEventHandler] Processing match blocked: ${userA} <-> ${userB}`);

      // Revoke avatar access for both users
      await Promise.allSettled([
        this.revokeAvatarAccess(userA, userB),
        this.revokeAvatarAccess(userB, userA)
      ]);

      // Update match status to blocked
      await this.updateMatchStatus(userA, userB, 3); // 3 = blocked

      console.log(`[MatchEventHandler] Avatar access revoked for blocked match: ${userA} <-> ${userB}`);

    } catch (error) {
      console.error('[MatchEventHandler] Failed to handle match blocked:', error);
      // Don't throw - this is a background operation
    }
  }

  /**
   * Detects mutual matches and triggers match creation
   */
  async detectAndHandleMutualMatch(likerUserId: string, likedUserId: string): Promise<boolean> {
    try {
      // Check if the liked user has already liked the liker (mutual match)
      const reverseLike = await prisma.like.findUnique({
        where: {
          sourceUserId_targetUserId: {
            sourceUserId: likedUserId,
            targetUserId: likerUserId
          }
        }
      });

      if (reverseLike) {
        // Mutual match detected!
        console.log(`[MatchEventHandler] Mutual match detected: ${likerUserId} <-> ${likedUserId}`);
        
        await this.handleMatchCreated(likerUserId, likedUserId);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[MatchEventHandler] Failed to detect mutual match:', error);
      return false;
    }
  }

  /**
   * Handles like removal and checks if match should be deleted
   */
  async handleLikeRemoved(likerUserId: string, likedUserId: string): Promise<void> {
    try {
      // Check if there was a mutual match
      const wasMatch = await this.checkIfWasMatch(likerUserId, likedUserId);
      
      if (wasMatch) {
        // Match is broken, revoke avatar access
        await this.handleMatchDeleted(likerUserId, likedUserId);
      }
    } catch (error) {
      console.error('[MatchEventHandler] Failed to handle like removed:', error);
    }
  }

  /**
   * Grants avatar access between two users
   */
  private async grantAvatarAccess(ownerUserId: string, viewerUserId: string): Promise<void> {
    try {
      await updateAvatarPermissions(ownerUserId, viewerUserId, 'grant');
    } catch (error) {
      console.error(`[MatchEventHandler] Failed to grant avatar access: ${ownerUserId} -> ${viewerUserId}`, error);
    }
  }

  /**
   * Revokes avatar access between two users
   */
  private async revokeAvatarAccess(ownerUserId: string, viewerUserId: string): Promise<void> {
    try {
      await updateAvatarPermissions(ownerUserId, viewerUserId, 'revoke');
    } catch (error) {
      console.error(`[MatchEventHandler] Failed to revoke avatar access: ${ownerUserId} -> ${viewerUserId}`, error);
    }
  }

  /**
   * Updates match status in the database
   */
  private async updateMatchStatus(userA: string, userB: string, status: number): Promise<void> {
    try {
      // Update both directions of the like relationship
      await prisma.like.updateMany({
        where: {
          OR: [
            { sourceUserId: userA, targetUserId: userB },
            { sourceUserId: userB, targetUserId: userA }
          ]
        },
        data: { matchStatus: status }
      });
    } catch (error) {
      console.error('[MatchEventHandler] Failed to update match status:', error);
    }
  }

  /**
   * Removes match records from database
   */
  private async removeMatchRecords(userA: string, userB: string): Promise<void> {
    try {
      // Delete both like records
      await prisma.like.deleteMany({
        where: {
          OR: [
            { sourceUserId: userA, targetUserId: userB },
            { sourceUserId: userB, targetUserId: userA }
          ]
        }
      });
    } catch (error) {
      console.error('[MatchEventHandler] Failed to remove match records:', error);
    }
  }

  /**
   * Checks if two users had a mutual match
   */
  private async checkIfWasMatch(userA: string, userB: string): Promise<boolean> {
    try {
      const matches = await prisma.like.findMany({
        where: {
          OR: [
            { sourceUserId: userA, targetUserId: userB },
            { sourceUserId: userB, targetUserId: userA }
          ],
          matchStatus: 1 // Active match
        }
      });

      return matches.length === 2; // Both users liked each other
    } catch (error) {
      console.error('[MatchEventHandler] Failed to check if was match:', error);
      return false;
    }
  }

  /**
   * Processes a batch of match events atomically
   */
  async processBatchEvents(events: MatchEvent[]): Promise<void> {
    console.log(`[MatchEventHandler] Processing ${events.length} match events`);

    for (const event of events) {
      try {
        switch (event.type) {
          case 'match_created':
            await this.handleMatchCreated(event.userA, event.userB, event.matchId);
            break;
          case 'match_deleted':
            await this.handleMatchDeleted(event.userA, event.userB);
            break;
          case 'match_blocked':
            await this.handleMatchBlocked(event.userA, event.userB);
            break;
        }
      } catch (error) {
        console.error(`[MatchEventHandler] Failed to process event ${event.type}:`, error);
        // Continue processing other events
      }
    }
  }

  /**
   * Repairs avatar access for existing matches (migration/recovery)
   */
  async repairExistingMatches(): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
      console.log('[MatchEventHandler] Starting repair of existing matches...');

      // Find all active mutual matches
      const mutualMatches = await prisma.like.findMany({
        where: { matchStatus: 1 },
        select: {
          sourceUserId: true,
          targetUserId: true
        }
      });

      // Group matches by pair to avoid duplicates
      const matchPairs = new Set<string>();
      const uniqueMatches: Array<{ userA: string; userB: string }> = [];

      for (const match of mutualMatches) {
        const pairKey = [match.sourceUserId, match.targetUserId].sort().join(':');
        if (!matchPairs.has(pairKey)) {
          matchPairs.add(pairKey);
          uniqueMatches.push({
            userA: match.sourceUserId,
            userB: match.targetUserId
          });
        }
      }

      console.log(`[MatchEventHandler] Found ${uniqueMatches.length} unique matches to repair`);

      // Process each match
      for (const match of uniqueMatches) {
        try {
          await this.grantAvatarAccess(match.userA, match.userB);
          await this.grantAvatarAccess(match.userB, match.userA);
          processed++;
        } catch (error) {
          console.error(`[MatchEventHandler] Failed to repair match ${match.userA} <-> ${match.userB}:`, error);
          errors++;
        }
      }

      console.log(`[MatchEventHandler] Repair complete: ${processed} processed, ${errors} errors`);

    } catch (error) {
      console.error('[MatchEventHandler] Failed to repair existing matches:', error);
      errors++;
    }

    return { processed, errors };
  }
}