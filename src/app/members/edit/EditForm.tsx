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
    <div className="flex flex-col gap-4 md:gap-6">
      {/* On-Chain Profile Status */}
      <ErrorBoundary
        fallback={
          <div className="p-3 md:p-4 border border-yellow-200 rounded-lg bg-yellow-50">
            <p className="text-yellow-600 text-xs md:text-sm">
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
        className="flex flex-col gap-4 md:gap-6"
      >
        {/* Name Field */}
      <div className="space-y-1.5 md:space-y-2">
        <Label htmlFor="name" className="text-sm md:text-base font-medium">
          Name
        </Label>
        <Input
          id="name"
          {...register("name")}
          defaultValue={member.name}
          className="h-10 md:h-12 text-sm md:text-base"
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="text-xs md:text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
            {errors.name.message}
          </p>
        )}
      </div>

      {/* Description Field */}
      <div className="space-y-1.5 md:space-y-2">
        <Label htmlFor="description" className="text-sm md:text-base font-medium">
          Description
        </Label>
        <Textarea
          id="description"
          {...register("description")}
          defaultValue={member.description}
          rows={6}
          className="resize-none text-sm md:text-base"
          aria-invalid={!!errors.description}
        />
        {errors.description && (
          <p className="text-xs md:text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
            {errors.description.message}
          </p>
        )}
      </div>

      {/* City and Country Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <div className="space-y-1.5 md:space-y-2">
          <Label htmlFor="city" className="text-sm md:text-base font-medium">
            City
          </Label>
          <Input
            id="city"
            {...register("city")}
            defaultValue={member.city}
            className="h-10 md:h-12 text-sm md:text-base"
            aria-invalid={!!errors.city}
          />
          {errors.city && (
            <p className="text-xs md:text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3 flex-shrink-0" />
              {errors.city.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5 md:space-y-2">
          <Label htmlFor="country" className="text-sm md:text-base font-medium">
            Country
          </Label>
          <Input
            id="country"
            {...register("country")}
            defaultValue={member.country}
            className="h-10 md:h-12 text-sm md:text-base"
            aria-invalid={!!errors.country}
          />
          {errors.country && (
            <p className="text-xs md:text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3 flex-shrink-0" />
              {errors.country.message}
            </p>
          )}
        </div>
      </div>

      {/* Server Error Alert */}
      {errors.root?.serverError && (
        <Alert variant="destructive">
          <AlertCircle className="h-3 w-3 md:h-4 md:w-4" />
          <AlertDescription className="text-xs md:text-sm">
            {errors.root.serverError.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full md:w-auto md:self-end md:min-w-[140px] text-sm md:text-base h-10 md:h-11"
        disabled={!isValid || !isDirty || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-1.5 md:mr-2 h-3 w-3 md:h-4 md:w-4 animate-spin" />
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
