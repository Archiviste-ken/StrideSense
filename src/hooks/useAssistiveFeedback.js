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

  const speakLongText = useCallback((text) => {
    if (typeof window === "undefined") return;
    if (!text) return;

    const synth = window.speechSynthesis;
    if (!synth) return;

    try {
      synth.cancel();

      const sentences = text.replace(/\n/g, " ").split(/(?<=[.?!])\s+/);
      let index = 0;

      function speakNext() {
        if (index >= sentences.length) return;

        const sentence = sentences[index]?.trim();
        if (!sentence) {
          index += 1;
          setTimeout(speakNext, 400);
          return;
        }

        const utterance = new SpeechSynthesisUtterance(sentence);
        utterance.rate = 0.85;
        utterance.pitch = 1;
        utterance.volume = 1;

        utterance.onend = () => {
          index += 1;
          setTimeout(speakNext, 400);
        };

        synth.speak(utterance);
      }

      speakNext();
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

  return { speak, speakLongText, vibrate, notifyComingSoon, announceNavigation };
}
