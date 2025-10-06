"use client";

import {
  memberEditSchema,
  type MemberEditSchema,
} from "@/lib/schemas/MemberEditSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Member } from "@prisma/client";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { updateMemberProfile } from "@/app/actions/userActions";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { handleFormServerErrors, calculateAge } from "@/lib/util";
import { Loader2, AlertCircle, Sparkles, CheckCircle2 } from "lucide-react";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { buildCreateProfileTransaction, fetchProfileRegistryReference } from "@/lib/contracts/matchingMe";
import { isContractConfigured } from "@/configs/matchingMeContract";
import { markProfileCompleteOnChain } from "@/app/actions/profileOnChainActions";

type Props = {
  member: Member;
  hasOnChainProfile?: boolean;
};

export default function EditForm({
  member,
  hasOnChainProfile = false,
}: Props) {
  const router = useRouter();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [isCreatingOnChain, setIsCreatingOnChain] = useState(false);
  const [onChainProfileCreated, setOnChainProfileCreated] = useState(hasOnChainProfile);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: {
      isValid,
      isDirty,
      isSubmitting,
      errors,
    },
  } = useForm<MemberEditSchema>({
    resolver: zodResolver(memberEditSchema),
    mode: "onTouched",
  });

  useEffect(() => {
    if (member) {
      reset({
        name: member.name,
        description: member.description,
        city: member.city,
        country: member.country,
      });
    }
  }, [member, reset]);

  const onSubmit = async (
    data: MemberEditSchema
  ) => {
    const nameUpdated = data.name !== member.name;
    const result = await updateMemberProfile(
      data,
      nameUpdated
    );

    if (result.status === "success") {
      toast.success("Profile updated");
      router.refresh();
      reset({ ...data });
    } else {
      handleFormServerErrors(result, setError);
    }
  };

  const handleCreateOnChainProfile = async () => {
    if (!isContractConfigured()) {
      toast.error("Smart contract not configured");
      return;
    }

    if (!account?.address) {
      toast.error("Please connect your wallet first");
      return;
    }

    setIsCreatingOnChain(true);

    try {
      const age = calculateAge(member.dateOfBirth);

      if (age < 18) {
        toast.error("You must be at least 18 years old");
        return;
      }

      // Encrypt profile data
      const encryptionResponse = await fetch("/api/profile/encrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            name: member.name,
            description: member.description,
            city: member.city,
            country: member.country,
            gender: member.gender,
            dateOfBirth: member.dateOfBirth.toISOString(),
          },
          ownerAddress: account.address,
        }),
      });

      if (!encryptionResponse.ok) {
        throw new Error("Failed to encrypt profile data");
      }

      const encrypted = await encryptionResponse.json();

      // Get profile registry
      const registry = await fetchProfileRegistryReference(client);

      // Build transaction
      const transaction = buildCreateProfileTransaction({
        ownerAddress: account.address,
        displayName: member.name,
        age,
        encryptedPayload: encrypted.ciphertext,
        interests: ["dating", "socializing", "meeting new people"], // Default interests
        registry,
      });

      // Execute transaction
      signAndExecuteTransaction(
        {
          transaction,
        },
        {
          onSuccess: async (result) => {
            try {
              // Parse effects if it's a string
              const effects = typeof result.effects === 'string'
                ? JSON.parse(result.effects)
                : result.effects;

              // Extract profile object ID
              const createdObjects = effects?.created || [];
              const profileObject = createdObjects.find(
                (obj: any) => obj.owner && typeof obj.owner === 'object' && 'AddressOwner' in obj.owner
              );

              if (!profileObject) {
                throw new Error("Profile created but object ID not found");
              }

              // Save to database
              await markProfileCompleteOnChain({
                profileObjectId: profileObject.reference.objectId,
                walletAddress: account.address,
              });

              setOnChainProfileCreated(true);
              toast.success("On-chain profile created successfully!");
              router.refresh();
            } catch (error: any) {
              console.error("Error processing transaction result:", error);
              toast.error("Profile created but failed to save: " + error.message);
            }
          },
          onError: (error) => {
            console.error("Transaction failed:", error);
            toast.error("Failed to create on-chain profile");
          },
        }
      );
    } catch (error: any) {
      console.error("Error creating on-chain profile:", error);
      toast.error(error.message || "Failed to create on-chain profile");
    } finally {
      setIsCreatingOnChain(false);
    }
  };

  const contractConfigured = isContractConfigured();
  const showOnChainSection = contractConfigured && account?.address;

  return (
    <div className="flex flex-col gap-6">
      {/* On-Chain Profile Status */}
      {showOnChainSection && (
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
                    ) : (
                      "Create your blockchain profile to enable decentralized matching, encrypted messaging, and Web3 features."
                    )}
                  </AlertDescription>
                </div>
              </div>
              {!onChainProfileCreated && (
                <Button
                  type="button"
                  onClick={handleCreateOnChainProfile}
                  disabled={isCreatingOnChain}
                  size="sm"
                  className="ml-4 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
                >
                  {isCreatingOnChain ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
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
      )}

      {/* Profile Edit Form */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-6"
      >
        {/* Name Field */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-base font-medium">
          Name
        </Label>
        <Input
          id="name"
          {...register("name")}
          defaultValue={member.name}
          className="h-12"
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {errors.name.message}
          </p>
        )}
      </div>

      {/* Description Field */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-base font-medium">
          Description
        </Label>
        <Textarea
          id="description"
          {...register("description")}
          defaultValue={member.description}
          rows={6}
          className="resize-none"
          aria-invalid={!!errors.description}
        />
        {errors.description && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {errors.description.message}
          </p>
        )}
      </div>

      {/* City and Country Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city" className="text-base font-medium">
            City
          </Label>
          <Input
            id="city"
            {...register("city")}
            defaultValue={member.city}
            className="h-12"
            aria-invalid={!!errors.city}
          />
          {errors.city && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.city.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="country" className="text-base font-medium">
            Country
          </Label>
          <Input
            id="country"
            {...register("country")}
            defaultValue={member.country}
            className="h-12"
            aria-invalid={!!errors.country}
          />
          {errors.country && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.country.message}
            </p>
          )}
        </div>
      </div>

      {/* Server Error Alert */}
      {errors.root?.serverError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {errors.root.serverError.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        className="self-end min-w-[140px]"
        disabled={!isValid || !isDirty || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Updating...
          </>
        ) : (
          "Update profile"
        )}
      </Button>
      </form>
    </div>
  );
}
