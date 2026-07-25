"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { nb } from "@/copy/nb";
import { createSupabaseServerClient } from "@/server/supabase";

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

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Feil e-post eller passord." };

  redirect("/");
}

/** Sign out and return to the front page (Authentication AC 5). */
export async function signOut(): Promise<void> {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
