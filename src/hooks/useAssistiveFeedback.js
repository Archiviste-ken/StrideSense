"use client";

import { useCallback, useEffect } from "react";
import { useVoiceEngine } from "./useVoiceEngine";

function safeVibrate(pattern) {
  try {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function"
    ) {
      const success = navigator.vibrate(pattern);
      if (success === false) {
        console.log("Vibration blocked by browser");
      }
    }
  } catch {
    // silent fail
  }
}

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
    safeVibrate(pattern);
  }, []);

  const notifyComingSoon = useCallback(
    (message = "Feature coming soon") => {
      speak(message);
    },
    [speak, vibrate],
  );

  const announceNavigation = useCallback(
    (label) => {
      if (!label) return;
      const message = `Opening ${label} tab`;
      speak(message);
    },
    [speak, vibrate],
  );

  return { speak, speakLongText, vibrate, notifyComingSoon, announceNavigation };
}
