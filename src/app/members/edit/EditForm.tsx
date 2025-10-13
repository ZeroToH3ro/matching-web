"use client";

import {
  memberEditSchema,
  type MemberEditSchema,
} from "@/lib/schemas/MemberEditSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Member } from "@prisma/client";
import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { updateMemberProfile } from "@/app/actions/userActions";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { handleFormServerErrors } from "@/lib/util";
import { Loader2, AlertCircle } from "lucide-react";
import OnChainProfileSection from "./OnChainProfileSection";
import { ErrorBoundary } from "@/components/ErrorBoundary";

type Props = {
  member: Member;
  hasOnChainProfile?: boolean;
  walletAddress?: string;
};

export default function EditForm({
  member,
  hasOnChainProfile = false,
  walletAddress,
}: Props) {
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  
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
    setMounted(true);
  }, []);

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

  // Don't render until mounted to avoid hydration issues
  if (!mounted) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading form...</span>
      </div>
    );
  }

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

  return (
    <div className="flex flex-col gap-6">
      {/* On-Chain Profile Status */}
      <ErrorBoundary
        fallback={
          <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50">
            <p className="text-yellow-600 text-sm">
              Blockchain features are temporarily unavailable. You can still edit your profile.
            </p>
          </div>
        }
      >
        <OnChainProfileSection
          member={member}
          hasOnChainProfile={hasOnChainProfile}
          walletAddress={walletAddress}
        />
      </ErrorBoundary>



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
