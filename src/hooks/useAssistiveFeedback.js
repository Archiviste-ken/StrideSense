"use client";

import { useCallback } from "react";

export function useAssistiveFeedback() {
  const speak = useCallback((message) => {
    if (typeof window === "undefined") return;
    if (!message) return;

    const synth = window.speechSynthesis;
    if (!synth) return;

    try {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 1;
      utterance.pitch = 1;
      synth.speak(utterance);
    } catch {
      // Ignore speech errors in prototype
    }
  }, []);

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

  return { speak, vibrate, notifyComingSoon, announceNavigation };
}
