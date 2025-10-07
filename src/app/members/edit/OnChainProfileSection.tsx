"use client";

import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, AlertCircle, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { calculateAge } from "@/lib/util";
import { buildCreateProfileTransaction, fetchProfileRegistryReference } from "@/lib/contracts/matchingMe";
import { isContractConfigured } from "@/configs/matchingMeContract";
import { markProfileCompleteOnChain } from "@/app/actions/profileOnChainActions";
import { useDialogsStore } from "@/store/dialogs.store";
import type { Member } from "@prisma/client";

interface Props {
  member: Member;
  hasOnChainProfile: boolean;
  walletAddress?: string; // Wallet address from database (for zkLogin users)
}

export default function OnChainProfileSection({ member, hasOnChainProfile, walletAddress: dbWalletAddress }: Props) {
  const router = useRouter();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { setConnectWalletOpen } = useDialogsStore();

  const [isCreatingOnChain, setIsCreatingOnChain] = useState(false);
  const [onChainProfileCreated, setOnChainProfileCreated] = useState(hasOnChainProfile);

  const contractConfigured = isContractConfigured();

  // Use wallet from dApp kit if available, otherwise use from database (zkLogin)
  const walletAddress = account?.address || dbWalletAddress;

  console.log("[OnChainProfileSection] Render state:", {
    contractConfigured,
    accountAddress: account?.address,
    dbWalletAddress,
    walletAddress,
    onChainProfileCreated,
    hasOnChainProfile,
  });

  const handleCreateOnChainProfile = async () => {
    if (!isContractConfigured()) {
      toast.error("Smart contract not configured");
      return;
    }

    if (!walletAddress) {
      toast.error("Wallet address not found");
      return;
    }

    // Check if wallet is connected for signing transactions
    if (!account?.address) {
      toast.error("Please connect your wallet to sign the transaction");
      setConnectWalletOpen(true);
      return;
    }

    setIsCreatingOnChain(true);

    try {
      const age = calculateAge(member.dateOfBirth);

      if (age < 18) {
        toast.error("You must be at least 18 years old");
        setIsCreatingOnChain(false);
        return;
      }

      console.log("[OnChainProfileSection] Creating on-chain profile for:", walletAddress);
      toast.info("Creating profile on blockchain...");

      // Build transaction - same as test-contract
      const transaction = buildCreateProfileTransaction({
        ownerAddress: walletAddress,
        displayName: member.name,
        age,
        encryptedPayload: member.description, // Use plain bio, not encrypted
        interests: ["dating", "socializing", "meeting new people"],
        registry: await fetchProfileRegistryReference(client),
      });

      // Execute transaction
      signAndExecuteTransaction(
        {
          transaction,
        },
        {
          onSuccess: async (result) => {
            try {
              console.log("[OnChainProfileSection] Transaction successful:", result.digest);

              // Wait for transaction to be indexed
              const txResult = await client.waitForTransaction({
                digest: result.digest,
                options: { showObjectChanges: true },
              });

              console.log("[OnChainProfileSection] Transaction result:", txResult);

              // Find created profile object
              const profileObject = txResult.objectChanges?.find(
                (change: any) =>
                  change.type === "created" &&
                  change.objectType?.includes("::UserProfile")
              );

              if (!profileObject || !("objectId" in profileObject)) {
                throw new Error("Profile created but object ID not found");
              }

              console.log("[OnChainProfileSection] Profile object ID:", profileObject.objectId);

              // Save to database
              const saveResult = await markProfileCompleteOnChain({
                profileObjectId: profileObject.objectId,
                walletAddress: walletAddress,
              });

              if (saveResult.status !== "success") {
                throw new Error(saveResult.error || "Failed to save to database");
              }

              console.log("[OnChainProfileSection] Profile saved to database");
              setOnChainProfileCreated(true);
              toast.success("✅ On-chain profile created successfully!");
              router.refresh();
            } catch (error: any) {
              console.error("[OnChainProfileSection] Error processing transaction result:", error);
              toast.error("Profile created but failed to save: " + error.message);
            } finally {
              setIsCreatingOnChain(false);
            }
          },
          onError: (error) => {
            console.error("[OnChainProfileSection] Transaction failed:", error);
            toast.error("Failed to create on-chain profile: " + (error as Error).message);
            setIsCreatingOnChain(false);
          },
        }
      );
    } catch (error: any) {
      console.error("[OnChainProfileSection] Error creating on-chain profile:", error);
      toast.error(error.message || "Failed to create on-chain profile");
      setIsCreatingOnChain(false);
    }
  };

  if (!contractConfigured) {
    return null;
  }

  // No wallet address at all (shouldn't happen for zkLogin users)
  if (!walletAddress) {
    return (
      <>
        <Alert className="border-blue-500 bg-blue-50">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Wallet Required</h4>
                <AlertDescription className="text-sm">
                  A wallet address is required to create an on-chain profile and access Web3 features.
                </AlertDescription>
              </div>
            </div>
            {!account?.address && (
              <Button
                type="button"
                size="sm"
                onClick={() => setConnectWalletOpen(true)}
                className="ml-4 bg-blue-600 hover:bg-blue-700"
              >
                Connect Wallet
              </Button>
            )}
          </div>
        </Alert>
        <Separator />
      </>
    );
  }

  // Wallet address exists but need to connect for signing
  const needsWalletConnection = !account?.address && dbWalletAddress;

  // Wallet connected or ready
  return (
    <>
      <Alert className={onChainProfileCreated ? "border-green-500 bg-green-50" : "border-yellow-500 bg-yellow-50"}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {onChainProfileCreated ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            )}
            <div className="space-y-1">
              <h4 className="font-semibold text-sm">
                {onChainProfileCreated ? "Blockchain Profile Active" : "No Blockchain Profile"}
              </h4>
              <AlertDescription className="text-sm">
                {onChainProfileCreated ? (
                  "Your profile is securely stored on the Sui blockchain with end-to-end encryption."
                ) : needsWalletConnection ? (
                  "Connect your wallet to create your blockchain profile and access Web3 features."
                ) : (
                  "Create your blockchain profile to enable decentralized matching, encrypted messaging, and Web3 features."
                )}
              </AlertDescription>
            </div>
          </div>
          {!onChainProfileCreated && (
            <Button
              type="button"
              onClick={needsWalletConnection ? () => setConnectWalletOpen(true) : handleCreateOnChainProfile}
              disabled={isCreatingOnChain}
              size="sm"
              className="ml-4 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
            >
              {isCreatingOnChain ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : needsWalletConnection ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Connect Wallet
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Create On-Chain
                </>
              )}
            </Button>
          )}
        </div>
      </Alert>
      <Separator />
    </>
  );
}
