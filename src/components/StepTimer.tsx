import { useState, useEffect, useRef, useCallback } from "react";

interface Props {
  minutes: number;
  label?: string;
}

type TimerState = "idle" | "running" | "done";

function getStorageKey(minutes: number, label?: string): string {
  return `timer_${label || ""}_${minutes}`;
}

function playAlarm() {
  try {
    if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
    const ctx = new AudioContext();
    const playBeep = (time: number, freq: number, dur = 0.15) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "square";
      gain.gain.setValueAtTime(0.6, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.start(time);
      osc.stop(time + dur);
    };
    const now = ctx.currentTime;
    for (let r = 0; r < 5; r++) {
      const t = now + r * 0.7;
      playBeep(t, 1000 + r * 120);
      playBeep(t + 0.18, 1000 + r * 120);
      playBeep(t + 0.36, 1000 + r * 120);
    }
    return ctx;
  } catch {
    return null;
  }
}

function sendNotification(label?: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Timer Done!", {
        body: label ? `${label} is ready` : "Your timer has finished",
        icon: "/favicon.png",
      });
    }
  } catch {}
}

export default function StepTimer({ minutes, label }: Props) {
  const totalSeconds = minutes * 60;
  const storageKey = getStorageKey(minutes, label);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Initialize from localStorage
  const [state, setState] = useState<TimerState>(() => {
    if (typeof window === "undefined") return "idle";
    const saved = localStorage.getItem(storageKey);
    if (!saved) return "idle";
    const endTime = parseInt(saved, 10);
    if (isNaN(endTime)) return "idle";
    return Date.now() >= endTime ? "done" : "running";
  });

  const [remaining, setRemaining] = useState(() => {
    if (typeof window === "undefined") return totalSeconds;
    const saved = localStorage.getItem(storageKey);
    if (!saved) return totalSeconds;
    const endTime = parseInt(saved, 10);
    if (isNaN(endTime)) return totalSeconds;
    const left = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    return left;
  });

  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return clear;
  }, [clear]);

  // If we loaded as "done" from localStorage, fire alarm on mount
  useEffect(() => {
    if (state === "done" && remaining === 0) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        localStorage.removeItem(storageKey);
        audioCtxRef.current = playAlarm();
        sendNotification(label);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Resume a running timer from localStorage
  useEffect(() => {
    if (state !== "running") return;
    const saved = localStorage.getItem(storageKey);
    if (!saved) return;

    intervalRef.current = setInterval(() => {
      const endTime = parseInt(localStorage.getItem(storageKey) || "0", 10);
      const left = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setRemaining(left);

      if (left <= 0) {
        clear();
        setState("done");
        localStorage.removeItem(storageKey);
        audioCtxRef.current = playAlarm();
        sendNotification(label);
      }
    }, 1000);

    return clear;
  }, [state, storageKey, clear, label]);

  const start = () => {
    const seconds = state === "done" ? totalSeconds : remaining || totalSeconds;
    const endTime = Date.now() + seconds * 1000;
    localStorage.setItem(storageKey, endTime.toString());
    setRemaining(seconds);
    setState("running");

    // Request notification permission on first timer start
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  const reset = () => {
    clear();
    localStorage.removeItem(storageKey);
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
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
