"use client";

import { useRef, useState } from "react";
import { useAssistiveFeedback } from "../hooks/useAssistiveFeedback";

const ASSISTANCE_STATUS = {
  idle: "Idle",
  tracking: "Tracking location…",
  smartDetection: "Coming Soon: Smart Detection",
};

export default function HomePage() {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState(ASSISTANCE_STATUS.idle);
  const { speak, vibrate } = useAssistiveFeedback();
  const timerRef = useRef(null);

  const handleToggleAssistance = () => {
    const nextActive = !isActive;
    setIsActive(nextActive);
    vibrate(200);

    if (nextActive) {
      setStatus(ASSISTANCE_STATUS.tracking);

      if (typeof window !== "undefined" && "geolocation" in navigator) {
        try {
          navigator.geolocation.getCurrentPosition(
            () => {
              // Location acquired; no-op for prototype
            },
            () => {
              // Ignore location errors in prototype
            },
          );
        } catch {
          // Ignore unexpected geolocation errors
        }
      }

      if (typeof window !== "undefined") {
        if (timerRef.current) {
          window.clearTimeout(timerRef.current);
        }

        timerRef.current = window.setTimeout(() => {
          setStatus(ASSISTANCE_STATUS.smartDetection);
        }, 3000);
      }

      speak("Assistance started");
    } else {
      if (typeof window !== "undefined" && timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      setStatus(ASSISTANCE_STATUS.idle);
      speak("Assistance stopped");
    }
  };

  return (
    <main className="flex-1 px-4 pt-6 pb-24 w-full max-w-md md:max-w-xl lg:max-w-2xl mx-auto">
      <section aria-labelledby="home-title" className="space-y-6">
        <header className="space-y-1">
          <p className="text-sm text-slate-300">StrideSense</p>
          <h1
            id="home-title"
            className="text-2xl md:text-3xl font-semibold tracking-tight text-white"
          >
            Smart Assistive System
          </h1>
          <p className="text-sm text-slate-400">
            Crossing assistant prototype for visually impaired users.
          </p>
        </header>

        <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-5 space-y-4 shadow-lg">
          <button
            type="button"
            onClick={handleToggleAssistance}
            aria-label={
              isActive ? "Stop assistance" : "Start assistance for crossing"
            }
            className="w-full min-h-[88px] rounded-3xl bg-sky-500 text-xl md:text-2xl font-semibold text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 hover:bg-sky-400 active:bg-sky-500/80 transition-colors"
          >
            {isActive ? "Stop Assistance" : "Start Assistance"}
          </button>

          <p className="text-sm md:text-base text-slate-200" aria-live="polite">
            {status}
          </p>

          <ul className="space-y-1 text-xs md:text-sm text-slate-400">
            <li>Tracking location when assistance is active.</li>
            <li>Coming Soon: Smart Detection for safer crossings.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
