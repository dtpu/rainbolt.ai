import { createClient } from "@supabase/supabase-js";

/**
 * Single browser client for auth + data. Sessions persist in localStorage and
 * `detectSessionInUrl` completes magic-link / OAuth redirects on any page.
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://oghjtxovwwboeddejlng.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
);

// Handle for end-to-end tests (headless sign-in without the email loop).
if (typeof window !== "undefined") {
  (window as unknown as { __sb: typeof supabase }).__sb = supabase;
}
