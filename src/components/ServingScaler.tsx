import { useEffect, useState, createContext, useContext, type ReactNode } from "react";

interface ScalerContextValue {
  scale: number;
  servings: number;
  baseServings: number;
  setServings: (s: number) => void;
}

const ScalerContext = createContext<ScalerContextValue>({
  scale: 1,
  servings: 4,
  baseServings: 4,
  setServings: () => {},
});

export function useScaler() {
  return useContext(ScalerContext);
}

export function ScalerProvider({
  baseServings,
  children,
}: {
  baseServings: number;
  children: ReactNode;
}) {
  const [servings, setServings] = useState(baseServings);
  const scale = servings / baseServings;

  // Voice-assistant bridge — Chef Carl can scale/reset servings via window events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { action?: string; value?: number }
        | undefined;
      const action = (detail?.action || "").toLowerCase();
      if (action === "scale") {
        const v = Number(detail?.value);
        if (Number.isFinite(v) && v >= 1 && v <= 99) setServings(Math.round(v));
      } else if (action === "reset") {
        setServings(baseServings);
      }
    };
    window.addEventListener("carl:servings", handler);
    return () => window.removeEventListener("carl:servings", handler);
  }, [baseServings]);

  return (
    <ScalerContext.Provider value={{ scale, servings, baseServings, setServings }}>
      {children}
    </ScalerContext.Provider>
  );
}

export default function ServingScaler({ baseServings }: { baseServings: number }) {
  const { servings, setServings } = useScaler();

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-warm-gray">Servings</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setServings(Math.max(1, servings - 1))}
          className="w-8 h-8 rounded-full border border-warm-gray/30 text-warm-gray hover:border-terracotta hover:text-terracotta transition-colors flex items-center justify-center text-lg leading-none"
          aria-label="Decrease servings"
        >
          &minus;
        </button>
        <input
          type="number"
          min={1}
          max={99}
          value={servings}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (v > 0 && v < 100) setServings(v);
          }}
          className="w-12 text-center font-medium text-charcoal bg-transparent border-none focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          aria-label="Number of servings"
        />
        <button
          onClick={() => setServings(Math.min(99, servings + 1))}
          className="w-8 h-8 rounded-full border border-warm-gray/30 text-warm-gray hover:border-terracotta hover:text-terracotta transition-colors flex items-center justify-center text-lg leading-none"
          aria-label="Increase servings"
        >
          +
        </button>
      </div>
      {servings !== baseServings && (
        <button
          onClick={() => setServings(baseServings)}
          className="text-xs text-warm-gray hover:text-terracotta transition-colors"
        >
          Reset
        </button>
      )}
    </div>
  );
}
