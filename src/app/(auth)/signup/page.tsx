import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { signUp } from "@/lib/actions/auth";

export default function SignupPage() {
  return (
    <div>
      <h1 className="text-[32px] font-bold">Create your account</h1>
      <p className="mt-1.5 text-muted">Next you'll verify your ID. It takes about three minutes.</p>

      <AuthForm action={signUp} submitLabel="Continue to verification">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" required placeholder="As on your ID" autoComplete="name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Mobile number</Label>
          <Input id="phone" name="phone" type="tel" placeholder="+91" autoComplete="tel" />
        </div>
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
          <Label htmlFor="city">Your city</Label>
          <Select id="city" name="city" defaultValue="Delhi">
            <option>Delhi</option>
            <option>Chandigarh</option>
            <option>Jaipur</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <p className="text-sm text-muted">At least 8 characters.</p>
        </div>
      </AuthForm>

      <p className="mt-8 text-sm text-muted">
        Already a member?{" "}
        <Link href="/login" className="font-semibold text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
