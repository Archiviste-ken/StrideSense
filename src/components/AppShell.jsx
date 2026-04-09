"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home" },
  { href: "/camera", label: "Camera" },
  { href: "/help", label: "Get Help" },
  { href: "/profile", label: "Profile" },
];

export function AppShell({ children }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      <div className="flex-1 flex flex-col">{children}</div>
      <nav
        className="sticky bottom-0 border-t border-neutral-800 bg-black/80 backdrop-blur px-2 py-2"
        aria-label="Primary navigation"
      >
        <ul className="mx-auto flex max-w-md md:max-w-xl lg:max-w-2xl items-center justify-between gap-1">
          {TABS.map((tab) => {
            const isActive = pathname === tab.href;

            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-label={`Go to ${tab.label} page`}
                  className={`flex flex-col items-center justify-center rounded-2xl py-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black transition-colors ${
                    isActive
                      ? "bg-sky-500 text-white"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <span>{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
