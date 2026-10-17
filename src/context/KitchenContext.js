import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import planning from "../domain/planning.js";
const { STORAGE_KEY, cleanKitchen, recipeKey } = planning;
const KitchenContext = createContext(null);
function initialState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return { data: cleanKitchen(raw ? JSON.parse(raw) : {}), error: "" };
  } catch {
    return {
      data: cleanKitchen({}),
      error:
        "Saved kitchen data could not be read. Changes will be kept for this visit; enable browser storage to save them.",
    };
  }
}
export function KitchenProvider({ children }) {
  const [initial] = useState(initialState);
  const [data, setData] = useState(initial.data);
  const [storageError, setStorageError] = useState(initial.error);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setStorageError("");
    } catch {
      setStorageError(
        "Your browser could not save these changes. They are available for this visit only.",
      );
    }
  }, [data]);
  useEffect(() => {
    const receive = (event) => {
      if (event.key !== STORAGE_KEY) return;
      try {
        setData(cleanKitchen(event.newValue ? JSON.parse(event.newValue) : {}));
      } catch {
        setStorageError(
          "Kitchen data changed in another tab but could not be read.",
        );
      }
    };
    window.addEventListener("storage", receive);
    return () => window.removeEventListener("storage", receive);
  }, []);
  const toggle = useCallback(
    (field, key) =>
      setData((current) => ({
        ...current,
        [field]: current[field].includes(key)
          ? current[field].filter((item) => item !== key)
          : [...current[field], key],
      })),
    [],
  );
  const toggleFavorite = useCallback(
    (recipe) => toggle("favorites", recipeKey(recipe)),
    [toggle],
  );
  const togglePantry = useCallback((key) => toggle("pantry", key), [toggle]);
  const toggleChecked = useCallback((key) => toggle("checked", key), [toggle]);
  const setMeasurement = useCallback((recipe, row, quantity, unit) => {
    setData((current) => {
      const key = recipeKey(recipe);
      const rows = { ...current.measurements[key] };
      if (quantity === null) delete rows[row.id];
      else rows[row.id] = { rawName: row.rawName, quantity, unit };
      return {
        ...current,
        measurements: planning.cleanKitchen({
          ...current,
          measurements: { ...current.measurements, [key]: rows },
        }).measurements,
      };
    });
    setNotice(
      quantity === null
        ? "Original recipe quantity restored."
        : `Your measurement for ${row.definition?.name || row.parsed.name} is saved for this recipe.`,
    );
  }, []);
  const addMeal = useCallback((recipe, date, slot, servings) => {
    setData((current) =>
      cleanKitchen({
        ...current,
        plans: [
          ...current.plans.filter(
            (item) => item.date !== date || item.slot !== slot,
          ),
          {
            recipeKey: recipeKey(recipe),
            date,
            slot,
            servings,
            ...(!recipe.local
              ? {
                  recipe: {
                    name: recipe.name,
                    servings: recipe.servings,
                    ingredients: recipe.ingredients,
                  },
                }
              : {}),
          },
        ],
      }),
    );
    setNotice(`${recipe.name} added to ${slot.toLowerCase()} on ${date}.`);
  }, []);
  const removeMeal = useCallback(
    (date, slot) =>
      setData((current) => ({
        ...current,
        plans: current.plans.filter(
          (item) => item.date !== date || item.slot !== slot,
        ),
      })),
    [],
  );
  const setBudget = useCallback(
    (week, amount) =>
      setData((current) =>
        cleanKitchen({
          ...current,
          budgets: { ...current.budgets, [week]: amount },
        }),
      ),
    [],
  );
  const value = useMemo(
    () => ({
      ...data,
      storageError,
      notice,
      toggleFavorite,
      togglePantry,
      toggleChecked,
      addMeal,
      removeMeal,
      setBudget,
      setMeasurement,
    }),
    [
      data,
      storageError,
      notice,
      toggleFavorite,
      togglePantry,
      toggleChecked,
      addMeal,
      removeMeal,
      setBudget,
      setMeasurement,
    ],
  );
  return (
    <KitchenContext.Provider value={value}>{children}</KitchenContext.Provider>
  );
}
export const useKitchen = () => useContext(KitchenContext);
