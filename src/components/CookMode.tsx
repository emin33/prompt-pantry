import { useState, useEffect, useCallback } from "react";

export default function CookMode() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [steps, setSteps] = useState<string[]>([]);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

  const enter = useCallback(() => {
    // Read step cards from the DOM
    const cards = document.querySelectorAll("#recipe-body .step-card");
    if (cards.length === 0) return;
    const html = Array.from(cards).map((card) => card.innerHTML);
    setSteps(html);
    setStep(0);
    setActive(true);
    document.body.style.overflow = "hidden";
  }, []);

  const exit = useCallback(() => {
    setActive(false);
    setStep(0);
    document.body.style.overflow = "";
  }, []);

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
        setStep((s) => Math.min(s + 1, steps.length - 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setStep((s) => Math.max(s - 1, 0));
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [active, steps.length]);

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

  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-cream overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 min-h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm text-warm-gray">
            <span className="font-medium text-terracotta">Cook Mode</span>
            <span>&middot;</span>
            <span>
              Step {step + 1} of {steps.length}
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
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Step content */}
        <div
          className="recipe-prose text-lg leading-relaxed flex-1"
          dangerouslySetInnerHTML={{ __html: steps[step] || "" }}
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
