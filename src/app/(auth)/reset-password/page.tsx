"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validators/auth";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [form, setForm] = useState<ResetPasswordInput>({
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");

    const result = resetPasswordSchema.safeParse(form);
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

      const { error } = await supabase.auth.updateUser({
        password: form.password,
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
        <CardBody className="p-[25px] md:p-[35px] text-center">
          <div className="w-[60px] h-[60px] rounded-full bg-success-50 dark:bg-success-900/20 flex items-center justify-center mx-auto mb-[20px]">
            <i className="ri-check-line text-success-500 text-[28px]"></i>
          </div>
          <h1 className="!text-xl md:!text-2xl !font-semibold !mb-[8px]">
            Password updated
          </h1>
          <p className="text-[14px] text-gray-500 !mb-[25px]">
            Your password has been successfully reset.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="text-[14px] text-primary-600 hover:text-primary-700 font-medium"
          >
            Go to login
          </button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card variant="elevated">
      <CardBody className="p-[25px] md:p-[35px]">
        <div className="text-center mb-[25px]">
          <h1 className="!text-xl md:!text-2xl !font-semibold !mb-[6px]">
            Set new password
          </h1>
          <p className="text-[14px] text-gray-500 !mb-0">
            Enter your new password below.
          </p>
        </div>

        {serverError && (
          <Alert variant="danger" className="mb-[20px]">
            {serverError}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-[18px]">
          <Input
            label="New Password"
            name="password"
            type="password"
            placeholder="Min. 8 characters"
            value={form.password}
            onChange={handleChange}
            error={errors.password}
            required
            autoComplete="new-password"
          />

          <Input
            label="Confirm New Password"
            name="confirmPassword"
            type="password"
            placeholder="Confirm your password"
            value={form.confirmPassword}
            onChange={handleChange}
            error={errors.confirmPassword}
            required
            autoComplete="new-password"
          />

          <Button type="submit" fullWidth loading={loading}>
            Update Password
          </Button>
        </form>

        <div className="mt-[20px] pt-[20px] border-t border-gray-100 dark:border-gray-800 text-center">
          <Link
            href="/login"
            className="text-[14px] text-primary-600 hover:text-primary-700 font-medium"
          >
            Back to login
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
