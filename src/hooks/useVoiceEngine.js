"use client";

import { useMemo } from "react";

let singletonEngine = null;

function normalizeText(text) {
  if (typeof text !== "string") return "";
  return text.trim();
}

function createVoiceEngine() {
  let queue = [];
  let isSpeaking = false;
  let currentItem = null;
  let lastQueuedText = "";

  function getSynth() {
    if (typeof window === "undefined") return null;
    return window.speechSynthesis || null;
  }

  function resolveItem(item) {
    try {
      item?.resolve?.();
    } catch {
      // ignore
    }
  }

  function flushQueue() {
    const pending = queue;
    queue = [];
    pending.forEach(resolveItem);
  }

  function cancelInternal() {
    const synth = getSynth();
    flushQueue();

    if (currentItem) {
      resolveItem(currentItem);
      currentItem = null;
    }

    isSpeaking = false;

    try {
      synth?.cancel?.();
    } catch {
      // ignore
    }
  }

  function processNext() {
    const synth = getSynth();
    if (!synth) {
      cancelInternal();
      return;
    }

    if (isSpeaking) return;

    const next = queue.shift();
    if (!next) return;

    const text = normalizeText(next.text);
    if (!text) {
      resolveItem(next);
      processNext();
      return;
    }

    isSpeaking = true;
    currentItem = next;

    let utterance;
    try {
      utterance = new SpeechSynthesisUtterance(text);
    } catch {
      isSpeaking = false;
      currentItem = null;
      resolveItem(next);
      processNext();
      return;
    }

    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    const done = () => {
      if (currentItem === next) {
        currentItem = null;
      }
      isSpeaking = false;
      resolveItem(next);
      processNext();
    };

    utterance.onend = done;
    utterance.onerror = done;

    try {
      synth.speak(utterance);
    } catch {
      done();
    }
  }

  function speak(text, priority = "normal") {
    const normalized = normalizeText(text);
    if (!normalized) return Promise.resolve();

    const synth = getSynth();
    if (!synth) return Promise.resolve();

    const currentText = normalizeText(currentItem?.text);
    const lastInQueueText = normalizeText(queue[queue.length - 1]?.text);

    if (
      normalized === currentText ||
      normalized === lastInQueueText ||
      normalized === lastQueuedText
    ) {
      return Promise.resolve();
    }

    lastQueuedText = normalized;

    if (priority === "high") {
      cancelInternal();
    }

    return new Promise((resolve) => {
      queue.push({ text: normalized, priority, resolve });
      processNext();
    });
  }

  function cancel() {
    cancelInternal();
  }

  return { speak, cancel };
}

export function useVoiceEngine() {
  return useMemo(() => {
    if (!singletonEngine) {
      singletonEngine = createVoiceEngine();
    }
    return singletonEngine;
  }, []);
}
