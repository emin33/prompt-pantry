import { ScalerProvider } from "./ServingScaler";
import ServingScaler from "./ServingScaler";
import IngredientList from "./IngredientList";

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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl md:text-3xl text-charcoal !mt-0 !mb-0 !border-0 !pb-0">
            Ingredients
          </h2>
          <ServingScaler baseServings={servings} />
        </div>
        <IngredientList groups={groups} />
      </div>
    </ScalerProvider>
  );
}
