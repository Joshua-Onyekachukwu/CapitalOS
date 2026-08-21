"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { signupSchema, type SignupInput } from "@/lib/validators/auth";

export default function SignupPage() {
  const router = useRouter();

  const [form, setForm] = useState<SignupInput>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: true as unknown as true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");

    const result = signupSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.fullName,
          },
        },
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
            Check your email
          </h1>
          <p className="text-[14px] text-gray-500 !mb-[25px]">
            We sent a confirmation link to <strong>{form.email}</strong>.
            Click the link to activate your account.
          </p>
          <Link
            href="/login"
            className="text-[14px] text-primary-600 hover:text-primary-700 font-medium"
          >
            Back to login
          </Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card variant="elevated">
      <CardBody className="p-[25px] md:p-[35px]">
        <div className="text-center mb-[25px]">
          <h1 className="!text-xl md:!text-2xl !font-semibold !mb-[6px]">
            Create your account
          </h1>
          <p className="text-[14px] text-gray-500 !mb-0">
            Start fundraising smarter with Capital OS
          </p>
        </div>

        {serverError && (
          <Alert variant="danger" className="mb-[20px]">
            {serverError}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-[16px]">
          <Input
            label="Full Name"
            name="fullName"
            type="text"
            placeholder="John Doe"
            value={form.fullName}
            onChange={handleChange}
            error={errors.fullName}
            required
            autoComplete="name"
          />

          <Input
            label="Email"
            name="email"
            type="email"
            placeholder="you@company.com"
            value={form.email}
            onChange={handleChange}
            error={errors.email}
            required
            autoComplete="email"
          />

          <Input
            label="Password"
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
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            placeholder="Confirm your password"
            value={form.confirmPassword}
            onChange={handleChange}
            error={errors.confirmPassword}
            required
            autoComplete="new-password"
          />

          {errors.acceptTerms && (
            <p className="text-[13px] text-danger-500">{errors.acceptTerms}</p>
          )}

          <Button type="submit" fullWidth loading={loading}>
            Create Account
          </Button>
        </form>

        <p className="text-[12px] text-gray-400 text-center mt-[15px] !mb-0">
          By creating an account, you agree to our{" "}
          <a href="#" className="underline hover:text-gray-600">Terms of Service</a>{" "}
          and{" "}
          <a href="#" className="underline hover:text-gray-600">Privacy Policy</a>.
        </p>

        <div className="mt-[20px] pt-[20px] border-t border-gray-100 dark:border-gray-800 text-center">
          <p className="text-[14px] text-gray-500 !mb-0">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Log in
            </Link>
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
