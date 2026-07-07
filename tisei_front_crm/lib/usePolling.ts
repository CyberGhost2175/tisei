import { useEffect, useRef } from "react";

/** Вызывает callback каждые intervalMs миллисекунд. */
export function usePolling(callback: () => void, intervalMs: number, enabled = true) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => cbRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
