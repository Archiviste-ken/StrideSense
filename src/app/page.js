"use client";

import { useEffect, useRef, useState } from "react";
import { useAssistiveFeedback } from "../hooks/useAssistiveFeedback";
import { useVoiceEngine } from "../hooks/useVoiceEngine";

const ASSISTANCE_STATUS = {
  idle: "Idle",
  tracking: "Tracking movement...",
  walking: "Walking detected",
  crossing20: "Crossing ahead in 20 steps",
  crossing10: "Crossing ahead in 10 steps. Turn left",
  reached: "You have reached the crossing",
  stoppedWalking: "You have stopped walking",
};

export default function HomePage() {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState(ASSISTANCE_STATUS.idle);
  const [lastMessage, setLastMessage] = useState("");
  const [, setIsRealMovement] = useState(false);
  const [, setHasSensorPermission] = useState(false);
  const { speak, vibrate } = useAssistiveFeedback();
  const voiceEngine = useVoiceEngine();
  const timersRef = useRef([]);
  const intervalRef = useRef(null);
  const trackingIntervalRef = useRef(null);
  const activeRef = useRef(false);
  const motionListenerRef = useRef(false);
  const motionHandlerRef = useRef(null);
  const movementStateRef = useRef(false);
  const movementStateRef = useRef(false);
  const lastStartChangeRef = useRef(0);
  const lastStopChangeRef = useRef(0);
  const startTimeRef = useRef(0);
  const simulationRunIdRef = useRef(0);
  const lastSpokenTextRef = useRef("");
  const lastSpokenAtRef = useRef(0);
  const simulationStartedRef = useRef(false);
  const simulationPausedRef = useRef(false);
  const simulationPausedRef = useRef(false);
  const smoothedMagnitudeRef = useRef(0);
  const movementBufferRef = useRef([]);

  const clearAllTimers = () => {
    timersRef.current.forEach((timerId) => clearTimeout(timerId));
    timersRef.current = [];
  };

  const clearConfirmationLoop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const clearTrackingAnimation = () => {
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
  };

  const speakAndRemember = (message) => {
    if (!message) return;
    setLastMessage(message);
    lastSpokenTextRef.current = message;
    lastSpokenAtRef.current = Date.now();
    speak(message);
  };

  const delay = (ms) =>
    new Promise((resolve) => {
      const timerId = setTimeout(resolve, ms);
      timersRef.current.push(timerId);
    });

  async function speakAndWait(text) {
    if (!text) return;
    setLastMessage(text);
    lastSpokenTextRef.current = text;
    lastSpokenAtRef.current = Date.now();
    await voiceEngine.speak(text, "normal");
  }

  const startTrackingAnimation = () => {
    const trackingMessages = [
      "Tracking movement...",
      "Tracking movement..",
      "Tracking movement...",
    ];
    let messageIndex = 0;

    clearTrackingAnimation();
    setStatus(trackingMessages[messageIndex]);

    trackingIntervalRef.current = setInterval(() => {
      if (!activeRef.current) {
        clearTrackingAnimation();
        return;
      }

      messageIndex = (messageIndex + 1) % trackingMessages.length;
      setStatus(trackingMessages[messageIndex]);
    }, 600);
  };

  const stopMotionListener = () => {
    if (typeof window === "undefined") return;
    clearConfirmationLoop();
    if (!motionListenerRef.current) return;

    if (motionHandlerRef.current) {
      window.removeEventListener("devicemotion", motionHandlerRef.current);
    }
    motionListenerRef.current = false;
    motionHandlerRef.current = null;
  };

  function handleDeviceMotion(event) {
    if (!activeRef.current) return;
    if (performance.now() - startTimeRef.current < 2000) return;

    const acceleration = event.accelerationIncludingGravity;
    if (!acceleration) return;

    const rawMagnitude =
      Math.abs(acceleration.x ?? 0) +
      Math.abs(acceleration.y ?? 0) +
      Math.abs(acceleration.z ?? 0);

    // exponential smoothing
    smoothedMagnitudeRef.current =
      smoothedMagnitudeRef.current * 0.8 + rawMagnitude * 0.2;

    const threshold = 12;
    const isMoving = smoothedMagnitudeRef.current > threshold;
    const now = performance.now();

    // push data
    movementBufferRef.current.push({
      t: now,
      moving: isMoving,
    });

    // keep only last 1200ms
    movementBufferRef.current = movementBufferRef.current.filter(
      (entry) => now - entry.t < 1200,
    );

    const buffer = movementBufferRef.current;
    const movingCount = buffer.filter((e) => e.moving).length;
    const ratio = buffer.length ? movingCount / buffer.length : 0;

    const stableMoving = ratio > 0.6;
    const stableStopped = ratio < 0.2;

    if (
      (stableMoving && movementStateRef.current) ||
      (stableStopped && !movementStateRef.current)
    )
      return;

    if (stableMoving) {
      if (now - lastStartChangeRef.current < 1500) return;
      lastStartChangeRef.current = now;
      movementStateRef.current = true;
    } else if (stableStopped) {
      if (now - lastStopChangeRef.current < 3500) return;
      lastStopChangeRef.current = now;
      movementStateRef.current = false;
    } else {
      return;
    }

    setIsRealMovement(movementStateRef.current);

    if (movementStateRef.current) {
      simulationPausedRef.current = false;
      if (!simulationStartedRef.current) {
        clearAllTimers();
        vibrate([100, 50, 100]);

        simulationStartedRef.current = true;

        const msg = "Assistance started. Monitoring movement.";
        voiceEngine.speak(msg, "high");
        setLastMessage(msg);

        runSimulation(true);
      }
      setStatus(ASSISTANCE_STATUS.walking);
      clearConfirmationLoop();
    } else {
      vibrate([200, 100, 200]);
      if (
        performance.now() - startTimeRef.current > 4000 &&
        stableStopped
      ) {
        simulationPausedRef.current = true;
      }
      simulationStartedRef.current = false;

      // cancel any ongoing speech
      voiceEngine.cancel();

      setStatus(ASSISTANCE_STATUS.stoppedWalking);

      // speak AFTER cancel using high priority
      voiceEngine.speak("You have stopped walking", "high");

      setLastMessage("You have stopped walking");
      clearConfirmationLoop();
    }
  }

  const startMotionListener = async () => {
    if (typeof window === "undefined") return false;
    if (typeof DeviceMotionEvent === "undefined") return false;

    try {
      if (typeof DeviceMotionEvent.requestPermission !== "function") {
        setHasSensorPermission(true);
        if (!motionListenerRef.current) {
          motionHandlerRef.current = handleDeviceMotion;
          window.addEventListener("devicemotion", motionHandlerRef.current);
          motionListenerRef.current = true;
        }
        return true;
      }

      const permission = await DeviceMotionEvent.requestPermission();
      if (permission !== "granted") {
        return false;
      }
      setHasSensorPermission(true);

      if (!motionListenerRef.current) {
        motionHandlerRef.current = handleDeviceMotion;
        window.addEventListener("devicemotion", motionHandlerRef.current);
        motionListenerRef.current = true;
      }

      return true;
    } catch {
      return false;
    }
  };

  const runSimulation = async (sensorAvailable) => {
    clearAllTimers();
    simulationRunIdRef.current += 1;
    const runId = simulationRunIdRef.current;

    const startMessage = sensorAvailable
      ? "Assistance started. Monitoring your movement and surroundings."
      : "Assistance started. Running in simulation mode.";

    // already announced via movement trigger

    if (!activeRef.current || simulationRunIdRef.current !== runId) {
      simulationStartedRef.current = false;
      return;
    }

    const reachedDelay = 10800 + Math.random() * 800;

    const phases = [
      {
        delay: 1200,
        status: "Analyzing movement...",
        message: "Analyzing your movement pattern",
      },
      {
        delay: 1900 + Math.random() * 500,
        status: ASSISTANCE_STATUS.walking,
        message: "You are walking steadily",
      },
      {
        delay: 4600 + Math.random() * 800,
        message: "Attention",
      },
      {
        delay: 4800 + Math.random() * 800,
        status: ASSISTANCE_STATUS.crossing20,
        message: "Crossing ahead in 20 steps",
      },
      {
        delay: 7800 + Math.random() * 800,
        status: ASSISTANCE_STATUS.crossing10,
        message: `Crossing ahead in 10 steps. Turn ${Math.random() > 0.5 ? "left" : "right"
          }`,
      },
      {
        delay: reachedDelay,
        status: ASSISTANCE_STATUS.reached,
        message: "You have reached the crossing. Proceed carefully",
      },
      {
        delay: reachedDelay + 1200 + Math.random() * 600,
        message: "Path is clear. You may proceed.",
      },
      {
        delay: 13800 + Math.random() * 800,
        status: ASSISTANCE_STATUS.stoppedWalking,
        message: "You have stopped walking",
      },
    ];

    let previousDelay = 0;
    for (const phase of phases) {
      if (simulationPausedRef.current) {
        simulationStartedRef.current = false;
        return;
      }
      const waitMs = Math.max(0, phase.delay - previousDelay);
      previousDelay = phase.delay;

      await delay(waitMs);
      if (!activeRef.current || simulationRunIdRef.current !== runId) {
        simulationStartedRef.current = false;
        return;
      }

      clearTrackingAnimation();

      if (
        movementStateRef.current &&
        phase.status === ASSISTANCE_STATUS.walking
      ) {
        continue;
      }

      // 1. Update UI FIRST (so user sees context)
      if (phase.status) {
        setStatus(phase.status);
      }

      // 3. Speak AFTER UI + vibration
      const start = performance.now();
      await speakAndWait(phase.message);
      const elapsed = performance.now() - start;
      const remaining = Math.max(0, 1000 - elapsed);
      if (remaining > 0) {
        await delay(remaining);
      }

      // 4. Short natural delay
      await delay(600 + Math.random() * 200);
    }
    simulationStartedRef.current = false;
  };

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (typeof window !== "undefined" && motionListenerRef.current) {
        if (motionHandlerRef.current) {
          window.removeEventListener("devicemotion", motionHandlerRef.current);
        }
        motionListenerRef.current = false;
        motionHandlerRef.current = null;
      }
      clearConfirmationLoop();
      clearTrackingAnimation();
      timersRef.current.forEach((timerId) => clearTimeout(timerId));
      timersRef.current = [];
    };
  }, []);

  const handleToggleAssistance = async () => {
    const nextActive = !isActive;

    if (nextActive) {
      vibrate([180, 100, 180]); // stronger start
    } else {
      vibrate([120, 60, 120]); // clear stop
    }

    activeRef.current = nextActive;
    setIsActive(nextActive);

    if (nextActive) {
      startTimeRef.current = performance.now();
      movementStateRef.current = false;
      setIsRealMovement(false);
      lastStartChangeRef.current = 0;
      lastStopChangeRef.current = 0;

      const sensorAvailable = await startMotionListener();
      if (!sensorAvailable) {
        speakAndRemember("Sensor unavailable. Switching to simulation mode.");
        runSimulation(false);
      } else {
        const msg = "Tracking movement. Start walking.";
        voiceEngine.speak(msg, "high");
        setLastMessage(msg);
      }
    } else {
      simulationStartedRef.current = false;
      simulationPausedRef.current = false;
      startTimeRef.current = 0;
      stopMotionListener();
      clearAllTimers();
      simulationRunIdRef.current += 1;
      clearConfirmationLoop();
      clearTrackingAnimation();
      movementStateRef.current = false;
      setIsRealMovement(false);
      lastChangeRef.current = 0;
      setStatus(ASSISTANCE_STATUS.idle);
      speakAndRemember("Assistance stopped");
    }
  };

  const handleRepeatInstruction = () => {
    vibrate(60);
    if (!lastMessage) {
      speak("No instruction available yet");
      return;
    }
    speak(lastMessage);
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

          <button
            type="button"
            onClick={handleRepeatInstruction}
            aria-label="Repeat last instruction"
            disabled={!lastMessage || !isActive}
            className="w-full min-h-[80px] rounded-3xl bg-slate-800 text-lg md:text-xl font-semibold text-slate-100 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 hover:bg-slate-700 active:bg-slate-800/80 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            Repeat Instruction
          </button>

          <p
            className="text-sm md:text-base text-slate-200"
            aria-live="polite"
            aria-atomic="true"
          >
            {status}
          </p>

          <ul className="space-y-1 text-xs md:text-sm text-slate-400">
            <li>
              Demo-only walking simulation with speech and vibration cues.
            </li>
            <li>
              Real movement detection takes priority when sensor access is
              available.
            </li>
            <li>
              Use the repeat button to replay the last spoken instruction.
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
