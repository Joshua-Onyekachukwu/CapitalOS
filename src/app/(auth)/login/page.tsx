"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedFrom = searchParams.get("redirect");

  const [form, setForm] = useState<LoginInput>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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

    const result = loginSchema.safeParse(form);
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

      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (error) {
        setServerError(error.message);
        setLoading(false);
        return;
      }

      router.push(redirectedFrom || "/dashboard");
      router.refresh();
    } catch {
      setServerError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <Card variant="elevated">
      <CardBody className="p-[25px] md:p-[35px]">
        <div className="text-center mb-[25px]">
          <h1 className="!text-xl md:!text-2xl !font-semibold !mb-[6px]">
            Welcome back
          </h1>
          <p className="text-[14px] text-gray-500 !mb-0">
            Log in to your Capital OS account
          </p>
        </div>

        {serverError && (
          <Alert variant="danger" className="mb-[20px]">
            {serverError}
          </Alert>
        )}

        {redirectedFrom && (
          <Alert variant="info" className="mb-[20px]">
            Please log in to access that page.
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-[18px]">
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

          <div>
            <Input
              label="Password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={form.password}
              onChange={handleChange}
              error={errors.password}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-[13px] text-gray-400 hover:text-gray-600 mt-[6px]"
            >
              {showPassword ? "Hide password" : "Show password"}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-[8px] text-[14px] text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                className="w-[16px] h-[16px] rounded border-gray-300"
              />
              Remember me
            </label>
            <Link
              href="/forgot-password"
              className="text-[14px] text-primary-600 hover:text-primary-700 font-medium"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" fullWidth loading={loading}>
            Log In
          </Button>
        </form>

        <div className="mt-[20px] pt-[20px] border-t border-gray-100 dark:border-gray-800 text-center">
          <p className="text-[14px] text-gray-500 !mb-0">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Sign up free
            </Link>
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <Card variant="elevated">
        <CardBody className="p-[25px] md:p-[35px]">
          <div className="animate-pulse space-y-[18px]">
            <div className="h-[20px] w-[60%] bg-gray-200 rounded mx-auto"></div>
            <div className="h-[14px] w-[40%] bg-gray-200 rounded mx-auto"></div>
            <div className="h-[44px] bg-gray-200 rounded"></div>
            <div className="h-[44px] bg-gray-200 rounded"></div>
            <div className="h-[44px] bg-gray-200 rounded"></div>
          </div>
        </CardBody>
      </Card>
    }>
      <LoginForm />
    </Suspense>
  );
}
