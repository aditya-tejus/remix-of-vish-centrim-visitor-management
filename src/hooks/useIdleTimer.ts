import { useEffect, useRef, useCallback, useState } from "react";

export function useIdleTimer(onIdle: () => void, timeoutMs = 90000) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onIdle, timeoutMs);
  }, [onIdle, timeoutMs]);

  useEffect(() => {
    const events = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [resetTimer]);
}

/**
 * Two-phase idle timer: fires onWarning at warningMs, then onIdle at timeoutMs.
 * Returns { showWarning, dismissWarning } for use with KioskIdleWarning.
 */
export function useIdleTimerWithWarning(
  onIdle: () => void,
  warningMs = 60000,
  timeoutMs = 90000,
) {
  const [showWarning, setShowWarning] = useState(false);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAll = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
  }, []);

  const resetTimer = useCallback(() => {
    clearAll();
    setShowWarning(false);
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      // Give remaining time after warning
      idleTimerRef.current = setTimeout(() => {
        setShowWarning(false);
        onIdle();
      }, timeoutMs - warningMs);
    }, warningMs);
  }, [onIdle, warningMs, timeoutMs, clearAll]);

  const dismissWarning = useCallback(() => {
    setShowWarning(false);
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    const events = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      clearAll();
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [resetTimer, clearAll]);

  return { showWarning, dismissWarning };
}
