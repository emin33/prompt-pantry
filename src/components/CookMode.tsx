import { useState, useEffect, useCallback, useRef } from "react";

export default function CookMode() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  const stepContainerRef = useRef<HTMLDivElement>(null);
  const stepNodesRef = useRef<Node[]>([]);

  const enter = useCallback(() => {
    // Clone step card DOM nodes (preserves React event handlers)
    const cards = document.querySelectorAll("#recipe-body .step-card");
    if (cards.length === 0) return;
    stepNodesRef.current = Array.from(cards).map((card) => card.cloneNode(true));
    setStepCount(cards.length);
    setStep(0);
    setActive(true);
    document.body.style.overflow = "hidden";
  }, []);

  const exit = useCallback(() => {
    setActive(false);
    setStep(0);
    stepNodesRef.current = [];
    document.body.style.overflow = "";
  }, []);

  // Render the current step's cloned DOM node and wire up timer buttons
  useEffect(() => {
    if (!active || !stepContainerRef.current) return;
    const container = stepContainerRef.current;
    container.innerHTML = "";
    const node = stepNodesRef.current[step];
    if (node) {
      const clone = node.cloneNode(true) as HTMLElement;
      container.appendChild(clone);

      // Wire up timer buttons in the cloned content
      clone.querySelectorAll("button").forEach((btn) => {
        const text = btn.textContent || "";
        const match = text.match(/(\d+(?:\.\d+)?)\s*min/);
        if (!match) return;

        const minutes = parseFloat(match[1]);
        const label = text.replace(/\s*—\s*\d+(?:\.\d+)?\s*min/, "").trim();
        const storageKey = `timer_${label || ""}_${minutes}`;

        btn.addEventListener("click", () => {
          const endTime = Date.now() + minutes * 60 * 1000;
          localStorage.setItem(storageKey, endTime.toString());
          btn.textContent = `${label ? label + " — " : ""}Started!`;
          btn.classList.add("opacity-60");
          btn.disabled = true;

          if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
          }
        });

        // Check if this timer is already running
        const existing = localStorage.getItem(storageKey);
        if (existing) {
          const endTime = parseInt(existing, 10);
          if (Date.now() < endTime) {
            const left = Math.ceil((endTime - Date.now()) / 1000);
            const m = Math.floor(left / 60);
            const s = left % 60;
            btn.textContent = `${label ? label + " — " : ""}${m}:${s.toString().padStart(2, "0")} remaining`;
            btn.classList.add("opacity-60");
            btn.disabled = true;
          }
        }
      });
    }
  }, [active, step]);

  // Wake lock
  useEffect(() => {
    if (!active) {
      wakeLock?.release();
      setWakeLock(null);
      return;
    }

    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        if ("wakeLock" in navigator) {
          lock = await navigator.wakeLock.request("screen");
          setWakeLock(lock);
        }
      } catch {}
    };
    acquire();

    return () => {
      lock?.release();
    };
  }, [active]);

  // Escape key to exit
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") exit();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [active, exit]);

  // Arrow key navigation
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        setStep((s) => Math.min(s + 1, stepCount - 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setStep((s) => Math.max(s - 1, 0));
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [active, stepCount]);

  // Voice-assistant bridge — Sigmond can drive cook mode via window events
  useEffect(() => {
    const onSigmondCookMode = (e: Event) => {
      const detail = (e as CustomEvent).detail as { action?: string } | undefined;
      const action = (detail?.action || "").toLowerCase();
      if (action === "enter") {
        if (!active) enter();
      } else if (action === "exit") {
        if (active) exit();
      } else if (action === "next" && active) {
        setStep((s) => Math.min(s + 1, stepCount - 1));
      } else if (action === "prev" && active) {
        setStep((s) => Math.max(s - 1, 0));
      }
    };
    window.addEventListener("sigmond:cook_mode", onSigmondCookMode);
    return () => window.removeEventListener("sigmond:cook_mode", onSigmondCookMode);
  }, [active, stepCount, enter, exit]);

  if (!active) {
    return (
      <button
        onClick={enter}
        className="no-print inline-flex items-center gap-1.5 text-sm text-warm-gray hover:text-charcoal transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l-4 4l6 6l4-4l-6-6z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 21.5l6-6" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C6.5 2 2 6.5 2 12c0 1 .2 2 .5 3" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M22 12c0-1-.2-2-.5-3" />
        </svg>
        Cook Mode
      </button>
    );
  }

  const isLast = step === stepCount - 1;

  return (
    <div className="fixed inset-0 z-50 bg-cream overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 min-h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm text-warm-gray">
            <span className="font-medium text-terracotta">Cook Mode</span>
            <span>&middot;</span>
            <span>
              Step {step + 1} of {stepCount}
            </span>
          </div>
          <button
            onClick={exit}
            className="text-sm text-warm-gray hover:text-terracotta transition-colors"
          >
            Exit
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-warm-gray/15 rounded-full mb-8">
          <div
            className="h-full bg-terracotta rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / stepCount) * 100}%` }}
          />
        </div>

        {/* Step content — rendered via DOM node cloning */}
        <div
          ref={stepContainerRef}
          className="recipe-prose text-lg leading-relaxed flex-1"
        />

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-warm-gray/15">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium text-warm-gray hover:text-charcoal disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            &larr; Previous
          </button>
          {!isLast ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-5 py-2.5 rounded-lg text-sm font-medium bg-terracotta text-white hover:bg-terracotta-dark transition-colors"
            >
              Next Step &rarr;
            </button>
          ) : (
            <button
              onClick={exit}
              className="px-5 py-2.5 rounded-lg text-sm font-medium bg-sage text-white hover:bg-sage-dark transition-colors"
            >
              Done Cooking
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
