"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

interface UseUserResult {
  user: User | null;
  loading: boolean;
  signedIn: boolean;
}

export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    async function getUser() {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();

        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (!mounted) return;
        setUser(currentUser);
        setLoading(false);

        // Listen for auth state changes
        const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(
          (_event: string, session: { user: User | null } | null) => {
            if (mounted) setUser(session?.user ?? null);
          }
        );
        subscription = sub;
      } catch {
        if (mounted) setLoading(false);
      }
    }

    getUser();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  return { user, loading, signedIn: !!user };
}
