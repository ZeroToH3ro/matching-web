"use client";

import React, { useState, useEffect } from "react";
import SwipeContainer from "./SwipeContainer";
import { Button } from "@/components/ui/button";
import { Shield, ShieldOff } from "lucide-react";
import type { Member } from "@prisma/client";
import { useSwipeBlockchain } from "@/hooks/useSwipeBlockchain";
import { toast } from "react-toastify";

type Props = {
  initialMembers: (Member & {
    user?: {
      profileObjectId: string | null;
      walletAddress: string | null;
    };
  })[];
  avatarUrls: Record<string, string | null>;
  onSwipeAction: (memberId: string, direction: "left" | "right") => Promise<any>;
  currentUserId?: string;
  myProfileObjectId?: string | null;
  enableBlockchainByDefault?: boolean;
};

export default function SwipeContainerWithBlockchain(props: Props) {
  const [useBlockchain, setUseBlockchain] = useState(props.enableBlockchainByDefault || false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const { 
    isLoading: isBlockchainLoading,
    createDiscoverySession,
    recordSwipeOnChain,
  } = useSwipeBlockchain();

  // Auto-enable blockchain on mount if default is true
  useEffect(() => {
    if (props.enableBlockchainByDefault && !sessionId) {
      handleEnableBlockchain();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnableBlockchain = async () => {
    setIsInitializing(true);
    
    const addresses = props.initialMembers
      .map((m) => m.user?.walletAddress)
      .filter((addr): addr is string => !!addr);

    if (addresses.length === 0) {
      toast.warning("No blockchain profiles available, using standard mode");
      setUseBlockchain(false);
      setIsInitializing(false);
      return;
    }

    const result = await createDiscoverySession(addresses);

    if (result.success) {
      setSessionId(result.sessionId || null);
      setUseBlockchain(true);
      toast.success("🎲 Blockchain randomness enabled!");
    } else {
      toast.warning("Blockchain mode failed, using standard mode");
      setUseBlockchain(false);
    }
    
    setIsInitializing(false);
  };

  const handleToggleBlockchain = async () => {
    if (!useBlockchain) {
      await handleEnableBlockchain();
    } else {
      // Disable blockchain mode
      setUseBlockchain(false);
      setSessionId(null);
      toast.info("Switched to standard mode");
    }
  };

  const handleSwipeWithBlockchain = async (
    memberId: string,
    direction: "left" | "right"
  ) => {
    if (!useBlockchain || !sessionId) {
      // Use standard database swipe
      return props.onSwipeAction(memberId, direction);
    }

    // Find member's wallet address
    const member = props.initialMembers.find((m) => m.userId === memberId);
    const targetAddress = member?.user?.walletAddress;

    if (!targetAddress) {
      // Fallback to database if no wallet
      return props.onSwipeAction(memberId, direction);
    }

    // Try blockchain first
    const blockchainResult = await recordSwipeOnChain(
      sessionId,
      targetAddress,
      direction
    );

    if (!blockchainResult.success) {
      // Auto-fallback to off-chain
      console.warn("Blockchain swipe failed, falling back to off-chain");
      toast.warning("Using off-chain mode", { autoClose: 2000 });
      setUseBlockchain(false);
      setSessionId(null);
    }

    // Always also record in database
    return props.onSwipeAction(memberId, direction);
  };

  return (
    <div className="space-y-4">
      {/* Blockchain Status Indicator */}
      <div className="flex justify-center items-center gap-3">
        <Button
          variant={useBlockchain ? "default" : "outline"}
          size="sm"
          onClick={handleToggleBlockchain}
          disabled={isBlockchainLoading || isInitializing}
          className="gap-2"
        >
          {useBlockchain ? (
            <>
              <Shield className="h-4 w-4" />
              On-Chain Randomness Active
            </>
          ) : (
            <>
              <ShieldOff className="h-4 w-4" />
              {isInitializing ? "Initializing..." : "Enable Blockchain Mode"}
            </>
          )}
        </Button>
      </div>

      {useBlockchain && (
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            🎲 Using Sui on-chain randomness • Auto-fallback to off-chain on error
          </p>
        </div>
      )}

      {/* Swipe Container */}
      <SwipeContainer
        {...props}
        onSwipeAction={handleSwipeWithBlockchain}
      />
    </div>
  );
}
