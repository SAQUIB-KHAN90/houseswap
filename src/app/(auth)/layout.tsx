import { Logo } from "@/components/layout/logo";
import { Photo } from "@/components/ui/photo";
import { heroPhoto } from "@/lib/images";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden lg:block">
        <Photo src={heroPhoto} alt="" priority sizes="50vw" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(14,22,19,0.55),rgba(14,22,19,0.8))]" />
        <div className="absolute inset-0 flex flex-col justify-between p-12">
          <Logo invert />
          <div>
            <p className="text-4xl font-extrabold leading-[1.06] text-white">
              Verified before you arrive.
            </p>
            <p className="mt-4 max-w-sm leading-relaxed text-white/80">
              Every member confirms their ID and takes a selfie. Every stay starts and ends with the
              same photo checklist.
            </p>
          </div>
          <p className="text-sm text-white/60">Pilot in Delhi, Chandigarh and Jaipur</p>
        </div>
      </aside>
      <div className="flex flex-col px-4 py-8 sm:px-10">
        <div className="mb-10 lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto my-auto w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
