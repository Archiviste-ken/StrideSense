"use client";

import { useState } from "react";
import { useAssistiveFeedback } from "../../hooks/useAssistiveFeedback";

export default function ProfilePage() {
  const { notifyComingSoon } = useAssistiveFeedback();
  const [message, setMessage] = useState("Backend integration coming soon.");

  const handleAction = (label) => {
    setMessage(`Backend integration coming soon for ${label}.`);
    notifyComingSoon("Backend integration coming soon");
  };

  return (
    <main className="flex-1 px-4 pt-6 pb-24 w-full max-w-md md:max-w-xl lg:max-w-2xl mx-auto">
      <section aria-labelledby="profile-title" className="space-y-6">
        <header className="space-y-1">
          <h1
            id="profile-title"
            className="text-2xl md:text-3xl font-semibold tracking-tight text-white"
          >
            Profile &amp; Settings
          </h1>
          <p className="text-sm text-slate-400">
            Manage your basic details and preferences.
          </p>
        </header>

        <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-5 space-y-4 shadow-lg">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Name
            </p>
            <p className="text-lg font-semibold text-white">Demo User</p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() => handleAction("Manage Contacts")}
              aria-label="Manage contacts for assistance"
              className="w-full min-h-[76px] rounded-3xl bg-slate-800 text-lg md:text-xl font-semibold text-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 hover:bg-slate-700 active:bg-slate-800/80 transition-colors"
            >
              Manage Contacts
            </button>

            <button
              type="button"
              onClick={() => handleAction("Preferences")}
              aria-label="Open accessibility and app preferences"
              className="w-full min-h-[76px] rounded-3xl bg-slate-800 text-lg md:text-xl font-semibold text-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 hover:bg-slate-700 active:bg-slate-800/80 transition-colors"
            >
              Preferences
            </button>

            <p
              className="text-xs md:text-sm text-slate-400 pt-1"
              aria-live="polite"
            >
              {message}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
