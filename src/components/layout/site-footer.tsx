import Link from "next/link";
import { Github, Mail, Phone } from "lucide-react";
import { Logo } from "@/components/layout/logo";

/** Where to reach whoever built this. */
const contacts: {
  label: string;
  href: string;
  icon: typeof Github;
  /** Only the GitHub link leaves the site; mailto: and tel: hand off to an app. */
  external?: boolean;
}[] = [
  {
    label: "SAQUIB-KHAN90",
    href: "https://github.com/SAQUIB-KHAN90",
    icon: Github,
    external: true,
  },
  { label: "saquibkhan890098@gmail.com", href: "mailto:saquibkhan890098@gmail.com", icon: Mail },
  // The country code is in the href so it dials from anywhere, and left out
  // of the label, where it would only be noise to the people who live here.
  { label: "9044500609", href: "tel:+919044500609", icon: Phone },
];

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

          <div className="flex flex-col items-center gap-1.5">
            <p>
              Designed and developed by <span className="font-semibold text-ink">Saquib</span>
            </p>
            {/* Icon and label together, not icon alone: three unlabelled
                glyphs make a reader guess, and a phone number nobody can
                read is not a contact detail. */}
            <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              {contacts.map(({ label, href, icon: Icon, external }) => (
                <li key={label}>
                  <a
                    href={href}
                    {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
                    className="inline-flex items-center gap-1.5 transition-colors hover:text-brand hover:underline"
                  >
                    <Icon className="size-3.5 shrink-0" aria-hidden />
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <span className="text-center md:text-right">Terms · Privacy · Safety policy</span>
        </div>
      </div>
    </footer>
  );
}
