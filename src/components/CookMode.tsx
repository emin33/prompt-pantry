import { useState, useEffect, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  stepCount: number;
}

export default function CookMode({ children, stepCount }: Props) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

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

  if (!active) {
    return (
      <div>
        <button
          onClick={() => setActive(true)}
          className="cook-mode-toggle mb-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-terracotta text-white font-medium hover:bg-terracotta-dark transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M15 10l-4 4l6 6l4-4l-6-6z" />
            <path d="M2.5 21.5l6-6" />
            <path d="M12 2C6.5 2 2 6.5 2 12c0 1 .2 2 .5 3" />
            <path d="M22 12c0-1-.2-2-.5-3" />
          </svg>
          Enter Cook Mode
        </button>
        <div className="recipe-prose">{children}</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-cream overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-sm text-warm-gray">
            <span className="font-medium text-terracotta">Cook Mode</span>
            <span>&middot;</span>
            <span>
              Step {step + 1} of {stepCount}
            </span>
          </div>
          <button
            onClick={() => {
              setActive(false);
              setStep(0);
            }}
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

        {/* Steps content */}
        <div className="recipe-prose text-lg leading-relaxed">{children}</div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-warm-gray/15">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium text-warm-gray hover:text-charcoal disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            &larr; Previous
          </button>
          {step < stepCount - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-5 py-2.5 rounded-lg text-sm font-medium bg-terracotta text-white hover:bg-terracotta-dark transition-colors"
            >
              Next Step &rarr;
            </button>
          ) : (
            <button
              onClick={() => {
                setActive(false);
                setStep(0);
              }}
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
