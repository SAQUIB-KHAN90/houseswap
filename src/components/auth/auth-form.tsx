"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/actions/auth";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "One moment…" : children}
    </Button>
  );
}

/**
 * Wraps the sign-in and sign-up forms so both report the same way: the server
 * action returns a message, or redirects and never returns at all.
 */
export function AuthForm({
  action,
  submitLabel,
  children,
}: {
  action: (prev: FormState, data: FormData) => Promise<FormState>;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      {children}
      {state?.error && (
        <p role="alert" className="rounded-md bg-alert/10 px-3.5 py-2.5 text-sm text-alert">
          {state.error}
        </p>
      )}
      <Submit>{submitLabel}</Submit>
    </form>
  );
}
