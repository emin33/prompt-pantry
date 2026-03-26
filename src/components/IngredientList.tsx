import { useState } from "react";
import { useScaler } from "./ServingScaler";

interface IngredientItem {
  name: string;
  amount: number;
  unit: string;
}

interface IngredientGroup {
  name: string;
  items: IngredientItem[];
}

const FRACTIONS: Record<string, string> = {
  "0.125": "\u215B",
  "0.25": "\u00BC",
  "0.333": "\u2153",
  "0.5": "\u00BD",
  "0.667": "\u2154",
  "0.75": "\u00BE",
};

function formatAmount(amount: number): string {
  if (amount === 0) return "";

  const whole = Math.floor(amount);
  const frac = amount - whole;

  if (frac < 0.05) return whole.toString();

  let closestKey = "";
  let closestDist = Infinity;
  for (const key of Object.keys(FRACTIONS)) {
    const dist = Math.abs(frac - parseFloat(key));
    if (dist < closestDist) {
      closestDist = dist;
      closestKey = key;
    }
  }

  if (closestDist < 0.05) {
    const fracStr = FRACTIONS[closestKey];
    return whole > 0 ? `${whole} ${fracStr}` : fracStr;
  }

  return amount % 1 === 0 ? amount.toString() : amount.toFixed(1);
}

export default function IngredientList({ groups }: { groups: IngredientGroup[] }) {
  const { scale } = useScaler();
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.name}>
          <h3 className="text-sm font-semibold text-terracotta uppercase tracking-wide mb-3">
            {group.name}
          </h3>
          <ul className="space-y-0">
            {group.items.map((item, i) => {
              const key = `${group.name}-${item.name}`;
              const isChecked = checked.has(key);
              const scaled = item.amount * scale;

              return (
                <li key={key}>
                  <label
                    className={`flex items-center gap-3 cursor-pointer group py-2.5 px-3 rounded-lg transition-colors ${
                      i % 2 === 0 ? "bg-cream/50" : ""
                    } ${isChecked ? "opacity-40" : "hover:bg-sage-light/20"}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggle(key)}
                      className="w-4 h-4 rounded border-warm-gray/40 text-terracotta focus:ring-terracotta/30 accent-terracotta flex-shrink-0"
                    />
                    <span className={`flex-1 flex items-baseline gap-2 ${isChecked ? "line-through" : ""}`}>
                      <span className="font-semibold text-charcoal min-w-[3.5rem] text-right tabular-nums">
                        {item.amount > 0 ? formatAmount(scaled) : ""}
                      </span>
                      <span className="text-muted min-w-[2.5rem]">
                        {item.unit}
                      </span>
                      <span className="text-charcoal">
                        {item.name}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
