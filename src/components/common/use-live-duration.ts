"use client";

import { useEffect, useState } from "react";

/**
 * Ticks once a second while `active`, so a running duration advances without a
 * server round trip. When inactive it returns the frozen `baseMs`, which keeps
 * completed totals stable.
 */
export function useLiveDuration(startedAtIso: string | null, baseMs: number, active: boolean) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  if (!active || !startedAtIso) {
    return baseMs;
  }

  const started = Date.parse(startedAtIso);
  if (Number.isNaN(started)) {
    return baseMs;
  }

  return baseMs + Math.max(0, now - started);
}
