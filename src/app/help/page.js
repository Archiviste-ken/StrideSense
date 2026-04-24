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
  arrayUnion,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { useAssistiveFeedback } from "../../hooks/useAssistiveFeedback";
import { useVoiceEngine } from "../../hooks/useVoiceEngine";




export default function HelpPage() {
  const { speak, vibrate, notifyComingSoon } = useAssistiveFeedback();
  const voiceEngine = useVoiceEngine();
  const { role } = useUserRole();
  const [message, setMessage] = useState(
    "Live assistance feature coming soon.",
  );
  const [isRequesting, setIsRequesting] = useState(false);
  const [docId, setDocId] = useState(null);
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [facingMode, setFacingMode] = useState("user");
  const helperRedirected = useRef(false);
  const blindRedirected = useRef(false);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const audioReadyRef = useRef(false);
  const userInteractedRef = useRef(false);
  const addedCallerCandidates = useRef(new Set());
  const addedCalleeCandidates = useRef(new Set());
  const pendingCallerCandidates = useRef([]);
  const pendingCalleeCandidates = useRef([]);

 useEffect(() => {
  if (typeof window === "undefined") return;

  return () => {
    // cleanup on unmount
    window.__CALL_ACTIVE__ = false;
  };
}, []);

  const tryPlayAudio = () => {
    if (
      remoteAudioRef.current &&
      audioReadyRef.current &&
      userInteractedRef.current
    ) {
      remoteAudioRef.current.play().catch(() => {});
    }
  };

  useEffect(() => {
    const handler = () => {
      userInteractedRef.current = true;
      tryPlayAudio();
    };

    document.body.addEventListener("click", handler);

    return () => {
      document.body.removeEventListener("click", handler);
    };
  }, []);


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
        if (data.callerCandidates && peerConnectionRef.current) {
          data.callerCandidates.forEach(c => {
            const key = c.candidate || JSON.stringify(c);
            if (!addedCallerCandidates.current.has(key)) {
              addedCallerCandidates.current.add(key);
              if (
                peerConnectionRef.current &&
                peerConnectionRef.current.remoteDescription
              ) {
                try {
                  peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(c));
                } catch (e) {
                  console.error("ICE error", e);
                }
              } else {
                pendingCallerCandidates.current.push(c);
              }
            }
          });
        }

        if (helperRedirected.current) return;

        helperRedirected.current = true;
        speak("Connecting to user");
        vibrate([100, 50, 100]);
        console.log("Redirect blocked for WebRTC setup");
        return;
      }

      if (helperRedirected.current) {
        return;
      }

      if (data.status === "waiting") {
        setIncomingRequest({
          docId: docSnap.id,
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

    const unsubscribe = onSnapshot(requestRef, async (snap) => {
      if (!snap.exists()) return;

      const data = snap.data();

      if (data.status === "connected") {
        if (data.calleeCandidates && peerConnectionRef.current) {
          data.calleeCandidates.forEach(c => {
            const key = c.candidate || JSON.stringify(c);
            if (!addedCalleeCandidates.current.has(key)) {
              addedCalleeCandidates.current.add(key);
              if (
                peerConnectionRef.current &&
                peerConnectionRef.current.remoteDescription
              ) {
                try {
                  peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(c));
                } catch (e) {
                  console.error("ICE error", e);
                }
              } else {
                pendingCalleeCandidates.current.push(c);
              }
            }
          });
        }

        if (blindRedirected.current) return;

        blindRedirected.current = true;
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("activeRequestDocId");
        }
        speak("Helper connected");
        vibrate([100, 50, 100]);
        setMessage("Helper connected");
        console.log("Redirect blocked for WebRTC setup");

        if (data.answer && peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );

          pendingCalleeCandidates.current.forEach(c => {
            try {
              peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(c));
            } catch (e) {
              console.error("ICE error", e);
            }
          });
          pendingCalleeCandidates.current = [];
        }
      }
    });

    return () => unsubscribe();
  }, [docId, role, speak, vibrate]);

  const endCall = () => {
    try {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }

      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }

      if (typeof window !== "undefined") {
        window.__CALL_ACTIVE__ = false;
      }
      helperRedirected.current = false;
      blindRedirected.current = false;
      setDocId(null);
      setIncomingRequest(null);
      setIsRequesting(false);
      setIsAccepting(false);
      audioReadyRef.current = false;
      userInteractedRef.current = false;

      setMessage("Call ended");
    } catch (err) {
      console.error("End call error:", err);
    }
  };

  const switchCamera = async () => {
    try {
      const newFacing = facingMode === "user" ? "environment" : "user";
      setFacingMode(newFacing);

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing }
      });

      const newVideoTrack = newStream.getVideoTracks()[0];

      if (peerConnectionRef.current) {
        const sender = peerConnectionRef.current
          .getSenders()
          .find((s) => s.track && s.track.kind === "video");

        if (sender && newVideoTrack) {
          await sender.replaceTrack(newVideoTrack);
        }
      }

      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
      }

      localStreamRef.current = newStream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error("Switch camera error:", err);
    }
  };

  async function startLocalStream() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera/Mic error:", err);
    }
  }

  function createPeerConnection() {
    const pc = new RTCPeerConnection({
      iceServers: [
      {
        urls: "stun:stun.relay.metered.ca:80",
      },
      {
        urls: "turn:global.relay.metered.ca:80",
        username: "b0d25bf34932b58ceb25ce32",
        credential: "ZtAesj+KIlI358Kc",
      },
      {
        urls: "turn:global.relay.metered.ca:80?transport=tcp",
        username: "b0d25bf34932b58ceb25ce32",
        credential: "ZtAesj+KIlI358Kc",
      },
      {
        urls: "turn:global.relay.metered.ca:443",
        username: "b0d25bf34932b58ceb25ce32",
        credential: "ZtAesj+KIlI358Kc",
      },
      {
        urls: "turns:global.relay.metered.ca:443?transport=tcp",
        username: "b0d25bf34932b58ceb25ce32",
        credential: "ZtAesj+KIlI358Kc",
      },
  ],
      iceTransportPolicy: "all" // allow both direct + relay
    });

    console.log("Using ICE servers:", pc.getConfiguration());

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log("Connection state:", state);

      if (state === "connected") setMessage("Connected");
      else if (state === "connecting") setMessage("Connecting...");
      else if (state === "failed" || state === "closed") {
        setMessage("Connection lost");
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE state:", pc.iceConnectionState);
    };

    pc.ontrack = (event) => {
      console.log("TRACK RECEIVED");
      
      let stream = event.streams && event.streams[0];

      if (!stream && event.track) {
        // Fallback for browsers that don't provide streams
        stream = new MediaStream([event.track]);
      }
      console.log("Tracks:", stream.getTracks());

      const hasVideo = stream.getVideoTracks && stream.getVideoTracks().length > 0;

      const videoTrack = stream.getVideoTracks()[0];

      if (!videoTrack) {
        console.error("❌ NO VIDEO TRACK");
      } else {
        console.log("✅ VIDEO TRACK READY:", videoTrack.readyState);
        if (videoTrack.readyState === "ended") {
          console.warn("⚠️ Video track ended — stream may need restart");
        }
        videoTrack.enabled = true;
      }

      // VIDEO
      if (remoteVideoRef.current && hasVideo) {
        const video = remoteVideoRef.current;
        if (!video) return;

        console.log("Attaching stream with video tracks:", stream.getVideoTracks().length);
        
        if (video.srcObject !== stream) {
          console.log("Updating video stream");
          video.srcObject = stream;
        }

        video.muted = true;
        video.playsInline = true;

        if (videoTrack) {
          if (videoTrack.readyState === "live") {
            video.play().catch(() => {});
          } else {
            // Wait until track becomes live
            if (!videoTrack._unmuteBound) {
              videoTrack._unmuteBound = true;
              videoTrack.addEventListener("unmute", () => {
                video.play().catch(() => {});
              }, { once: true });
            }
          }
        }
      }

      // AUDIO (SEPARATE)
      if (remoteAudioRef.current) {
        const audio = remoteAudioRef.current;
        audio.srcObject = stream;
        audio.muted = false;
        audio.volume = 1;
        audioReadyRef.current = true;

        console.log("Audio tracks:", stream.getAudioTracks());
        tryPlayAudio();
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

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
      await startLocalStream();

      const pc = createPeerConnection();


      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (typeof window !== "undefined") {
        window.__CALL_ACTIVE__ = true;
      }

      speak("Requesting assistance");
      vibrate(200);
      setMessage("Waiting for a helper...");

      const roomId = Math.random().toString(36).substring(2, 10);
      const docRef = await addDoc(collection(db, "requests"), {
        id: roomId,
        status: "waiting",
        takenBy: null,
        createdAt: Date.now(),
        offer: offer,
        answer: null,
      });

      const requestRef = doc(db, "requests", docRef.id);

      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          await updateDoc(requestRef, {
            callerCandidates: arrayUnion(event.candidate.toJSON())
          });
        }
      };

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
      await startLocalStream();

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

      const pc = createPeerConnection();

      pc.onicecandidate = async (event) => {
        if (event.candidate && incomingRequest.docId) {
          const requestRef = doc(db, "requests", incomingRequest.docId);
          await updateDoc(requestRef, {
            calleeCandidates: arrayUnion(event.candidate.toJSON())
          });
        }
      };
      await pc.setRemoteDescription(
        new RTCSessionDescription(latestData.offer)
      );

      pendingCallerCandidates.current.forEach(c => {
        try {
          peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(c));
        } catch (e) {
          console.error("ICE error", e);
        }
      });
      pendingCallerCandidates.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (typeof window !== "undefined") {
        window.__CALL_ACTIVE__ = true;
      }

      await updateDoc(requestRef, {
        takenBy: "helper-" + Date.now(),
        status: "connected",
        answer: answer,
      });

      speak("Connecting to user");
      vibrate([100, 50, 100]);


      if (helperRedirected.current) return;
      helperRedirected.current = true;
      console.log("Redirect blocked for WebRTC setup");

    

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
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
              voiceEngine.speak("Calling helper", "high");
              handleHelper();
            }}
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
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
                  voiceEngine.speak("Accepting request", "high");
                  handleAcceptRequest();
                }}
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
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        className="hidden"
      />
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-[60vh] rounded-xl bg-black object-cover"
      />
      <button
        onClick={() => {
          if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
          voiceEngine.speak("Ending call", "high");
          endCall();
        }}
        className="mt-3 w-full py-3 bg-red-500 text-white rounded-xl font-semibold"
      >
        End Call
      </button>
      <button
        onClick={switchCamera}
        className="mt-3 w-full py-3 bg-sky-500 text-white rounded-xl font-semibold"
      >
        Switch Camera
      </button>
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
      />
    </main>
  );
}
