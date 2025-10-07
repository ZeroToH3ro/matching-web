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
import { useAuthStore } from "@/hooks/useAuthStore";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClientContext } from "@mysten/dapp-kit";
import { buildCreateProfileTransaction, fetchProfileRegistryReference } from "@/lib/contracts/matchingMe";
import { markProfileCompleteOnChain } from "@/app/actions/profileOnChainActions";
import { completeSocialLoginProfile } from "@/app/actions/authActions";
import { calculateAge } from "@/lib/util";
import type { SuiTransactionBlockResponse } from "@mysten/sui/client";
import { isContractConfigured } from "@/configs/matchingMeContract";

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

  const { update } = useSession();
  const { setAuth } = useAuthStore();
  const account = useCurrentAccount();
  const { client } = useSuiClientContext();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction<SuiTransactionBlockResponse>({
    execute: async ({ bytes, signature }) =>
      client.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: { showEffects: true, showEvents: true },
        requestType: "WaitForLocalExecution",
      }),
  });
  const onSubmit = async (
    data: ProfileSchema
  ) => {
    setIsLoading(true);
    try {
      clearErrors("root");

      // Check if smart contract is configured
      const contractEnabled = isContractConfigured();

      if (contractEnabled && !account?.address) {
        setError("root.serverError", {
          message: "Connect your Sui wallet before completing your profile.",
        });
        return;
      }

      const age = calculateAge(new Date(data.dateOfBirth));

      if (age < 18) {
        setError("root.serverError", {
          message: "You must be at least 18 years old to create a profile.",
        });
        return;
      }

      // If contract is not configured, skip on-chain profile creation
      if (!contractEnabled) {
        console.warn('Smart contract not configured - skipping on-chain profile creation');

        // Complete profile using server action (saves to database)
        const result = await completeSocialLoginProfile(data);

        if (result.status !== 'success') {
          const errorMessage = Array.isArray(result.error) 
            ? result.error.map(e => e.message).join(', ') 
            : result.error || 'Failed to complete profile';
          throw new Error(errorMessage);
        }

        // Update session
        const updatedSession = await update({ profileComplete: true });

        if (updatedSession?.user?.id) {
          setAuth(updatedSession.user.id, true);
        }

        await new Promise(resolve => setTimeout(resolve, 300));
        window.location.href = "/members";
        return;
      }

      // Continue with on-chain profile creation
      if (!account?.address) {
        throw new Error('Wallet not connected');
      }

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

      const executionResult = await signAndExecuteTransaction({
        transaction,
      });

      const profileObjectId = extractProfileObjectId(executionResult, account.address);

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

      const updatedSession = await update({ profileComplete: true });

      if (updatedSession?.user?.id) {
        setAuth(updatedSession.user.id, true);
      }

      await new Promise(resolve => setTimeout(resolve, 300));
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
              <div className="flex flex-row items-center gap-6">
                <Button
                  isLoading={isLoading || isSubmitting}
                  isDisabled={!isValid || isLoading}
                  fullWidth
                  color="default"
                  type="submit"
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

function extractProfileObjectId(
  result: SuiTransactionBlockResponse,
  ownerAddress: string,
): string | null {
  const createdObjects = result.effects?.created ?? [];

  for (const created of createdObjects) {
    if (isAddressOwner(created.owner) && created.owner.AddressOwner === ownerAddress) {
      return created.reference?.objectId ?? null;
    }
  }

  return null;
}

function isAddressOwner(owner: unknown): owner is { AddressOwner: string } {
  if (typeof owner !== "object" || owner === null) {
    return false;
  }

  return "AddressOwner" in owner;
}
