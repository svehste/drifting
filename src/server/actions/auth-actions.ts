"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { nb } from "@/copy/nb";
import { createSupabaseServerClient, supabaseConfigured } from "@/server/supabase";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export interface SignInState {
  error?: string;
}

/** Staff sign-in with email + password (Authentication AC 1). */
export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: nb.errors.invalidInput };

  // Dev-login: with no Supabase configured, getCurrentUser already acts as the
  // seeded admin, so a successful form submit just lands on the admin area.
  if (!supabaseConfigured()) redirect("/admin");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Feil e-post eller passord." };

  redirect("/admin");
}

/** Sign out and return to the front page (Authentication AC 5). */
export async function signOut(): Promise<void> {
  if (!supabaseConfigured()) redirect("/");
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
