"use client";

import { resetPassword } from "@/app/actions/authActions";
import CardWrapper from "@/components/CardWrapper";
import ResultMessage from "@/components/ResultMessage";
import {
  type ResetPasswordSchema,
  resetPasswordSchema,
} from "@/lib/schemas/ForgotPasswordSchema";
import type { ActionResult } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input } from "@nextui-org/react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { GiPadlock } from "react-icons/gi";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [result, setResult] =
    useState<ActionResult<string> | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ResetPasswordSchema>({
    mode: "onTouched",
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (
    data: ResetPasswordSchema
  ) => {
    setResult(
      await resetPassword(
        data.password,
        searchParams.get("token")
      )
    );
    reset();
  };

  return (
    <CardWrapper
      headerIcon={GiPadlock}
      headerText="Reset password"
      subHeaderText="Enter your new password below"
      body={
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
        >
          <Input
            type="password"
            placeholder="Password"
            variant="bordered"
            labelPlacement="outside"
            defaultValue=""
            {...register("password")}
            isInvalid={!!errors.password}
            errorMessage={
              errors.password?.message as string
            }
            classNames={{
              inputWrapper: "h-12"
            }}
          />
          <Input
            type="password"
            placeholder="Confirm Password"
            variant="bordered"
            labelPlacement="outside"
            defaultValue=""
            {...register("confirmPassword")}
            isInvalid={!!errors.confirmPassword}
            errorMessage={
              errors.confirmPassword
                ?.message as string
            }
            classNames={{
              inputWrapper: "h-12"
            }}
          />
          <Button
            type="submit"
            color="default"
            isLoading={isSubmitting}
            isDisabled={!isValid}
          >
            Reset password
          </Button>
        </form>
      }
      footer={<ResultMessage result={result} />}
    />
  );
}
