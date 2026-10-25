import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;

  return (
    <div>
      <h1 className="text-[32px] font-bold">Sign in</h1>
      <p className="mt-1.5 text-muted">Welcome back.</p>

      {sp.check_email && (
        <p className="mt-5 rounded-md bg-brand-tint px-3.5 py-2.5 text-sm text-brand">
          Check your email for the confirmation link, then sign in here.
        </p>
      )}

      <AuthForm action={signIn} submitLabel="Sign in">
        <input type="hidden" name="next" value={sp.next ?? "/trip"} />
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
      </AuthForm>

      <p className="mt-8 text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
