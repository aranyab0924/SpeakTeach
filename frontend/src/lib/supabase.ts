import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

function isValidSupabaseUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function createBrowserClient(): SupabaseClient | null {
  if (!url || !key || !isValidSupabaseUrl(url)) {
    return null;
  }
  try {
    return createClient(url, key);
  } catch {
    return null;
  }
}

export const supabase: SupabaseClient | null = createBrowserClient();
export const isSupabaseConfigured = supabase !== null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. In frontend/.env.local, set VITE_SUPABASE_URL to https://YOUR_PROJECT.supabase.co and VITE_SUPABASE_ANON_KEY to the publishable key, then restart npm run dev.",
    );
  }
  return supabase;
}
