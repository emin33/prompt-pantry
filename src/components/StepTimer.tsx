import { useState, useEffect, useRef, useCallback } from "react";

interface Props {
  minutes: number;
  label?: string;
}

type TimerState = "idle" | "running" | "done";

export default function StepTimer({ minutes, label }: Props) {
  const totalSeconds = minutes * 60;
  const [remaining, setRemaining] = useState(totalSeconds);
  const [state, setState] = useState<TimerState>("idle");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return clear;
  }, [clear]);

  const start = () => {
    if (state === "done") {
      setRemaining(totalSeconds);
    }
    setState("running");
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clear();
          setState("done");
          // Try to alert
          try {
            if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
            const audio = new Audio(
              "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ=="
            );
            audio.play().catch(() => {});
          } catch {}
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const reset = () => {
    clear();
    setState("idle");
    setRemaining(totalSeconds);
  };

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress = 1 - remaining / totalSeconds;

  if (state === "idle") {
    return (
      <button
        onClick={start}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-golden-light text-golden border border-golden/30 hover:bg-golden/20 transition-colors text-sm font-medium"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12,6 12,12 16,14" />
        </svg>
        {label ? `${label} — ${minutes} min` : `${minutes} min`}
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-golden-light border border-golden/30">
      {/* Progress ring */}
      <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
        <circle
          cx="18" cy="18" r="15"
          fill="none"
          stroke="currentColor"
          className="text-golden/20"
          strokeWidth="3"
        />
        <circle
          cx="18" cy="18" r="15"
          fill="none"
          stroke="currentColor"
          className={state === "done" ? "text-sage" : "text-golden"}
          strokeWidth="3"
          strokeDasharray={`${progress * 94.25} 94.25`}
          strokeLinecap="round"
        />
      </svg>
      <div className="flex flex-col">
        <span className="text-lg font-medium tabular-nums text-charcoal">
          {state === "done" ? "Done!" : `${mins}:${secs.toString().padStart(2, "0")}`}
        </span>
        {label && <span className="text-xs text-warm-gray">{label}</span>}
      </div>
      <button
        onClick={reset}
        className="ml-2 text-xs text-warm-gray hover:text-terracotta transition-colors"
        aria-label="Reset timer"
      >
        Reset
      </button>
    </div>
  );
}
