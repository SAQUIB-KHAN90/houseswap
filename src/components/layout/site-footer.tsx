import Link from "next/link";
import { Logo } from "@/components/layout/logo";

const cols: { title: string; links: [string, string][] }[] = [
  {
    title: "Travelling",
    links: [
      ["Find a stay", "/search"],
      ["How points work", "/#faq"],
      ["Plan a trip", "/trip"],
    ],
  },
  {
    title: "Hosting",
    links: [
      ["List your home", "/listings/new"],
      ["Ways to offer", "/#homes"],
      ["Host dashboard", "/host"],
    ],
  },
  {
    title: "Trust",
    links: [
      ["Verification", "/#trust"],
      ["Photo checks", "/#trust"],
      ["Disputes", "/#faq"],
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-surface">
      <div className="container-x grid gap-10 py-14 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="max-w-xs space-y-3">
          <Logo />
          <p className="text-sm leading-relaxed text-muted">
            Swap homes across India. Host a stay, earn points, spend them in any city.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h2 className="mb-3.5 text-sm font-semibold">{c.title}</h2>
            <ul className="space-y-2.5">
              {c.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-muted hover:text-ink">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        {/* Three columns on desktop so the credit sits in the middle rather
            than reading as part of either side. It stacks on a phone, where
            there is no middle to sit in. */}
        <div className="container-x flex flex-col items-center gap-3 py-5 text-xs text-muted md:grid md:grid-cols-3 md:gap-2">
          <span className="text-center md:text-left">
            © 2026 HouseSwap · Pilot in Delhi, Chandigarh and Jaipur
          </span>

          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
            <span>
              Designed and developed by{" "}
              <a
                href="https://github.com/SAQUIB-KHAN90"
                target="_blank"
                rel="noreferrer noopener"
                className="font-semibold text-ink hover:text-brand hover:underline"
              >
                Saquib
              </a>
            </span>
            <span aria-hidden>·</span>
            <a
              href="mailto:saquibkhan890098@gmail.com"
              className="hover:text-ink hover:underline"
            >
              saquibkhan890098@gmail.com
            </a>
            <span aria-hidden>·</span>
            <a href="tel:+919044500609" className="hover:text-ink hover:underline">
              9044500609
            </a>
          </p>

          <span className="text-center md:text-right">Terms · Privacy · Safety policy</span>
        </div>
      </div>
    </footer>
  );
}
