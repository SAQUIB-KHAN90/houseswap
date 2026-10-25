"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BadgeCheck, Camera, FileText, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completeVerification } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

const steps = ["Government ID", "Selfie", "Done"];

/**
 * The verification flow.
 *
 * The two steps are a stand-in: a licensed provider does the real check and
 * sets `profiles.kyc_status` from its webhook. Until one is chosen (prd.md 16)
 * the last step calls `completeVerification()`, which marks the member verified
 * so the starter points land and the rest of the product can be used.
 */
export function VerifyFlow({
  starterPoints,
  standInEnabled,
}: {
  starterPoints: number;
  /** Whether the self-verification placeholder will actually run here. */
  standInEnabled: boolean;
}) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function finish() {
    setError(null);
    start(async () => {
      const result = await completeVerification();
      if (result?.error) {
        setError(result.error);
        return;
      }
      setStep(2);
      router.refresh();
    });
  }

  return (
    <div>
      <ol className="mb-9 flex items-center gap-3" aria-label="Verification progress">
        {steps.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-3">
            <span
              aria-current={i === step ? "step" : undefined}
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                i <= step ? "bg-brand text-white" : "bg-ink/[0.07] text-muted"
              )}
            >
              {i + 1}
            </span>
            <span
              className={cn("hidden text-sm sm:block", i === step ? "font-semibold" : "text-muted")}
            >
              {s}
            </span>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-line" aria-hidden />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div>
          <h1 className="text-[32px] font-bold">Confirm your ID</h1>
          <p className="mt-1.5 text-muted">
            Use DigiLocker to share your Aadhaar or another government ID. We never see or store the
            number.
          </p>
          <div className="mt-7 grid place-items-center rounded-lg border-2 border-dashed border-field bg-surface px-6 py-11 text-center">
            <FileText className="size-8 text-brand" aria-hidden />
            <p className="mt-3.5 font-semibold">Connect DigiLocker</p>
            <p className="mt-1 max-w-xs text-sm text-muted">
              You'll be sent to a secure page and brought back here.
            </p>
          </div>
          <p className="mt-4 flex items-start gap-2 text-sm text-muted">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            Handled by a licensed verification provider.
          </p>
          {!standInEnabled && (
            <p className="mt-4 rounded-md bg-star/15 px-3.5 py-2.5 text-sm text-[#8a5a10]">
              No verification provider is connected yet, so this cannot be completed
              here. Until one is, members are verified by staff.
            </p>
          )}
          <Button
            size="lg"
            className="mt-7 w-full"
            disabled={!standInEnabled}
            onClick={() => setStep(1)}
          >
            Connect DigiLocker
          </Button>
        </div>
      )}

      {step === 1 && (
        <div>
          <h1 className="text-[32px] font-bold">Take a selfie</h1>
          <p className="mt-1.5 text-muted">
            We match it to your ID so nobody can sign up with someone else's document.
          </p>
          <div className="mx-auto mt-7 grid aspect-square max-w-[260px] place-items-center rounded-full border-2 border-dashed border-field bg-surface">
            <Camera className="size-9 text-brand" aria-hidden />
          </div>
          <p className="mt-4 text-center text-sm text-muted">
            Face the camera in good light. Remove glasses and hats.
          </p>
          {error && (
            <p role="alert" className="mt-4 text-sm text-alert">
              {error}
            </p>
          )}
          <Button size="lg" className="mt-7 w-full" onClick={finish} disabled={pending}>
            {pending ? "Checking…" : "Open camera"}
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="text-center">
          <span className="mx-auto grid size-[72px] place-items-center rounded-full bg-brand-tint">
            <BadgeCheck className="size-9 text-brand" aria-hidden />
          </span>
          <h1 className="mt-5 text-[32px] font-bold">You're verified</h1>
          <p className="mx-auto mt-2 max-w-sm text-muted">
            We've added {starterPoints} starter points to your account. That's enough for a short
            first trip.
          </p>
          <div className="mt-7 flex flex-col gap-2.5">
            <Button asChild size="lg">
              <Link href="/trip">Plan a trip</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/listings/new">List your home</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
