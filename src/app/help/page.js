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
  const turnTimeoutRef = useRef(null);
  const connectionTimeoutRef = useRef(null);
  const hardTimeoutRef = useRef(null);
  const latestCallerCandidatesRef = useRef([]);
  const latestCalleeCandidatesRef = useRef([]);
  const unsubscribesRef = useRef([]);

  function flushCandidates(pc, pendingArray) {
    if (!pc || !pc.remoteDescription) return;

    pendingArray.forEach(c => {
      try {
        pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {
        console.error("ICE flush error", e);
      }
    });

    pendingArray.length = 0;
  }

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

    const unsubscribe = onSnapshot(collection(db, "requests"), (snapshot) => {
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
              pendingCallerCandidates.current.push(c);
            }
          });
          flushCandidates(peerConnectionRef.current, pendingCallerCandidates.current);
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
        setIncomingRequest({
          docId: docSnap.id,
          ...data,
        });
        return;
      }

      setIncomingRequest(null);
    });
    unsubscribesRef.current.push(unsubscribe);

    return () => unsubscribe();
  }, [role, speak, vibrate]);

  useEffect(() => {
    if (role !== "blind" || !docId) return;

    const requestRef = doc(db, "requests", docId);
    let waitTimeout = null;

    const unsub = onSnapshot(doc(db, "requests", docId), async (docSnap) => {
      if (!docSnap.exists()) {
        speak("No helper available right now");
        return;
      }

      const data = docSnap.data();

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

        if (data.callerCandidates) {
          latestCallerCandidatesRef.current = data.callerCandidates;
        }
        if (data.calleeCandidates) {
          latestCalleeCandidatesRef.current = data.calleeCandidates;
        }

        if (data.status === "connected") {
        if (data.calleeCandidates && peerConnectionRef.current) {
          data.calleeCandidates.forEach(c => {
            const key = c.candidate || JSON.stringify(c);
            if (!addedCalleeCandidates.current.has(key)) {
              addedCalleeCandidates.current.add(key);
              pendingCalleeCandidates.current.push(c);
            }
          });
          flushCandidates(peerConnectionRef.current, pendingCalleeCandidates.current);
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
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );

          console.log("Remote description set (Blind). Flushing candidates");
          flushCandidates(peerConnectionRef.current, pendingCalleeCandidates.current);
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

      if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current);
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      if (hardTimeoutRef.current) clearTimeout(hardTimeoutRef.current);

      unsubscribesRef.current.forEach(unsub => {
        if (typeof unsub === "function") unsub();
      });
      unsubscribesRef.current = [];

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
          urls: "stun:stun.l.google.com:19302"
        },
        {
          urls: "stun:stun.relay.metered.ca:80",
        },
        {
          urls: [
            "turn:global.relay.metered.ca:80",
            "turn:global.relay.metered.ca:80?transport=tcp",
            "turn:global.relay.metered.ca:443",
            "turns:global.relay.metered.ca:443?transport=tcp"
          ],
          username: "b0d25bf34932b58ceb25ce32",
          credential: "ZtAesj+KIlI358Kc",
        },
      ],
      iceTransportPolicy: "all"
  });

  pc.onicecandidateerror = (e) => {
    console.error("ICE error:", e);
  };


    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    const hasAnnouncedDisconnect = { current: false };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log("Connection state:", state);

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
        setTimeout(() => {
          tryPlayAudio();
        }, 300);
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

      const turnDetected = { current: false };
      turnTimeoutRef.current = setTimeout(() => {
        if (!turnDetected.current) {
          console.warn("No TURN relay — connection may fail on cross-network");
        }
      }, 5000);

      connectionTimeoutRef.current = setTimeout(async () => {
        if (pc.connectionState !== "connected" && pc.signalingState === "stable") {
          console.warn("Retrying connection...");
          try {
            const offer = await pc.createOffer({ iceRestart: true });
            await pc.setLocalDescription(offer);
            if (requestRef) {
              await updateDoc(requestRef, {
                offer: pc.localDescription.toJSON()
              });
            }
          } catch (e) {
            console.error("Retry error", e);
            console.error("FINAL FAILURE: TURN/network blocked");
          }
        }
      }, 10000);

      hardTimeoutRef.current = setTimeout(() => {
        if (pc.connectionState !== "connected" && !callEndedRef.current) {
          console.error("FINAL FAILURE: Ending call");
          speak("Unable to connect. Please try again");
          endCall();
        }
      }, 15000);

      let requestRef = null;
      let queuedCandidates = [];
      let localCallerCandidates = [];

      let candidateBuffer = [];
      let updateTimeout = null;

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;

        console.log("ICE:", event.candidate.candidate);
        if (event.candidate.candidate.includes("relay")) {
          turnDetected.current = true;
          console.log("Using TURN relay");
        }

        const cand = event.candidate.toJSON();

        if (!requestRef) {
          queuedCandidates.push(cand);
          return;
        }

        candidateBuffer.push(cand);

        if (!updateTimeout) {
          updateTimeout = setTimeout(async () => {
            try {
              const existing = latestCallerCandidatesRef.current;
              await updateDoc(requestRef, {
                callerCandidates: [...existing, ...candidateBuffer]
              });
              candidateBuffer = [];
              updateTimeout = null;
            } catch (e) {
              console.error("Batch update error", e);
              updateTimeout = null;
            }
          }, 250);
        }
      };

      pc.oniceconnectionstatechange = async () => {
        console.log("ICE state (Caller):", pc.iceConnectionState);

        if (pc.iceConnectionState === "failed" && pc.signalingState === "stable") {
          console.warn("Restarting ICE...");
          try {
            const offer = await pc.createOffer({ iceRestart: true });
            await pc.setLocalDescription(offer);
            if (requestRef) {
              await updateDoc(requestRef, {
                offer: pc.localDescription.toJSON()
              });
            }
          } catch (e) {
            console.error("ICE restart error", e);
          }
        }

        if (pc.iceConnectionState === "disconnected") {
          console.warn("Temporary disconnect detected");
          setTimeout(async () => {
            if (pc.iceConnectionState !== "connected" && pc.signalingState === "stable" && !callEndedRef.current) {
              console.warn("Attempting ICE recovery...");
              try {
                const offer = await pc.createOffer({ iceRestart: true });
                await pc.setLocalDescription(offer);
                if (requestRef) {
                  await updateDoc(requestRef, {
                    offer: pc.localDescription.toJSON()
                  });
                }
              } catch (e) {
                console.error("Recovery failed", e);
              }
            }
          }, 3000);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

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
        offer: pc.localDescription.toJSON(),
        answer: null,
      });

      requestRef = doc(db, "requests", docRef.id);

      const unsubscribeLocal = onSnapshot(requestRef, (snap) => {
       const data = snap.data();
        if (data?.callerCandidates) latestCallerCandidatesRef.current = data.callerCandidates;
        if (data?.calleeCandidates) latestCalleeCandidatesRef.current = data.calleeCandidates;
      });
      unsubscribesRef.current.push(unsubscribeLocal);

      try {
        const existing = latestCallerCandidatesRef.current;
        await updateDoc(requestRef, {
          callerCandidates: [...existing, ...queuedCandidates]
        });
        queuedCandidates = [];
      } catch (e) {
        console.error("Queue flush error", e);
      }

      setDocId(docRef.id);
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

      let requestRef = doc(db, "requests", incomingRequest.docId);
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

      const turnDetected = { current: false };
      turnTimeoutRef.current = setTimeout(() => {
        if (!turnDetected.current) {
          console.warn("No TURN relay — connection may fail on cross-network");
        }
      }, 5000);

      connectionTimeoutRef.current = setTimeout(async () => {
        if (pc.connectionState !== "connected" && pc.signalingState === "stable") {
          console.warn("Retrying connection...");
          try {
            const offer = await pc.createOffer({ iceRestart: true });
            await pc.setLocalDescription(offer);
            if (requestRef) {
              await updateDoc(requestRef, {
                offer: pc.localDescription.toJSON()
              });
            }
          } catch (e) {
            console.error("Retry error", e);
            console.error("FINAL FAILURE: TURN/network blocked");
          }
        }
      }, 10000);

      hardTimeoutRef.current = setTimeout(() => {
        if (pc.connectionState !== "connected" && !callEndedRef.current) {
          console.error("FINAL FAILURE: Ending call");
          speak("Unable to connect. Please try again");
          endCall();
        }
      }, 15000);

      let helpRequestRef = requestRef; 
      let queuedHelperCandidates = [];
      let localCalleeCandidates = [];

      let candidateBuffer = [];
      let updateTimeout = null;

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;

        console.log("ICE:", event.candidate.candidate);
        if (event.candidate.candidate.includes("relay")) {
          turnDetected.current = true;
          console.log("Using TURN relay");
        }

        const cand = event.candidate.toJSON();

        if (!helpRequestRef) {
          queuedHelperCandidates.push(cand);
          return;
        }

        candidateBuffer.push(cand);

        if (!updateTimeout) {
          updateTimeout = setTimeout(async () => {
            try {
              const existing = latestCalleeCandidatesRef.current;
              await updateDoc(helpRequestRef, {
                calleeCandidates: [...existing, ...candidateBuffer]
              });
              candidateBuffer = [];
              updateTimeout = null;
            } catch (e) {
              console.error("Batch update error", e);
              updateTimeout = null;
            }
          }, 250);
        }
      };
      await pc.setRemoteDescription(
        new RTCSessionDescription(latestData.offer)
      );

      console.log("Remote description set (Helper). Flushing candidates");
      flushCandidates(pc, pendingCallerCandidates.current);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (typeof window !== "undefined") {
        window.__CALL_ACTIVE__ = true;
      }


      const unsubscribeHelperDoc = onSnapshot(requestRef, async (snap) => {
       const data = snap.data();
        if (!data) return;
        
        if (data.callerCandidates) latestCallerCandidatesRef.current = data.callerCandidates;
        if (data.calleeCandidates) latestCalleeCandidatesRef.current = data.calleeCandidates;

        // ICE Restart (re-negotiation)
        if (data.offer && pc.remoteDescription && data.offer.sdp !== pc.remoteDescription.sdp) {
          console.log("New offer received (ICE Restart)");
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await updateDoc(requestRef, {
              answer: pc.localDescription.toJSON()
            });
          } catch (e) {
            console.error("Callee re-negotiation error", e);
          }
        }
      });
      unsubscribesRef.current.push(unsubscribeHelperDoc);

      try {
        const existing = latestCalleeCandidatesRef.current;
        await updateDoc(requestRef, {
          calleeCandidates: [...existing, ...queuedHelperCandidates]
        });
        queuedHelperCandidates = [];
      } catch (e) {
        console.error("Queue flush error", e);
      }

      await updateDoc(requestRef, {
        takenBy: "helper-" + Date.now(),
        status: "connected",
        answer: answer,
      });

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
