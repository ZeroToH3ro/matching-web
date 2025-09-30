"use client";

import { registerUser } from "@/app/actions/authActions";
import {
  profileSchema,
  registerSchema,
  type RegisterSchema,
} from "@/lib/schemas/RegisterSchema";
import { handleFormServerErrors } from "@/lib/util";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import React, { useState } from "react";
import {
  FormProvider,
  useForm,
} from "react-hook-form";
import { GiPadlock } from "react-icons/gi";
import UserDetailsForm from "./UserDetailsForm";
import ProfileDetailsForm from "./ProfileDetailsForm";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";

const stepSchemas = [
  registerSchema,
  profileSchema,
];

export default function RegisterForm() {
  const [activeStep, setActiveStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const currentValidationSchema =
    stepSchemas[activeStep];

  const registerFormMethods =
    useForm<RegisterSchema>({
      resolver: zodResolver(
        currentValidationSchema
      ),
      mode: "onTouched",
    });

  const {
    handleSubmit,
    getValues,
    setError,
    formState: { errors, isValid, isSubmitting },
  } = registerFormMethods;

  const router = useRouter();

  const onSubmit = async () => {
    setIsLoading(true);
    try {
      const values = getValues();
      const result = await registerUser(values);

      if (result.status === "success") {
        // Redirect to verification page
        router.push("/register/success");
      } else {
        handleFormServerErrors(result, setError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return <UserDetailsForm />;
      case 1:
        return <ProfileDetailsForm />;
      default:
        return "Unknown step";
    }
  };

  const onBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const onNext = async () => {
    if (activeStep === stepSchemas.length - 1) {
      await onSubmit();
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  return (
    <Card className="w-3/5 mx-auto">
      <CardHeader className="flex flex-col items-center justify-center space-y-2">
        <div className="flex flex-row items-center gap-3">
          <GiPadlock size={30} />
          <h1 className="text-3xl font-semibold">
            Register
          </h1>
        </div>
        <p className="text-muted-foreground">
          Welcome to NextMatch
        </p>
      </CardHeader>
      <CardContent>
        <FormProvider {...registerFormMethods}>
          <form onSubmit={handleSubmit(onNext)}>
            <div className="flex flex-col gap-6">
              {getStepContent(activeStep)}
              {errors.root?.serverError && (
                <p className="text-red-500 text-sm">
                  {
                    errors.root.serverError
                      .message
                  }
                </p>
              )}
              <div className="flex flex-row items-center gap-6">
                {activeStep !== 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onBack}
                    className="w-full"
                  >
                    Back
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={!isValid || isSubmitting || isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>Loading...</>
                  ) : activeStep === stepSchemas.length - 1 ? (
                    "Submit"
                  ) : (
                    "Continue"
                  )}
                </Button>
              </div>
            </div>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}
