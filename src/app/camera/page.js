"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAssistiveFeedback } from "@/hooks/useAssistiveFeedback";

const INITIAL_MESSAGE =
  "Point your camera toward your surroundings, then take a picture for guidance.";

const FALLBACK_ANALYSIS_MESSAGE = "Unable to analyze surroundings.";
const FOLLOW_UP_QUESTION = "Is there a person or a door nearby?";

export default function CameraPage() {
  const { speak, speakLongText, vibrate, notifyComingSoon } =
    useAssistiveFeedback();
  const [message, setMessage] = useState(INITIAL_MESSAGE);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [facingMode, setFacingMode] = useState("environment");
  const [followUp, setFollowUp] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const analysisAbortRef = useRef(null);
  const analyzingRef = useRef(false);

  const speakWithoutOverlap = (text) => {
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }

    speak(text);
  };

  const stopAnalysisRequest = () => {
    if (analysisAbortRef.current) {
      analysisAbortRef.current.abort();
      analysisAbortRef.current = null;
    }

    analyzingRef.current = false;
    setIsAnalyzing(false);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraActive(false);
  };

  const startCamera = async (mode = facingMode) => {
    if (typeof window === "undefined") return false;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMessage("Camera access is not supported on this device.");
      notifyComingSoon("Camera access is not supported on this device");
      return false;
    }

    stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode },
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play();
      }

      setIsCameraActive(true);
      speak("Camera opened");
      setMessage("Camera preview active. Ready to describe your surroundings.");
      return true;
    } catch {
      setMessage("Unable to access camera. Please check permissions.");
      notifyComingSoon("Unable to access camera. Please check permissions.");
      return false;
    }
  };

  useEffect(() => {
    startCamera();

    return () => {
      stopAnalysisRequest();
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSwitchCamera = async () => {
    const nextFacingMode = facingMode === "environment" ? "user" : "environment";
    const cameraLabel = nextFacingMode === "environment" ? "back" : "front";

    vibrate(120);
    speakWithoutOverlap(`Switched to ${cameraLabel} camera`);
    setFacingMode(nextFacingMode);
    await startCamera(nextFacingMode);
  };

  const handleTakePicture = async () => {
    if (!isCameraActive) {
      const cameraStarted = await startCamera();
      if (!cameraStarted) return;
    }

    if (analyzingRef.current) return;

    analyzingRef.current = true;
    setIsAnalyzing(true);

    try {
      speak("Capturing image");
      const video = videoRef.current;
      if (!video) {
        setMessage("Camera preview is not available.");
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        setMessage("Could not capture picture. This is a prototype feature.");
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg");
      setSnapshot(dataUrl);

      setMessage("Analyzing surroundings...");
      vibrate([150, 80, 120]);
      await speak("Image captured");
      speak("Analyzing scene");
      const controller = new AbortController();
      analysisAbortRef.current = controller;
      const response = await fetch("/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await response.json();
      const result = data?.result || FALLBACK_ANALYSIS_MESSAGE;
      if (analysisAbortRef.current !== controller) return;

      setMessage(result);
      vibrate([100, 50, 100]);
      await speak(result);
      vibrate(200);
    } catch (error) {
      if (error?.name === "AbortError") return;

      setMessage("Network error. Please try again.");
      speakWithoutOverlap(FALLBACK_ANALYSIS_MESSAGE);
      vibrate(150);
    } finally {
      analysisAbortRef.current = null;
      analyzingRef.current = false;
      setIsAnalyzing(false);
    }
  };

  const handleAskMore = () => {
    const variations = [
      "No person detected nearby.",
      "No door detected in your immediate path.",
      "No moving obstacles detected.",
    ];
    const random = variations[Math.floor(Math.random() * variations.length)];

    setFollowUp(FOLLOW_UP_QUESTION);
    vibrate(120);
    speakWithoutOverlap("Checking additional details");
    setMessage(
      (previousMessage) =>
        `${previousMessage}\n\nAdditional insight: ${random}`,
    );
  };

  const handleRepeatMessage = () => {
    if (isAnalyzing) {
      speakWithoutOverlap("Analysis in progress");
      return;
    }

    vibrate(100);
    speakWithoutOverlap(message);
  };

  const handleClosePanel = () => {
    stopAnalysisRequest();
    stopCamera();
    setSnapshot(null);
    setFollowUp("");
    setMessage(INITIAL_MESSAGE);
    vibrate(120);
    speakWithoutOverlap("Camera assist closed");
  };

  async function testFirebase() {
    await addDoc(collection(db, "test"), {
      message: "Firebase connected",
      createdAt: Date.now(),
    });
  }

  const handleTestFirebase = async () => {
    try {
      await testFirebase();
      setMessage("Firebase test write sent.");
      speakWithoutOverlap("Firebase test write sent");
    } catch {
      setMessage("Firebase test write failed.");
      speakWithoutOverlap("Firebase test write failed");
    }
  };

  return (
    <main className="flex-1 w-full bg-neutral-950 pb-24">
      <section
        aria-labelledby="camera-title"
        className="relative min-h-[calc(100vh-88px)] overflow-hidden"
      >
        <h1 id="camera-title" className="sr-only">
          Camera Assist
        </h1>

        <div
          role="group"
          aria-label="Camera preview area"
          className="relative min-h-[58vh] w-full overflow-hidden bg-slate-950"
        >
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            playsInline
            muted
            aria-label="Live camera preview"
          />

          {!isCameraActive && (
            <div className="flex min-h-[58vh] items-center justify-center px-6 text-center">
              <div className="space-y-3">
                <p className="text-3xl font-semibold text-white">
                  Camera Assist
                </p>
                <p className="text-base text-slate-300">
                  Open your camera, capture a scene, and hear simulated
                  guidance.
                </p>
              </div>
            </div>
          )}

          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
            <span className="rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur">
              {facingMode === "environment" ? "Back camera" : "Front camera"}
            </span>
            <button
              type="button"
              onClick={handleRepeatMessage}
              aria-label="Repeat current camera guidance"
              className="flex min-h-[52px] min-w-[52px] items-center justify-center rounded-full bg-black/70 text-2xl text-white shadow-lg backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            >
              <svg
                aria-hidden="true"
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 5 6 9H3v6h3l5 4V5Z" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                <path d="M18.5 5.5a9 9 0 0 1 0 13" />
              </svg>
            </button>
          </div>
        </div>

        <div className="relative -mt-10 rounded-t-[2rem] border-t border-slate-700 bg-neutral-950 px-4 pb-6 pt-5 shadow-2xl">
          <button
            type="button"
            onClick={handleClosePanel}
            aria-label="Close camera assist"
            className="absolute right-4 top-4 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xl font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
          >
            <span aria-hidden="true">x</span>
          </button>

          <div className="mx-auto w-full max-w-md space-y-5 pt-10 md:max-w-xl lg:max-w-2xl">
            <p
              className="text-center text-2xl font-semibold leading-snug text-white md:text-3xl"
              aria-live="polite"
              aria-atomic="true"
            >
              {message}
            </p>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={handleTakePicture}
                aria-label="Take a picture for assistance"
                disabled={isAnalyzing}
                className="w-full min-h-[84px] rounded-3xl bg-sky-500 text-xl font-semibold text-white shadow-lg transition-colors hover:bg-sky-400 active:bg-sky-500/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAnalyzing ? "Analyzing..." : "Take Picture"}
              </button>

              <button
                type="button"
                onClick={handleSwitchCamera}
                aria-label="Switch between front and back camera"
                className="w-full min-h-[76px] rounded-3xl bg-slate-800 text-lg font-semibold text-white shadow transition-colors hover:bg-slate-700 active:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
              >
                Switch Camera
              </button>

              <button
                type="button"
                onClick={handleAskMore}
                aria-label="Ask for more camera assistance"
                className="w-full min-h-[76px] rounded-3xl border border-slate-600 bg-transparent text-lg font-semibold text-slate-100 transition-colors hover:bg-slate-900 active:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
              >
                Ask More
              </button>
              <button
                type="button"
                onClick={handleTestFirebase}
                aria-label="Test Firebase connection"
                className="w-full min-h-[72px] rounded-3xl border border-emerald-700 bg-emerald-950/40 text-lg font-semibold text-emerald-200 transition-colors hover:bg-emerald-900/50 active:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
              >
                Test Firebase
              </button>
              {followUp && (
                <p className="sr-only">Last follow-up question: {followUp}</p>
              )}
            </div>

            {snapshot && (
              <figure className="space-y-2">
                <div className="relative h-44 w-full overflow-hidden rounded-3xl border border-slate-700">
                  <Image
                    src={snapshot}
                    alt="Last captured frame from the camera stored locally only"
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
                <figcaption className="text-center text-xs text-slate-500">
                  Prototype preview of the last captured frame. Images are not
                  uploaded or stored.
                </figcaption>
              </figure>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
