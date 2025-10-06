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
import { updateMemberProfile } from "@/app/actions/userActions";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { handleFormServerErrors } from "@/lib/util";
import { Loader2 } from "lucide-react";
import OnChainProfileSection from "./OnChainProfileSection";

type Props = {
  member: Member;
  hasOnChainProfile?: boolean;
};

export default function EditForm({
  member,
  hasOnChainProfile = false,
}: Props) {
  const router = useRouter();
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

  return (
    <div className="flex flex-col gap-6">
      {/* On-Chain Profile Status */}
      <OnChainProfileSection member={member} hasOnChainProfile={hasOnChainProfile} />

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
