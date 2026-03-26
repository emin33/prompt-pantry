import { ScalerProvider } from "./ServingScaler";
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

export default function RecipeIngredients({ servings, groups }: Props) {
  return (
    <ScalerProvider baseServings={servings}>
      <div className="bg-warm-white rounded-xl border border-warm-gray/10 p-6 md:p-8">
        <CollapsibleSection title="Ingredients" icon="&#x1F9C2;">
          <div className="flex items-center justify-end mb-4">
            <ServingScaler baseServings={servings} />
          </div>
          <IngredientList groups={groups} />
        </CollapsibleSection>
      </div>
    </ScalerProvider>
  );
}
