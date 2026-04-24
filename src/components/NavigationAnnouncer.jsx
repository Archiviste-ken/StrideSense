"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useVoiceEngine } from "../hooks/useVoiceEngine";

export default function NavigationAnnouncer() {
  const pathname = usePathname();
  const voiceEngine = useVoiceEngine();
  const lastPathRef = useRef("");

  useEffect(() => {
    if (!pathname) return;
    if (lastPathRef.current === pathname) return;

    lastPathRef.current = pathname;

    let label = "";

    if (pathname === "/") label = "Home";
    else if (pathname === "/camera") label = "Camera";
    else if (pathname === "/help") label = "Get Help";
    else if (pathname === "/profile") label = "Profile";

    if (!label) return;

    // Run AFTER render settles (not blocking navigation)
    requestAnimationFrame(() => {
      voiceEngine.speak(`Opening ${label} tab`, "high");
    });
  }, [pathname, voiceEngine]);

  return null;
}
