"use client";

import { useState } from "react";
import { useAssistiveFeedback } from "../../hooks/useAssistiveFeedback";

export default function CameraPage() {
  const { notifyComingSoon } = useAssistiveFeedback();
  const [message, setMessage] = useState("Camera features coming soon.");

  const handleCameraAction = async (label) => {
    setMessage(`Feature coming soon: ${label}.`);
    notifyComingSoon("Camera feature coming soon");

    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return;
    }

    if (label !== "Open Camera") return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      // Ignore camera errors in prototype
    }
  };

  return (
    <main className="flex-1 px-4 pt-6 pb-24 w-full max-w-md md:max-w-xl lg:max-w-2xl mx-auto">
      <section aria-labelledby="camera-title" className="space-y-6">
        <header className="space-y-1">
          <h1
            id="camera-title"
            className="text-2xl md:text-3xl font-semibold tracking-tight text-white"
          >
            Camera Assist
          </h1>
          <p className="text-sm text-slate-400">
            Use your device camera for future smart detection.
          </p>
        </header>

        <div
          role="group"
          aria-label="Camera preview area"
          className="h-56 rounded-3xl border border-dashed border-slate-700 bg-slate-900/70 flex items-center justify-center px-6 text-center"
        >
          <p className="text-sm md:text-base text-slate-200">
            Camera Assist
            <span className="block text-slate-400">Coming Soon</span>
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleCameraAction("Open Camera")}
            aria-label="Open camera for assistance"
            className="w-full min-h-[64px] rounded-2xl bg-slate-800 text-base md:text-lg font-semibold text-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 hover:bg-slate-700 active:bg-slate-800/80 transition-colors"
          >
            Open Camera
          </button>

          <button
            type="button"
            onClick={() => handleCameraAction("Take Picture")}
            aria-label="Take a picture for assistance"
            className="w-full min-h-[64px] rounded-2xl bg-slate-800 text-base md:text-lg font-semibold text-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 hover:bg-slate-700 active:bg-slate-800/80 transition-colors"
          >
            Take Picture
          </button>

          <button
            type="button"
            onClick={() => handleCameraAction("View History")}
            aria-label="View camera history"
            className="w-full min-h-[64px] rounded-2xl bg-slate-800 text-base md:text-lg font-semibold text-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 hover:bg-slate-700 active:bg-slate-800/80 transition-colors"
          >
            View History
          </button>
        </div>

        <p className="text-xs md:text-sm text-slate-400" aria-live="polite">
          {message}
        </p>
      </section>
    </main>
  );
}
