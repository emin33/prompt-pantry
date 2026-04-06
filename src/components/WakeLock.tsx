import { useState, useEffect } from "react";

export default function WakeLock() {
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(false);
  const [lock, setLock] = useState<WakeLockSentinel | null>(null);

  useEffect(() => {
    setSupported("wakeLock" in navigator);
  }, []);

  useEffect(() => {
    if (!active) {
      lock?.release();
      setLock(null);
      return;
    }

    let sentinel: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request("screen");
        setLock(sentinel);
        // Re-acquire if page becomes visible again (e.g., tab switch)
        sentinel.addEventListener("release", () => {
          setLock(null);
          if (active) {
            acquire();
          }
        });
      } catch {}
    };
    acquire();

    return () => {
      sentinel?.release();
    };
  }, [active]);

  if (!supported) return null;

  return (
    <button
      onClick={() => setActive(!active)}
      className={`no-print inline-flex items-center gap-1.5 text-sm transition-colors ${
        active
          ? "text-terracotta font-medium"
          : "text-warm-gray hover:text-charcoal"
      }`}
      title={active ? "Screen will stay on — click to disable" : "Keep screen on while cooking"}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {active ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        )}
      </svg>
      {active ? "Screen On" : "Keep Awake"}
    </button>
  );
}
