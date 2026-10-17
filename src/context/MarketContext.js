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
import { loadMarketSnapshot } from "../services/marketSnapshot";
const { createPriceIndex } = domainCosting;
const MarketContext = createContext(null);
export function MarketProvider({ children }) {
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [error, setError] = useState("");
  const [recipeError, setRecipeError] = useState("");
  const [marketSnapshot, setMarketSnapshot] = useState(null);
  const [packageLoading, setPackageLoading] = useState(true);
  const [packageError, setPackageError] = useState("");
  const refreshPackages = useCallback(async () => {
    setPackageLoading(true);
    setPackageError("");
    try {
      setMarketSnapshot(await loadMarketSnapshot({ refresh: true }));
    } catch {
      setPackageError(
        "Verified package details could not be loaded. Ingredient estimates are still available.",
      );
    } finally {
      setPackageLoading(false);
    }
  }, []);
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
  useEffect(() => {
    let active = true;
    loadMarketSnapshot()
      .then((data) => {
        if (active) setMarketSnapshot(data);
      })
      .catch(() => {
        if (active)
          setPackageError(
            "Verified package details could not be loaded. Ingredient estimates are still available.",
          );
      })
      .finally(() => {
        if (active) setPackageLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const enrichedIngredients = useMemo(() => {
    const evidence = new Map(
      (marketSnapshot?.quotes || []).map((quote) => [
        `${quote.ingredientId}:${quote.date}`,
        quote,
      ]),
    );
    return ingredients.map((ingredient) => ({
      ...ingredient,
      prices: ingredient.prices.map((price) => {
        const quote =
          price.source === "SM Supermarkets"
            ? evidence.get(`${ingredient.id}:${price.date}`)
            : null;
        return quote &&
          Math.abs(quote.unitPrice - Number(price.avg_price)) < 0.011
          ? {
              ...price,
              estimated: quote.estimated,
              estimateReason: quote.estimateReason,
              product: quote.product,
              productUrl: quote.url,
              variable: quote.variable,
              unitPriceLow: quote.unitPriceLow,
              unitPriceHigh: quote.unitPriceHigh,
            }
          : price;
      }),
    }));
  }, [ingredients, marketSnapshot]);
  const priceIndex = useMemo(
    () => createPriceIndex(enrichedIngredients),
    [enrichedIngredients],
  );
  return (
    <MarketContext.Provider
      value={{
        ingredients: enrichedIngredients,
        recipes,
        loading,
        recipesLoading,
        error,
        recipeError,
        refresh,
        priceIndex,
        marketSnapshot,
        packageLoading,
        packageError,
        refreshPackages,
      }}
    >
      {children}
    </MarketContext.Provider>
  );
}
export const useMarket = () => useContext(MarketContext);
