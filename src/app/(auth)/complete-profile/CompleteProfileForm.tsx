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
import { completeSocialLoginProfile } from "@/app/actions/authActions";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useAuthStore } from "@/hooks/useAuthStore";

export default function CompleteProfileForm() {
  const [isLoading, setIsLoading] = useState(false);
  const methods = useForm<ProfileSchema>({
    resolver: zodResolver(profileSchema),
    mode: "onTouched",
  });

  const {
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = methods;

  const { update } = useSession();
  const { setAuth } = useAuthStore();
  const onSubmit = async (
    data: ProfileSchema
  ) => {
    setIsLoading(true);
    try {
      const result = await completeSocialLoginProfile(data);

      if (result.status === "success") {
        const updatedSession = await update({ profileComplete: true });

        // Update Zustand store immediately
        if (updatedSession?.user?.id) {
          setAuth(updatedSession.user.id, true);
        }

        await new Promise(resolve => setTimeout(resolve, 300));
        window.location.href = "/members";
      }
    } catch (error) {
      console.error("Error completing profile:", error);
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
