import { useState, useEffect } from "react";
import { ScalerProvider, useScaler } from "./ServingScaler";
import ServingScaler from "./ServingScaler";
import IngredientList, { formatAmount } from "./IngredientList";
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
    <div className="mb-3 px-3 py-2 rounded-lg bg-golden-light/50 border border-golden/20 text-xs text-warm-gray">
      <span className="font-semibold text-golden">Note:</span> Ingredient
      amounts have been adjusted for {servings} servings. Step instructions
      still reference the original {baseServings}-serving quantities.
    </div>
  );
}

function formatIngredientsAsText(groups: IngredientGroup[], scale: number, servings: number): string {
  const lines: string[] = [`Ingredients (${servings} servings)`, ""];
  for (const group of groups) {
    lines.push(group.name.toUpperCase());
    for (const item of group.items) {
      const amt = item.amount > 0 ? formatAmount(item.amount * scale) : "";
      const parts = [amt, item.unit, item.name].filter(Boolean).join(" ");
      lines.push(`- ${parts}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

function CopyShareButtons({ groups }: { groups: IngredientGroup[] }) {
  const { scale, servings } = useScaler();
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  const getText = () => formatIngredientsAsText(groups, scale, servings);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(getText());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleShare = async () => {
    try {
      await navigator.share({ title: "Ingredient List", text: getText() });
    } catch {
      // User cancelled share
    }
  };

  return (
    <span className="inline-flex items-center gap-1">
      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-terracotta transition-colors"
        title="Copy ingredient list"
      >
        {copied ? (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Copied!
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy list
          </>
        )}
      </button>
      {canShare && (
        <button
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-terracotta transition-colors"
          title="Share ingredient list"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share
        </button>
      )}
    </span>
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

  // Voice-assistant bridge — Chef Carl can pin/unpin via window events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { action?: string } | undefined;
      const action = (detail?.action || "").toLowerCase();
      if (action === "pin") setPinned(true);
      else if (action === "unpin") setPinned(false);
    };
    window.addEventListener("carl:servings", handler);
    return () => window.removeEventListener("carl:servings", handler);
  }, []);

  // No body scroll lock — sidebar is a fixed panel, page scrolls freely behind it

  return (
    <>
      {/* Main ingredients section */}
      <div className="bg-warm-white rounded-xl border border-warm-gray/10 p-6 md:p-8">
        <CollapsibleSection title="Ingredients" icon="&#x1F9C2;">
          <div className="flex flex-wrap items-center justify-between gap-y-2 mb-4">
            <div className="flex items-center gap-3">
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
              <span className="text-warm-gray/30">|</span>
              <CopyShareButtons groups={groups} />
            </div>
            <ServingScaler baseServings={servings} />
          </div>
          <ServingDisclaimer />
          <IngredientList groups={groups} />
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
