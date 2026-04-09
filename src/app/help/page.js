"use client";

import { useState } from "react";
import { useAssistiveFeedback } from "../../hooks/useAssistiveFeedback";

export default function HelpPage() {
  const { speak, vibrate, notifyComingSoon } = useAssistiveFeedback();
  const [message, setMessage] = useState(
    "Live assistance feature coming soon.",
  );

  const showComingSoonAlert = () => {
    if (typeof window === "undefined") return;

    try {
      // Simple blocking alert for clarity; acceptable in prototype.
      window.alert("Feature coming soon");
    } catch {
      // Ignore alert errors
    }
  };

  const handleVolunteer = () => {
    speak("Requesting assistance. Feature coming soon.");
    vibrate(200);
    setMessage("Requesting assistance… Feature coming soon.");
    showComingSoonAlert();
  };

  const handleEmergency = () => {
    setMessage("Emergency contact feature coming soon.");
    notifyComingSoon("Emergency contact feature coming soon");
  };

  return (
    <main className="flex-1 px-4 pt-6 pb-24 w-full max-w-md md:max-w-xl lg:max-w-2xl mx-auto">
      <section aria-labelledby="help-title" className="space-y-6">
        <header className="space-y-1">
          <h1
            id="help-title"
            className="text-2xl md:text-3xl font-semibold tracking-tight text-white"
          >
            Get Help
          </h1>
          <p className="text-sm text-slate-400">
            Quickly reach volunteers or emergency contacts.
          </p>
        </header>

        <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-5 space-y-4 shadow-lg">
          <button
            type="button"
            onClick={handleVolunteer}
            aria-label="Call a volunteer for assistance"
            className="w-full min-h-[72px] rounded-2xl bg-sky-500 text-lg md:text-xl font-semibold text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 hover:bg-sky-400 active:bg-sky-500/80 transition-colors"
          >
            Call a Volunteer
          </button>

          <button
            type="button"
            onClick={handleEmergency}
            aria-label="Open emergency contact options"
            className="w-full min-h-[64px] rounded-2xl bg-slate-800 text-base md:text-lg font-semibold text-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 hover:bg-slate-700 active:bg-slate-800/80 transition-colors"
          >
            Emergency Contact
          </button>

          <p className="text-xs md:text-sm text-slate-400" aria-live="polite">
            {message}
          </p>
        </div>
      </section>
    </main>
  );
}
