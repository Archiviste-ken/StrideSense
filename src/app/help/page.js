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
  const callEndedRef = useRef(false);

  const logSnapshotDetails = (requestId, data) => {
    console.log("[SNAPSHOT]", {
      requestId,
      status: data?.status ?? null,
      offerExists: !!data?.offer,
      answerExists: !!data?.answer,
      callerCandidatesCount: Array.isArray(data?.callerCandidates)
        ? data.callerCandidates.length
        : 0,
      calleeCandidatesCount: Array.isArray(data?.calleeCandidates)
        ? data.calleeCandidates.length
        : 0,
    });
  };

  const logIceCandidateDetails = (event) => {
    console.log("[ICE]", event.candidate?.candidate);

    const candidateString = event.candidate?.candidate || "";
    if (candidateString.includes(" typ relay ")) {
      console.log("TURN RELAY CANDIDATE DETECTED");
    }
    if (candidateString.includes(" typ srflx ")) {
      console.log("STUN CANDIDATE DETECTED");
    }
    if (candidateString.includes(" typ host ")) {
      console.log("HOST CANDIDATE DETECTED");
    }
  };

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
        console.log("[SNAPSHOT]", {
          requestId: null,
          status: null,
          offerExists: false,
          answerExists: false,
          callerCandidatesCount: 0,
          calleeCandidatesCount: 0,
        });
        setIncomingRequest(null);
        return;
      }

      const docSnap = snapshot.docs[0];
      const data = docSnap.data();
      logSnapshotDetails(docSnap.id, data);

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
                  console.log("[HELPER 12] Adding caller ICE", c);
                  peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(c));
                  console.log("[HELPER 13] Caller ICE added", c);
                } catch (e) {
                  console.error("[ERROR] addIceCandidate", e);
                  console.error("ICE error", e);
                  throw e;
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
        console.log("Redirect blocked for WebRTC setup");
        return;
      }

      if (helperRedirected.current) {
        return;
      }

      if (data.status === "waiting") {
        console.log("[HELPER 1] Incoming request detected", docSnap.id);
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
    let waitTimeout = null;

    const unsubscribe = onSnapshot(requestRef, async (snap) => {
      if (!snap.exists()) {
        console.log("[SNAPSHOT]", {
          requestId: snap.id,
          status: null,
          offerExists: false,
          answerExists: false,
          callerCandidatesCount: 0,
          calleeCandidatesCount: 0,
        });
        speak("No helper available right now");
        return;
      }

      const data = snap.data();
      logSnapshotDetails(snap.id, data);

      if (data.status === "waiting") {
        if (!waitTimeout) {
          waitTimeout = setTimeout(() => {
            speak("No helper available right now");
            setMessage("No helper available right now");
            if (peerConnectionRef.current) {
              peerConnectionRef.current.close();
              peerConnectionRef.current = null;
            }
            if (localStreamRef.current) {
              localStreamRef.current.getTracks().forEach((t) => t.stop());
              localStreamRef.current = null;
            }
            if (typeof window !== "undefined") {
              window.__CALL_ACTIVE__ = false;
              window.localStorage.removeItem("activeRequestDocId");
            }
            setDocId(null);
            setIsRequesting(false);
          }, 30000);
        }
      } else {
        if (waitTimeout) {
          clearTimeout(waitTimeout);
          waitTimeout = null;
        }
      }

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
                  console.log("[CALLER 15] Adding remote ICE candidate", c);
                  peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(c));
                  console.log("[CALLER 16] Remote ICE candidate added", c);
                } catch (e) {
                  console.error("[ERROR] addIceCandidate", e);
                  console.error("ICE error", e);
                  throw e;
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
        setMessage("Helper connected");
        console.log("Redirect blocked for WebRTC setup");

        if (data.answer && peerConnectionRef.current) {
          console.log("[CALLER 10] Answer received from Firestore", snap.id);
          console.log("[CALLER 11] Setting remote description");
          try {
            await peerConnectionRef.current.setRemoteDescription(
              new RTCSessionDescription(data.answer)
            );
          } catch (error) {
            console.error("[ERROR] setRemoteDescription", error);
            throw error;
          }
          console.log("[CALLER 12] Remote description set");

          console.log("[CALLER 13] Flushing pending ICE candidates");
          pendingCalleeCandidates.current.forEach(c => {
            try {
              console.log("[CALLER 15] Adding remote ICE candidate", c);
              peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(c));
              console.log("[CALLER 16] Remote ICE candidate added", c);
            } catch (e) {
              console.error("[ERROR] addIceCandidate", e);
              console.error("ICE error", e);
              throw e;
            }
          });
          pendingCalleeCandidates.current = [];
          console.log("[CALLER 14] Pending ICE flushed");
        }
      }
    });

    return () => {
      unsubscribe();
      if (waitTimeout) clearTimeout(waitTimeout);
    };
  }, [docId, role, speak, vibrate]);

  const endCall = () => {
    if (callEndedRef.current) return;
    callEndedRef.current = true;

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

      speak("Call ended");
      setMessage("Call ended");
    } catch (err) {
      console.error("End call error:", err);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      speak("Something went wrong. Please try again");
    }
  };

  const switchCamera = async () => {
    if (navigator.vibrate) navigator.vibrate(50);
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
      speak("Something went wrong. Please try again");
    }
  };

  async function startLocalStream() {
    try {
      if (role === "helper") {
        console.log("[HELPER] getUserMedia started");
      } else {
        console.log("[CALLER 1] getUserMedia started");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      if (role === "helper") {
        console.log("[HELPER] getUserMedia success");
      } else {
        console.log("[CALLER 2] getUserMedia success");
      }
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

    if (role === "helper") {
      console.log("[HELPER 2] RTCPeerConnection created");
    } else {
      console.log("[CALLER 3] RTCPeerConnection created");
    }

    console.log("Using ICE servers:", pc.getConfiguration());

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
      if (role === "helper") {
        console.log("[HELPER 3] Tracks added", localStreamRef.current.getTracks().length);
      } else {
        console.log("[CALLER 4] Tracks added", localStreamRef.current.getTracks().length);
      }
    }

    const hasAnnouncedDisconnect = { current: false };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log("Connection state:", state);
      if (role === "helper") {
        console.log("[HELPER 17] Connection state:", state);
      } else {
        console.log("[CALLER 20] Connection state:", state);
      }

      if (state === "connected") {
        setMessage("Connected");
      }
      else if (state === "connecting") setMessage("Connecting...");
      else if (state === "failed" || state === "closed") {
        setMessage("Connection lost");
        if (!hasAnnouncedDisconnect.current) {
          hasAnnouncedDisconnect.current = true;
          speak("Connection lost");
          endCall();
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE state:", pc.iceConnectionState);
      if (role === "helper") {
        console.log("[HELPER 16] ICE state:", pc.iceConnectionState);
      } else {
        console.log("[CALLER 19] ICE state:", pc.iceConnectionState);
      }
    };

    pc.ontrack = (event) => {
      console.log("TRACK RECEIVED");
      if (role === "helper") {
        console.log("[HELPER 14] ontrack fired", {
          kind: event.track?.kind,
          readyState: event.track?.readyState,
          streams: event.streams?.length ?? 0,
          tracks: event.streams?.[0]?.getTracks?.().length ?? 0,
        });
      } else {
        console.log("[CALLER 17] ontrack fired", {
          kind: event.track?.kind,
          readyState: event.track?.readyState,
          streams: event.streams?.length ?? 0,
          tracks: event.streams?.[0]?.getTracks?.().length ?? 0,
        });
      }
      
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

      if (role === "helper") {
        console.log("[HELPER 15] Remote stream attached", {
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
        });
      } else {
        console.log("[CALLER 18] Remote stream attached", {
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
        });
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
      callEndedRef.current = false;
      await startLocalStream();

      speak("Connecting to helper");
      const pc = createPeerConnection();


      console.log("[CALLER 5] Creating offer");
      let offer;
      try {
        offer = await pc.createOffer();
      } catch (error) {
        console.error("[ERROR] createOffer", error);
        throw error;
      }
      console.log("[CALLER 6] Offer created");
      try {
        await pc.setLocalDescription(offer);
      } catch (error) {
        console.error("[ERROR] setLocalDescription", error);
        throw error;
      }
      console.log("[CALLER 7] Local description set");

      if (typeof window !== "undefined") {
        window.__CALL_ACTIVE__ = true;
      }

      speak("Requesting assistance");
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
      console.log("[CALLER 8] Offer stored in Firestore", docRef.id);

      const requestRef = doc(db, "requests", docRef.id);

      pc.onicecandidate = async (event) => {
        logIceCandidateDetails(event);
        if (event.candidate) {
          await updateDoc(requestRef, {
            callerCandidates: arrayUnion(event.candidate.toJSON())
          });
        }
      };

      setDocId(docRef.id);
      console.log("[CALLER 9] Waiting for answer", docRef.id);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("activeRequestDocId", docRef.id);
      }
      speak("Request sent. Waiting for a helper");
      setMessage("Request sent. Waiting for a helper...");
    } catch (error) {
      console.error(error);
      speak("Failed to request help");
      setMessage("Unable to request help. Try again.");
    } finally {
      setIsRequesting(false);
    }
  };

  const handleEmergency = () => {
    if (navigator.vibrate) navigator.vibrate(50);
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
      callEndedRef.current = false;
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
        logIceCandidateDetails(event);
        if (event.candidate && incomingRequest.docId) {
          const requestRef = doc(db, "requests", incomingRequest.docId);
          await updateDoc(requestRef, {
            calleeCandidates: arrayUnion(event.candidate.toJSON())
          });
        }
      };
      console.log("[HELPER 4] Setting remote offer");
      try {
        await pc.setRemoteDescription(
          new RTCSessionDescription(latestData.offer)
        );
      } catch (error) {
        console.error("[ERROR] setRemoteDescription", error);
        throw error;
      }
      console.log("[HELPER 5] Remote offer applied");

      console.log("[HELPER 10] Flushing pending ICE");
      pendingCallerCandidates.current.forEach(c => {
        try {
          console.log("[HELPER 12] Adding caller ICE", c);
          peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(c));
          console.log("[HELPER 13] Caller ICE added", c);
        } catch (e) {
          console.error("[ERROR] addIceCandidate", e);
          console.error("ICE error", e);
          throw e;
        }
      });
      pendingCallerCandidates.current = [];
      console.log("[HELPER 11] Pending ICE flushed");
      console.log("[HELPER 6] Creating answer");
      let answer;
      try {
        answer = await pc.createAnswer();
      } catch (error) {
        console.error("[ERROR] createAnswer", error);
        throw error;
      }
      console.log("[HELPER 7] Answer created");
      try {
        await pc.setLocalDescription(answer);
      } catch (error) {
        console.error("[ERROR] setLocalDescription", error);
        throw error;
      }
      console.log("[HELPER 8] Local description set");

      if (typeof window !== "undefined") {
        window.__CALL_ACTIVE__ = true;
      }

      await updateDoc(requestRef, {
        takenBy: "helper-" + Date.now(),
        status: "connected",
        answer: answer,
      });
      console.log("[HELPER 9] Answer stored", incomingRequest.docId);

      speak("Connecting to user");

      if (helperRedirected.current) return;
      helperRedirected.current = true;
      console.log("Redirect blocked for WebRTC setup");

    

      setMessage("Connecting to user...");
      setIncomingRequest(null);
    } catch (error) {
      console.error(error);
      speak("Unable to accept request");
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
