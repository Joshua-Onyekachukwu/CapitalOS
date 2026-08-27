"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validators/auth";

export default function ForgotPasswordPage() {
  const [form, setForm] = useState<ForgotPasswordInput>({ email: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");

    const result = forgotPasswordSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });

      if (error) {
        setServerError(error.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch {
      setServerError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card variant="elevated">
        <CardBody className="p-[24px] md:p-[32px] text-center">
          <div className="w-[60px] h-[60px] rounded-full bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center mx-auto mb-[20px]">
            <i className="ri-mail-send-line text-lime-600 text-[28px]"></i>
          </div>
          <h1 className="!text-xl md:!text-2xl !font-semibold !mb-[8px]">
            Check your email
          </h1>
          <p className="text-[14px] text-gray-500 !mb-[25px]">
            We sent a password reset link to <strong>{form.email}</strong>.
          </p>
          <Link
            href="/login"
            className="text-[14px] text-lime-600 hover:text-lime-700 font-medium"
          >
            Back to login
          </Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card variant="elevated">
      <CardBody className="p-[24px] md:p-[32px]">
        <div className="text-center mb-[25px]">
          <h1 className="!text-xl md:!text-2xl !font-semibold !mb-[6px]">
            Forgot your password?
          </h1>
          <p className="text-[14px] text-gray-500 !mb-0">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {serverError && (
          <Alert variant="danger" className="mb-[20px]">
            {serverError}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-[18px]">
          <Input
            label="Email"
            name="email"
            type="email"
            placeholder="you@company.com"
            value={form.email}
            onChange={(e) => {
              setForm({ email: e.target.value });
              if (errors.email) setErrors({ email: "" });
            }}
            error={errors.email}
            required
            autoComplete="email"
          />

          <Button type="submit" fullWidth loading={loading}>
            Send Reset Link
          </Button>
        </form>

        <div className="mt-[20px] pt-[20px] border-t border-gray-100 dark:border-gray-800 text-center">
          <p className="text-[14px] text-gray-500 !mb-0">
            Remember your password?{" "}
            <Link
              href="/login"
              className="text-lime-600 hover:text-lime-700 font-medium"
            >
              Log in
            </Link>
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
