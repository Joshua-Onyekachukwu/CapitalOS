"use server";

import { createClient } from "@/lib/supabase/server";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
}

const isSupabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "placeholder-anon-key";

export async function getCurrentUser(): Promise<UserProfile | null> {
  if (!isSupabaseConfigured) {
    return {
      id: "demo-user",
      email: "founder@capitalos.com",
      full_name: "Demo Founder",
      avatar_url: null,
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // Parallelize: auth is done, now fetch profile
  // (auth must complete first to get user.id, but profile fetch is standalone after that)
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? "",
    full_name: profile?.full_name ?? user.user_metadata?.full_name ?? "",
    avatar_url: profile?.avatar_url ?? null,
  };
}
