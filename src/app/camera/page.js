"use client";

import { useEffect, useRef, useState } from "react";
import { useAssistiveFeedback } from "../../hooks/useAssistiveFeedback";

export default function CameraPage() {
  const { speak, vibrate, notifyComingSoon } = useAssistiveFeedback();
  const [message, setMessage] = useState("Camera features coming soon.");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMessage("Camera access is not supported on this device.");
      notifyComingSoon("Camera access is not supported on this device");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }

      setIsCameraActive(true);
      setMessage("Camera preview active. This is a prototype preview only.");
    } catch {
      setMessage("Unable to access camera. Please check permissions.");
      notifyComingSoon("Unable to access camera. Please check permissions.");
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleOpenCamera = async () => {
    vibrate(150);
    speak("Opening camera preview.");
    await startCamera();
  };

  const handleTakePicture = async () => {
    vibrate(150);
    speak("Capturing picture. This is a prototype only.");

    if (!isCameraActive) {
      await startCamera();
    }

    const video = videoRef.current;
    if (!video) {
      setMessage("Camera preview is not available.");
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg");
        setSnapshot(dataUrl);
        setMessage("Picture captured locally. History feature coming soon.");
      }
    } catch {
      setMessage("Could not capture picture. This is a prototype feature.");
    }
  };

  const handleViewHistory = () => {
    setMessage("Camera history feature coming soon.");
    notifyComingSoon("Camera history feature coming soon");
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
          className="h-64 rounded-3xl border border-slate-700 bg-slate-900/70 flex items-center justify-center overflow-hidden px-3 text-center"
        >
          {isCameraActive ? (
            <video
              ref={videoRef}
              className="h-full w-full object-cover rounded-3xl"
              playsInline
              muted
              aria-label="Live camera preview"
            />
          ) : (
            <p className="text-sm md:text-base text-slate-200">
              Camera Assist
              <span className="block text-slate-400">
                Tap Open Camera to start a live preview.
              </span>
            </p>
          )}
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleOpenCamera}
            aria-label="Open camera for assistance"
            className="w-full min-h-[80px] rounded-3xl bg-slate-800 text-lg md:text-xl font-semibold text-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 hover:bg-slate-700 active:bg-slate-800/80 transition-colors"
          >
            Open Camera
          </button>

          <button
            type="button"
            onClick={handleTakePicture}
            aria-label="Take a picture for assistance"
            className="w-full min-h-[80px] rounded-3xl bg-slate-800 text-lg md:text-xl font-semibold text-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 hover:bg-slate-700 active:bg-slate-800/80 transition-colors"
          >
            Take Picture
          </button>

          <button
            type="button"
            onClick={handleViewHistory}
            aria-label="View camera history"
            className="w-full min-h-[80px] rounded-3xl bg-slate-800 text-lg md:text-xl font-semibold text-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 hover:bg-slate-700 active:bg-slate-800/80 transition-colors"
          >
            View History
          </button>
        </div>

        <p className="text-xs md:text-sm text-slate-400" aria-live="polite">
          {message}
        </p>

        {snapshot && (
          <figure className="mt-2 space-y-1">
            <img
              src={snapshot}
              alt="Last captured frame from the camera (stored locally only)"
              className="w-full max-h-48 object-cover rounded-2xl border border-slate-700"
            />
            <figcaption className="text-xs text-slate-500">
              Prototype preview of the last captured frame. Images are not
              uploaded or stored.
            </figcaption>
          </figure>
        )}
      </section>
    </main>
  );
}
