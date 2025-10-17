"use client";

import CardWrapper from "@/components/CardWrapper";
import {
  type ProfileSchema,
  profileSchema,
} from "@/lib/schemas/RegisterSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FormProvider,
  useForm,
} from "react-hook-form";
import { RiProfileLine } from "react-icons/ri";
import ProfileForm from "../register/ProfileDetailsForm";
import { Button } from "@nextui-org/react";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useCurrentAccount, useSuiClientContext } from "@mysten/dapp-kit";
import { buildCreateProfileTransaction, fetchProfileRegistryReference } from "@/lib/contracts/matchingMe";
import { markProfileCompleteOnChain } from "@/app/actions/profileOnChainActions";
import { completeSocialLoginProfile } from "@/app/actions/authActions";
import { calculateAge } from "@/lib/util";
import { isContractConfigured } from "@/configs/matchingMeContract";
import { getProfileIdByAddress, getProfileInfo } from "@/lib/blockchain/contractQueries";
import { useSponsoredTransaction } from "@/hooks/useSponsoredTransaction";
import { toast } from "react-toastify";
import { isEvmAddress } from "@/lib/walletUtils";

interface EncryptionResponse {
  ciphertext: string;
  policyId: string;
  keyId: string;
}

export default function CompleteProfileForm() {
  const [isLoading, setIsLoading] = useState(false);
  const methods = useForm<ProfileSchema>({
    resolver: zodResolver(profileSchema),
    mode: "onTouched",
  });

  const {
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
    setError,
    clearErrors,
  } = methods;

  const { update, data: session } = useSession();
  const account = useCurrentAccount();
  const { client } = useSuiClientContext();

  // Check if current user is using EVM wallet
  const userWalletAddress = session?.user?.id || '';
  const isEvmWallet = isEvmAddress(userWalletAddress);
  
  // Use Enoki-sponsored transactions
  const { executeSponsored, isLoading: isSponsoredLoading } = useSponsoredTransaction({
    onSuccess: (digest) => {
      console.log('✅ Sponsored transaction executed:', digest);
    },
    showToasts: true,
  });
  
  const onSubmit = async (
    data: ProfileSchema
  ) => {
    setIsLoading(true);
    try {
      clearErrors("root");

      // Check if smart contract is configured
      const contractEnabled = isContractConfigured();

      // EVM wallets skip onchain profile creation
      if (!isEvmWallet && contractEnabled && !account?.address) {
        setError("root.serverError", {
          message: "Connect your Sui wallet before completing your profile.",
        });
        setIsLoading(false);
        return;
      }

      const age = calculateAge(new Date(data.dateOfBirth));

      if (age < 18) {
        setError("root.serverError", {
          message: "You must be at least 18 years old to create a profile.",
        });
        setIsLoading(false);
        return;
      }

      // Complete off-chain profile first
      const result = await completeSocialLoginProfile(data);

      if (result.status !== 'success') {
        const errorMessage = Array.isArray(result.error)
          ? result.error.map(e => e.message).join(', ')
          : result.error || 'Failed to complete profile';
        throw new Error(errorMessage);
      }

      // EVM wallets skip on-chain profile creation entirely
      if (isEvmWallet) {
        console.log('✅ EVM wallet detected - skipping on-chain profile creation');

        await update({ profileComplete: true });

        // Small delay to ensure session is updated
        await new Promise(resolve => setTimeout(resolve, 300));

        // Redirect and let middleware handle the rest
        window.location.href = "/members";
        return;
      }

      // Continue with on-chain profile creation for Sui wallets
      if (!account?.address) {
        throw new Error('Wallet not connected');
      }

      // Check if user already has a profile on-chain
      let profileObjectId = await getProfileIdByAddress(client, account.address);

      if (profileObjectId) {
        // Profile exists - sync existing data
        console.log('✅ Existing on-chain profile found:', profileObjectId);

        const existingProfile = await getProfileInfo(client, profileObjectId);

        if (existingProfile) {
          console.log('📦 Syncing existing profile data:', {
            displayName: existingProfile.displayName,
            age: existingProfile.age,
            interests: existingProfile.interests,
          });

          // Mark as complete with existing profile
          const markResult = await markProfileCompleteOnChain({
            profileObjectId,
            // Don't pass seal params - use existing ones
          });

          if (markResult.status !== "success") {
            throw new Error(markResult.error);
          }
        }
      } else {
        // No profile exists - create new one
        console.log('🆕 No on-chain profile found, creating new...');

        const encryptionResponse = await fetch("/api/profile/encrypt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile: buildProfilePayload(data),
            ownerAddress: account.address,
          }),
        });

        if (!encryptionResponse.ok) {
          const errorBody = await safeParseError(encryptionResponse);
          throw new Error(errorBody ?? "Failed to encrypt profile data");
        }

        const encrypted: EncryptionResponse = await encryptionResponse.json();

        const registry = await fetchProfileRegistryReference(client);

        const transaction = buildCreateProfileTransaction({
          ownerAddress: account.address,
          displayName: data.name,
          age,
          encryptedPayload: encrypted.ciphertext,
          interests: deriveInterests(data),
          registry,
        });

        // Execute with Enoki sponsorship
        const executionResult = await executeSponsored(transaction, {
          allowedMoveCallTargets: [
            `${process.env.NEXT_PUBLIC_PACKAGE_ID}::core::create_profile`,
          ],
        });

        if (!executionResult.success || !executionResult.digest) {
          throw new Error('Failed to create profile on-chain');
        }

        // Wait for transaction to be indexed
        await client.waitForTransaction({
          digest: executionResult.digest,
          options: { showObjectChanges: true },
        });

        // Query the created profile object ID
        profileObjectId = await getProfileIdByAddress(client, account.address);

        if (!profileObjectId) {
          throw new Error("Profile created but object ID could not be determined.");
        }

        const markResult = await markProfileCompleteOnChain({
          profileObjectId,
          sealPolicyId: encrypted.policyId,
          sealKeyId: encrypted.keyId,
        });

        if (markResult.status !== "success") {
          throw new Error(markResult.error);
        }

        console.log('✅ New on-chain profile created:', profileObjectId);
      }

      await update({ profileComplete: true });

      // Small delay to ensure session is updated
      await new Promise(resolve => setTimeout(resolve, 300));

      // Redirect and let middleware handle the rest
      window.location.href = "/members";
    } catch (error) {
      console.error("Error completing profile:", error);
      setError("root.serverError", {
        message:
          error instanceof Error ? error.message : "Something went wrong while completing your profile.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CardWrapper
      headerText="About you"
      subHeaderText="Please complete your profile to continue to the app"
      headerIcon={RiProfileLine}
      body={
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="flex flex-col gap-6">
              <ProfileForm />
              {errors.root?.serverError && (
                <p className="text-danger text-sm">
                  {
                    errors.root.serverError
                      .message
                  }
                </p>
              )}
              <div className="flex flex-col gap-4 pt-2">
                <Button
                  isLoading={isLoading || isSubmitting}
                  isDisabled={!isValid || isLoading}
                  fullWidth
                  color="default"
                  type="submit"
                  size="lg"
                >
                  Submit
                </Button>
              </div>
            </div>
          </form>
        </FormProvider>
      }
    />
  );
}

function buildProfilePayload(data: ProfileSchema) {
  return {
    name: data.name,
    gender: data.gender,
    description: data.description,
    city: data.city,
    country: data.country,
    dateOfBirth: data.dateOfBirth,
    createdAt: new Date().toISOString(),
  };
}

function deriveInterests(data: ProfileSchema): string[] {
  const base = [data.gender, data.city, data.country];
  const descriptionTokens = data.description
    .split(/[,\n]/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  const unique = Array.from(
    new Set([...base, ...descriptionTokens].map((interest) => interest.toLowerCase())),
  ).filter((interest) => interest.length > 0);

  while (unique.length < 3) {
    unique.push(`interest-${unique.length + 1}`);
  }

  return unique;
}

async function safeParseError(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? null;
  } catch (error) {
    console.warn("Failed to parse error response", error);
    return null;
  }
}

