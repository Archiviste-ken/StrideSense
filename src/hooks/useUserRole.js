"use client";

import { useEffect, useState } from "react";

const ROLE_STORAGE_KEY = "stride-sense-user-role";

export function useUserRole() {
  const [role, setRole] = useState(() => {
    if (typeof window === "undefined") return "blind";

    const storedRole = window.localStorage.getItem(ROLE_STORAGE_KEY);
    if (storedRole === "blind" || storedRole === "helper") {
      return storedRole;
    }

    return "blind";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (role !== "blind" && role !== "helper") return;

    window.localStorage.setItem(ROLE_STORAGE_KEY, role);
  }, [role]);

  return { role, setRole };
}
