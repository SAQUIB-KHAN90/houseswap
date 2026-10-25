"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { selfVerifyAllowed } from "@/lib/kyc/stand-in";

export type FormState = { error: string } | null;

const CITIES = ["Delhi", "Chandigarh", "Jaipur"];

function text(data: FormData, key: string): string {
  return String(data.get(key) ?? "").trim();
}

/**
 * Creates the auth user and the matching `profiles` row.
 *
 * The profile is inserted from the client's own session, so the
 * `profiles_insert_own` policy applies and a member can only ever create their
 * own. Nothing grants points here: the trigger on `kyc_status` does that when
 * verification passes.
 */
export async function signUp(_prev: FormState, data: FormData): Promise<FormState> {
  const fullName = text(data, "name");
  const email = text(data, "email");
  const password = String(data.get("password") ?? "");
  const phone = text(data, "phone");
  const city = text(data, "city");

  if (!fullName) return { error: "Enter your name as it appears on your ID." };
  if (!email) return { error: "Enter your email address." };
  if (password.length < 8) return { error: "Use a password of at least 8 characters." };
  if (!CITIES.includes(city)) return { error: "Choose one of the pilot cities." };

  const supabase = await createClient();
  const { data: created, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) return { error: error.message };

  // With email confirmation on, there is no session yet and the profile is
  // written on first sign-in instead.
  if (!created.session) {
    redirect("/login?check_email=1");
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: created.user!.id,
    full_name: fullName,
    email,
    phone: phone || null,
    home_city: city,
  });
  if (profileError) return { error: profileError.message };

  revalidatePath("/", "layout");
  redirect("/verify");
}

export async function signIn(_prev: FormState, data: FormData): Promise<FormState> {
  const email = text(data, "email");
  const password = String(data.get("password") ?? "");
  const next = text(data, "next") || "/trip";

  const supabase = await createClient();
  const { data: session, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  // A member who signed up before confirming their email has no profile yet.
  await ensureProfile(session.user.id, session.user.email ?? email, session.user.user_metadata);

  revalidatePath("/", "layout");
  redirect(next.startsWith("/") ? next : "/trip");
}

async function ensureProfile(
  id: string,
  email: string,
  metadata: Record<string, unknown> | undefined
) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (existing) return;

  await supabase.from("profiles").insert({
    id,
    full_name: String(metadata?.full_name ?? email.split("@")[0]),
    email,
  });
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Marks the member verified, without checking anything.
 *
 * A placeholder for the pilot: the real flow hands off to a licensed KYC
 * provider and this status is set from its webhook in `app/api/webhooks/kyc`,
 * never from the browser. Until a provider is chosen (prd.md 16) this keeps the
 * rest of the product testable end to end, because `request_stay` refuses an
 * unverified member.
 *
 * Delete it when the webhook goes live. Until then it refuses to run anywhere
 * it could do harm.
 */
export async function completeVerification(): Promise<FormState> {
  if (!selfVerifyAllowed()) {
    return {
      error:
        "ID verification is not connected yet. A licensed provider does this check, and self-verification is disabled here.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first." };

  const { error } = await supabase
    .from("profiles")
    .update({
      kyc_status: "verified",
      selfie_match: true,
      kyc_reference: `pilot-stand-in:${user.id}`,
      trust_score: 5.0,
    })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return null;
}
