"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useVoiceEngine } from "../hooks/useVoiceEngine";

const TABS = [
  { href: "/", label: "Home" },
  { href: "/camera", label: "Camera" },
  { href: "/help", label: "Get Help" },
  { href: "/profile", label: "Profile" },
];

export function AppShell({ children }) {
  const pathname = usePathname();
  const voiceEngine = useVoiceEngine();

  const isCallActive =
    typeof window !== "undefined" && window.__CALL_ACTIVE__ === true;

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
                  onClick={(e) => {
                    if (pathname === tab.href) return;

                    if (isCallActive && tab.href !== "/help") {
                      e.preventDefault();

                      if (navigator.vibrate) {
                        navigator.vibrate([100, 50, 100]);
                      }

                      voiceEngine.speak(
                        "Call in progress. End call before leaving.",
                        "high"
                      );

                      return;
                    }

                    // SPEAK ONLY — DO NOT CONTROL NAVIGATION
                    voiceEngine.speak(`Opening ${tab.label} tab`, "high").catch(() => {});

                    if (navigator.vibrate) {
                      navigator.vibrate([80, 40, 80]);
                    }
                  }}
                  className={`flex flex-col items-center justify-center rounded-full min-h-[56px] px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black transition-colors ${
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
