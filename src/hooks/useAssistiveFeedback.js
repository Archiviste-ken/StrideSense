"use client";

import { useCallback, useEffect } from "react";
import { useVoiceEngine } from "./useVoiceEngine";

export function useAssistiveFeedback() {
  const voiceEngine = useVoiceEngine();



  const speak = useCallback(
    (message) => {
      voiceEngine.speak(message);
    },
    [voiceEngine],
  );

  const speakLongText = useCallback(
    async (text) => {
      if (!text) return;

      try {
        voiceEngine.cancel();

        const sentences = text
          .replace(/\n/g, " ")
          .split(/(?<=[.?!])\s+/)
          .map((sentence) => sentence.trim())
          .filter(Boolean);

        for (const sentence of sentences) {
          // Queue each sentence to avoid overlap while preserving ordering.
          // Returning/awaiting keeps the chain predictable without touching callers.
          // eslint-disable-next-line no-await-in-loop
          await voiceEngine.speak(sentence);
        }
      } catch {
        // Ignore speech errors in prototype
      }
    },
    [voiceEngine],
  );

  const vibrate = useCallback((pattern = 200) => {
    if (typeof window === "undefined") return;
    if (typeof navigator === "undefined") return;
    if (typeof navigator.vibrate !== "function") return;

    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration errors in prototype
    }
  }, []);

  const notifyComingSoon = useCallback(
    (message = "Feature coming soon") => {
      speak(message);
      vibrate(150);
    },
    [speak, vibrate],
  );

  const announceNavigation = useCallback(
    (label) => {
      if (!label) return;
      const message = `Opening ${label} tab`;
      vibrate(120);
      speak(message);
    },
    [speak, vibrate],
  );

  return { speak, speakLongText, vibrate, notifyComingSoon, announceNavigation };
}
