import { useEffect, useState } from "react";

/**
 * A clock that ticks, for anything counting down.
 *
 * Reading `new Date()` during render is not pure and the React Compiler rules
 * flag it, so the time lives in state and an interval moves it. Everything that
 * depends on "how long until this session" derives from the returned value
 * rather than reading the clock itself.
 *
 * Thirty seconds by default. A countdown shown in minutes does not need a
 * per-second tick, and a page listing twenty sessions should not re-render
 * twenty rows every second to move nothing.
 */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);

  return now;
}
