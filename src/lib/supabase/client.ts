import { createBrowserClient } from "@supabase/ssr";

// Hoist static config to module level — evaluated once, not per call
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!client) {
    client = createBrowserClient(supabaseUrl, supabaseKey);
  }
  return client;
}
