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
  "0.125": "⅛",
  "0.25": "¼",
  "0.333": "⅓",
  "0.5": "½",
  "0.667": "⅔",
  "0.75": "¾",
};

function formatAmount(amount: number): string {
  if (amount === 0) return "";

  const whole = Math.floor(amount);
  const frac = amount - whole;

  if (frac < 0.05) return whole.toString();

  // Find closest fraction
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

  // Fall back to decimal
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
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.name}>
          <h3 className="text-lg font-display text-charcoal mb-2">{group.name}</h3>
          <ul className="space-y-1.5">
            {group.items.map((item) => {
              const key = `${group.name}-${item.name}`;
              const isChecked = checked.has(key);
              const scaled = item.amount * scale;

              return (
                <li key={key}>
                  <label
                    className={`flex items-start gap-3 cursor-pointer group py-1 ${
                      isChecked ? "opacity-50" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggle(key)}
                      className="mt-1 w-4 h-4 rounded border-warm-gray/40 text-terracotta focus:ring-terracotta/30 accent-terracotta"
                    />
                    <span className={isChecked ? "line-through" : ""}>
                      {item.amount > 0 && (
                        <span className="font-medium">{formatAmount(scaled)}</span>
                      )}{" "}
                      {item.unit && <span>{item.unit}</span>}{" "}
                      <span>{item.name}</span>
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
