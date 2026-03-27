import { useState, useEffect } from "react";
import { ScalerProvider, useScaler } from "./ServingScaler";
import ServingScaler from "./ServingScaler";
import IngredientList from "./IngredientList";
import CollapsibleSection from "./CollapsibleSection";

interface IngredientItem {
  name: string;
  amount: number;
  unit: string;
}

interface IngredientGroup {
  name: string;
  items: IngredientItem[];
}

interface Props {
  servings: number;
  groups: IngredientGroup[];
}

function ServingDisclaimer() {
  const { servings, baseServings } = useScaler();

  if (servings === baseServings) return null;

  return (
    <div className="mt-3 px-3 py-2 rounded-lg bg-golden-light/50 border border-golden/20 text-xs text-warm-gray">
      <span className="font-semibold text-golden">Note:</span> Ingredient
      amounts have been adjusted for {servings} servings. Step instructions
      still reference the original {baseServings}-serving quantities.
    </div>
  );
}

function SidebarContent({ groups }: { groups: IngredientGroup[] }) {
  return (
    <div className="overflow-y-auto max-h-[calc(100vh-8rem)]">
      <IngredientList groups={groups} />
    </div>
  );
}

function IngredientsWithSidebar({ servings, groups }: Props) {
  const [pinned, setPinned] = useState(false);

  // Close sidebar on Escape
  useEffect(() => {
    if (!pinned) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinned(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pinned]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (pinned) {
      document.body.style.overflow = "hidden";
      // Add padding to prevent layout shift from scrollbar disappearing
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [pinned]);

  return (
    <>
      {/* Main ingredients section */}
      <div className="bg-warm-white rounded-xl border border-warm-gray/10 p-6 md:p-8">
        <CollapsibleSection title="Ingredients" icon="&#x1F9C2;">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setPinned(true)}
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-terracotta transition-colors"
              title="Pin ingredients to sidebar while you cook"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              Pin to sidebar
            </button>
            <ServingScaler baseServings={servings} />
          </div>
          <IngredientList groups={groups} />
          <ServingDisclaimer />
        </CollapsibleSection>
      </div>

      {/* Sidebar overlay */}
      {pinned && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-charcoal/20 z-40 md:bg-transparent"
            onClick={() => setPinned(false)}
          />

          {/* Sidebar panel */}
          <div className="fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-warm-white border-l border-warm-gray/15 shadow-2xl z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-warm-gray/10">
              <h3 className="font-display text-lg text-charcoal">Ingredients</h3>
              <button
                onClick={() => setPinned(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-charcoal hover:bg-cream transition-colors"
                aria-label="Close sidebar"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scaler */}
            <div className="px-5 py-3 border-b border-warm-gray/10">
              <ServingScaler baseServings={servings} />
              <ServingDisclaimer />
            </div>

            {/* Scrollable ingredient list */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <SidebarContent groups={groups} />
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default function PinnableIngredients({ servings, groups }: Props) {
  return (
    <ScalerProvider baseServings={servings}>
      <IngredientsWithSidebar servings={servings} groups={groups} />
    </ScalerProvider>
  );
}
