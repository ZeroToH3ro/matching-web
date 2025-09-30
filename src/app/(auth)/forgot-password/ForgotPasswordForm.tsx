"use client";

import { generateResetPasswordEmail } from "@/app/actions/authActions";
import CardWrapper from "@/components/CardWrapper";
import ResultMessage from "@/components/ResultMessage";
import type { ActionResult } from "@/types";
import { Button, Input } from "@nextui-org/react";
import { useState } from "react";
import {
  type FieldValues,
  useForm,
} from "react-hook-form";
import { GiPadlock } from "react-icons/gi";

export default function ForgotPasswordForm() {
  const [result, setResult] =
    useState<ActionResult<string> | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, isValid },
  } = useForm();

  const onSubmit = async (data: FieldValues) => {
    setResult(
      await generateResetPasswordEmail(data.email)
    );
    reset();
  };

  return (
    <CardWrapper
      headerIcon={GiPadlock}
      headerText="Forgot password"
      subHeaderText="Enter account email to reset your password"
      body={
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
        >
          <Input
            type="email"
            placeholder="Email address"
            variant="bordered"
            labelPlacement="outside"
            defaultValue=""
            {...register("email", {
              required: true,
            })}
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
            Send reset email
          </Button>
        </form>
      }
      footer={<ResultMessage result={result} />}
    />
  );
}
