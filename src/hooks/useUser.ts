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

    async function getUser() {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();

        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (mounted) {
          setUser(currentUser);
          setLoading(false);
        }

        // Listen for auth state changes
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          if (mounted) {
            setUser(session?.user ?? null);
          }
        });

        return () => {
          mounted = false;
          subscription.unsubscribe();
        };
      } catch {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    getUser();

    return () => {
      mounted = false;
    };
  }, []);

  return { user, loading, signedIn: !!user };
}
