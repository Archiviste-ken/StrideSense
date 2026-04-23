"use client";

import { useUserRole } from "@/hooks/useUserRole";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { useAssistiveFeedback } from "../../hooks/useAssistiveFeedback";

export default function HelpPage() {
  const { speak, vibrate, notifyComingSoon } = useAssistiveFeedback();
  const { role } = useUserRole();
  const [message, setMessage] = useState(
    "Live assistance feature coming soon.",
  );
  const [isRequesting, setIsRequesting] = useState(false);
  const [docId, setDocId] = useState(null);
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const helperRedirected = useRef(false);
  const blindRedirected = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || role !== "blind") return;

    const saved = window.localStorage.getItem("activeRequestDocId");
    if (
      saved &&
      saved !== "null" &&
      typeof saved === "string" &&
      saved.length > 0
    ) {
      setDocId(saved);
    }
  }, [role]);

  useEffect(() => {
    if (role !== "helper") {
      setIncomingRequest(null);
      return;
    }

    const q = query(
      collection(db, "requests"),
      where("status", "==", "waiting"),
      orderBy("createdAt", "desc"),
      limit(1),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setIncomingRequest(null);
        return;
      }

      const docSnap = snapshot.docs[0];
      const data = docSnap.data();

      if (!data.createdAt || typeof data.createdAt !== "number") return;

      if (data.status === "connected") {
        if (helperRedirected.current) return;
        if (!data.id || typeof data.id !== "string") return;

        helperRedirected.current = true;
        speak("Connecting to user");
        vibrate([100, 50, 100]);
        window.location.href = `https://meet.jit.si/${data.id}`;
        return;
      }

      if (helperRedirected.current) {
        return;
      }

      if (data.status === "waiting") {
        setIncomingRequest({
          docId: docSnap.id,
          roomId: data.id,
          ...data,
        });
        return;
      }

      setIncomingRequest(null);
    });

    return () => unsubscribe();
  }, [role, speak, vibrate]);

  useEffect(() => {
    if (role !== "blind" || !docId) return;

    const requestRef = doc(db, "requests", docId);

    const unsubscribe = onSnapshot(requestRef, (snap) => {
      if (!snap.exists()) return;

      const data = snap.data();

      if (data.status === "connected") {
        if (blindRedirected.current) return;
        if (!data.id || typeof data.id !== "string") return;

        blindRedirected.current = true;
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("activeRequestDocId");
        }
        speak("Helper connected");
        vibrate([100, 50, 100]);
        setMessage("Helper connected");
        window.location.href = `https://meet.jit.si/${data.id}`;
      }
    });

    return () => unsubscribe();
  }, [docId, role, speak, vibrate]);

  const handleHelper = async () => {
    if (role !== "blind") {
      speak("Switch to assistance mode to request help");
      return;
    }

    if (docId) {
      speak("You already have an active request");
      return;
    }

    if (isRequesting) return;

    try {
      setIsRequesting(true);

      speak("Requesting assistance");
      vibrate(200);
      setMessage("Waiting for a helper...");

      const roomId = "room-" + Date.now();
      const docRef = await addDoc(collection(db, "requests"), {
        id: roomId,
        status: "waiting",
        takenBy: null,
        createdAt: Date.now(),
      });

      setDocId(docRef.id);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("activeRequestDocId", docRef.id);
      }
      speak("Request sent. Waiting for a helper");
      vibrate(120);
      setMessage("Request sent. Waiting for a helper...");
    } catch (error) {
      console.error(error);
      speak("Failed to request help");
      vibrate(150);
      setMessage("Unable to request help. Try again.");
    } finally {
      setIsRequesting(false);
    }
  };

  const handleEmergency = () => {
    setMessage("Emergency contact feature coming soon.");
    notifyComingSoon("Emergency contact feature coming soon");
  };

  const handleAcceptRequest = async () => {
    if (!incomingRequest || isAccepting) return;

    if (
      incomingRequest.status !== "waiting" ||
      incomingRequest.takenBy !== null
    ) {
      speak("Request already taken");
      return;
    }

    try {
      setIsAccepting(true);

      const requestRef = doc(db, "requests", incomingRequest.docId);
      const latestSnap = await getDoc(requestRef);

      if (!latestSnap.exists()) {
        speak("Request not found");
        return;
      }

      const latestData = latestSnap.data();

      if (latestData.takenBy !== null) {
        speak("Request already taken");
        return;
      }

      await updateDoc(requestRef, {
        takenBy: "helper-" + Date.now(),
        status: "connected",
      });

      const acceptedDocId = incomingRequest.docId;
      const connectedRef = doc(db, "requests", acceptedDocId);

      onSnapshot(connectedRef, (snap) => {
        if (!snap.exists()) return;

        const data = snap.data();

        if (data.status === "connected") {
          if (helperRedirected.current) return;

          if (!data.id || typeof data.id !== "string") return;

          helperRedirected.current = true;

          speak("Connecting to user");
          vibrate([100, 50, 100]);

           
          const url = `https://meet.jit.si/${data.id}#config.prejoinPageEnabled=false&config.disableDeepLinking=true&config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.requireDisplayName=false&userInfo.displayName=Helper`;

          window.location.href = url;
        }
      });

      setMessage("Connecting to user...");
      setIncomingRequest(null);
    } catch (error) {
      console.error(error);
      speak("Unable to accept request");
      vibrate(150);
      setMessage("Unable to accept request. Try again.");
    } finally {
      setIsAccepting(false);
    }
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
            Quickly reach helpers or emergency contacts.
          </p>
        </header>

        <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-5 space-y-4 shadow-lg">
          <button
            type="button"
            onClick={handleHelper}
            aria-label="Call a helper for assistance"
            disabled={isRequesting}
            className="w-full min-h-[88px] rounded-3xl bg-sky-500 text-xl md:text-2xl font-semibold text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 hover:bg-sky-400 active:bg-sky-500/80 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            Call a Helper
          </button>

          <button
            type="button"
            onClick={handleEmergency}
            aria-label="Open emergency contact options"
            className="w-full min-h-[76px] rounded-3xl bg-slate-800 text-lg md:text-xl font-semibold text-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 hover:bg-slate-700 active:bg-slate-800/80 transition-colors"
          >
            Emergency Contact
          </button>

          {role === "helper" && incomingRequest && (
            <div className="rounded-3xl border border-sky-700 bg-sky-950/40 p-4 space-y-3">
              <p className="text-sm md:text-base font-semibold text-sky-100">
                Incoming request
              </p>
              <button
                type="button"
                onClick={handleAcceptRequest}
                aria-label="Accept incoming help request"
                disabled={isAccepting}
                className="w-full min-h-[76px] rounded-3xl bg-sky-500 text-lg md:text-xl font-semibold text-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 hover:bg-sky-400 active:bg-sky-500/80 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                Accept Request
              </button>
            </div>
          )}

          <p
            className="text-xs md:text-sm text-slate-400"
            aria-live="polite"
            data-request-id={docId ?? undefined}
          >
            {message}
          </p>
        </div>
      </section>
    </main>
  );
}
