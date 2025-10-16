"use client";

import { useState } from "react";
import { Transaction } from "@mysten/sui/transactions";
import { useSuiClient } from "@mysten/dapp-kit";
import { useSponsoredTransaction } from "./useSponsoredTransaction";

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID!;
const DISCOVERY_MODULE = `${PACKAGE_ID}::discovery`;

export function useSwipeBlockchain() {
  const [isLoading, setIsLoading] = useState(false);
  const { executeSponsored } = useSponsoredTransaction();
  const suiClient = useSuiClient();

  /**
   * Create a discovery session on-chain with random shuffling
   */
  const createDiscoverySession = async (
    availableUserAddresses: string[]
  ): Promise<{
    success: boolean;
    sessionId?: string;
    error?: string;
  }> => {
    try {
      setIsLoading(true);

      const tx = new Transaction();

      tx.moveCall({
        target: `${DISCOVERY_MODULE}::create_discovery_session`,
        arguments: [
          tx.pure.vector("address", availableUserAddresses),
          tx.object("0x8"), // Random object at reserved address
          tx.object("0x6"), // Clock object
        ],
      });

      const result = await executeSponsored(tx, {
        allowedMoveCallTargets: [`${DISCOVERY_MODULE}::create_discovery_session`],
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create discovery session');
      }

      // Return success - session ID will be in the transaction result
      // Client can query for created objects if needed
      return {
        success: true,
        sessionId: result.digest, // Use digest as reference
      };
    } catch (error: any) {
      console.error("Error creating discovery session:", error);
      return {
        success: false,
        error: error.message || "Failed to create discovery session",
      };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Record a swipe on-chain with random seed generation
   */
  const recordSwipeOnChain = async (
    sessionId: string,
    targetUserAddress: string,
    direction: "left" | "right"
  ): Promise<{
    success: boolean;
    digest?: string;
    randomSeed?: string;
    error?: string;
  }> => {
    try {
      setIsLoading(true);

      const tx = new Transaction();

      tx.moveCall({
        target: `${DISCOVERY_MODULE}::record_swipe`,
        arguments: [
          tx.object(sessionId), // Discovery session object
          tx.pure.address(targetUserAddress),
          tx.pure.u8(direction === "right" ? 1 : 0), // 1 for right, 0 for left
          tx.object("0x8"), // Random object
          tx.object("0x6"), // Clock object
        ],
      });

      const result = await executeSponsored(tx, {
        allowedMoveCallTargets: [`${DISCOVERY_MODULE}::record_swipe`],
        allowedAddresses: [targetUserAddress],
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to record swipe');
      }

      // Return digest as proof of swipe
      return {
        success: true,
        digest: result.digest,
      };
    } catch (error: any) {
      console.error("Error recording swipe on-chain:", error);
      return {
        success: false,
        error: error.message || "Failed to record swipe",
      };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Get random match suggestion from available profiles
   */
  const getRandomMatchSuggestion = async (
    availableUserAddresses: string[]
  ): Promise<{
    success: boolean;
    suggestedProfile?: string;
    error?: string;
  }> => {
    try {
      setIsLoading(true);

      const tx = new Transaction();

      tx.moveCall({
        target: `${DISCOVERY_MODULE}::suggest_random_match`,
        arguments: [
          tx.pure.vector("address", availableUserAddresses),
          tx.object("0x8"), // Random object
          tx.object("0x6"), // Clock object
        ],
      });

      const result = await executeSponsored(tx, {
        allowedMoveCallTargets: [`${DISCOVERY_MODULE}::suggest_random_match`],
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to get suggestion');
      }

      // Return success - can query events separately if needed
      return {
        success: true,
      };
    } catch (error: any) {
      console.error("Error getting random match suggestion:", error);
      return {
        success: false,
        error: error.message || "Failed to get suggestion",
      };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Refresh discovery queue with new random order
   */
  const refreshDiscoveryQueue = async (
    sessionId: string,
    newProfiles: string[]
  ): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      setIsLoading(true);

      const tx = new Transaction();

      tx.moveCall({
        target: `${DISCOVERY_MODULE}::refresh_discovery_queue`,
        arguments: [
          tx.object(sessionId),
          tx.pure.vector("address", newProfiles),
          tx.object("0x8"), // Random object
          tx.object("0x6"), // Clock object
        ],
      });

      const result = await executeSponsored(tx, {
        allowedMoveCallTargets: [`${DISCOVERY_MODULE}::refresh_discovery_queue`],
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to refresh queue');
      }

      return {
        success: true,
      };
    } catch (error: any) {
      console.error("Error refreshing discovery queue:", error);
      return {
        success: false,
        error: error.message || "Failed to refresh queue",
      };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    createDiscoverySession,
    recordSwipeOnChain,
    getRandomMatchSuggestion,
    refreshDiscoveryQueue,
  };
}
