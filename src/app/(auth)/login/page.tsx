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
  const [rememberMe, setRememberMe] = useState(true); // Supabase persists by default

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
      <CardBody className="p-[24px] md:p-[32px]">
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
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Remember me
            </label>
            <Link
              href="/forgot-password"
              className="text-[14px] text-lime-600 hover:text-lime-700 font-medium"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" fullWidth loading={loading}>
            Log In
          </Button>
        </form>

        {/* Google Sign-In */}
        <div className="mt-[20px]">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100 dark:border-gray-800"></div>
            </div>
            <div className="relative flex justify-center text-[13px]">
              <span className="bg-white dark:bg-gray-900 px-[12px] text-gray-400">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              const { createClient } = await import("@/lib/supabase/client");
              const supabase = createClient();
              const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                  redirectTo: `${window.location.origin}/auth/callback`,
                },
              });
              if (error) setServerError(error.message);
            }}
            className="mt-[16px] w-full flex items-center justify-center gap-[8px] px-[16px] py-[12px] border border-gray-200 dark:border-gray-700 rounded-[8px] bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-[14px] font-medium text-gray-700 dark:text-gray-200"
          >
            <svg className="w-[20px] h-[20px]" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
        </div>

        <div className="mt-[20px] pt-[20px] border-t border-gray-100 dark:border-gray-800 text-center">
          <p className="text-[14px] text-gray-500 !mb-0">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-lime-600 hover:text-lime-700 font-medium"
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
        <CardBody className="p-[24px] md:p-[32px]">
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
