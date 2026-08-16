import type { User } from "@supabase/supabase-js";
import { requireSupabase } from "../lib/supabase";

export async function signUp(email: string, password: string): Promise<{ user: User | null; needsConfirmation: boolean }> {
  const { data, error } = await requireSupabase().auth.signUp({ email, password });
  if (error) {
    throw new Error(error.message);
  }
  return {
    user: data.user,
    needsConfirmation: !data.session,
  };
}

export async function signIn(email: string, password: string): Promise<User> {
  const { data, error } = await requireSupabase().auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    throw new Error(error.message);
  }
  if (!data.user) {
    throw new Error("Sign in failed.");
  }
  return data.user;
}

export async function signOut(): Promise<void> {
  const { error } = await requireSupabase().auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}
