import { LogOut } from "lucide-react";
import { signOut } from "@/lib/actions/auth";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        aria-label="Sign out"
        title="Sign out"
        className="grid size-9 place-items-center rounded-md text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink"
      >
        <LogOut className="size-4" aria-hidden />
      </button>
    </form>
  );
}
