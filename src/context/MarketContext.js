import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { loadMarket, loadRecipes } from "../services/marketData";
import domainCosting from "../domain/costing.js";
const { createPriceIndex } = domainCosting;
const MarketContext = createContext(null);
export function MarketProvider({ children }) {
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [error, setError] = useState("");
  const [recipeError, setRecipeError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setIngredients(await loadMarket({ refresh: true }));
    } catch {
      setError("Ingredient prices could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    loadMarket()
      .then((data) => {
        if (active) setIngredients(data);
      })
      .catch(() => {
        if (active)
          setError("Ingredient prices could not be loaded. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    loadRecipes()
      .then((data) => {
        if (active) setRecipes(data);
      })
      .catch(() => {
        if (active)
          setRecipeError("The recipe collection could not be loaded.");
      })
      .finally(() => {
        if (active) setRecipesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const priceIndex = useMemo(
    () => createPriceIndex(ingredients),
    [ingredients],
  );
  return (
    <MarketContext.Provider
      value={{
        ingredients,
        recipes,
        loading,
        recipesLoading,
        error,
        recipeError,
        refresh,
        priceIndex,
      }}
    >
      {children}
    </MarketContext.Provider>
  );
}
export const useMarket = () => useContext(MarketContext);
