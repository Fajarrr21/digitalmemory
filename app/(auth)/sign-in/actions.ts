"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const SignInSchema = z.object({
  email: z.string().email("That doesn't look like an email."),
  password: z.string().min(1, "Don't forget your password."),
  next: z.string().optional(),
});

export type SignInState = { error?: string };

export async function signIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = SignInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Keep it warm and non-specific (don't reveal whether the email exists).
    return { error: "Hmm, that didn't work. Check your email and password? ♡" };
  }

  const next = parsed.data.next;
  redirect(next && next.startsWith("/") ? next : "/");
}
