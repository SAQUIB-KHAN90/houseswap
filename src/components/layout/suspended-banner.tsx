import { AlertTriangle } from "lucide-react";

/**
 * Shown to a suspended member on every page.
 *
 * Being quietly unable to request a stay, with the error only appearing at the
 * moment of trying, would be worse than being told plainly.
 */
export function SuspendedBanner({ reason }: { reason: string | null }) {
  return (
    <div className="border-b border-alert/25 bg-alert/10">
      <div className="container-x flex items-start gap-3 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-alert" aria-hidden />
        <p className="text-sm leading-relaxed text-alert">
          <span className="font-semibold">Your account is suspended.</span> You cannot
          request a stay or publish a listing, and your homes are off search. Your
          points and history are untouched.
          {reason ? ` Reason given: ${reason}.` : ""} Reply to the email we sent if you
          think this is wrong.
        </p>
      </div>
    </div>
  );
}
