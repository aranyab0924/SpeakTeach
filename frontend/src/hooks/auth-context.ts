import { createContext } from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "../lib/supabase";

export type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
};

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  configured: isSupabaseConfigured,
});
