import { supabase } from "../supabaseClient";
import domainIngredientcatalog from "../domain/ingredientCatalog.js";
const { normalizeName } = domainIngredientcatalog;
let marketRequest;
let recipeRequest;
export async function fetchAllRows(
  table,
  columns,
  configure = (query) => query,
) {
  const size = 1000;
  const first = await configure(
    supabase.from(table).select(columns, { count: "exact" }).order("id"),
  ).range(0, size - 1);
  if (first.error) throw new Error(first.error.message);
  const rows = first.data || [];
  if (first.count !== null && first.count <= size) return rows;
  // Bound concurrency and request every page in stable ID order, including
  // collections larger than Supabase's default 1,000-row response limit.
  if (first.count !== null) {
    for (let offset = size; offset < first.count; offset += size * 4) {
      const pages = await Promise.all(
        Array.from(
          { length: Math.min(4, Math.ceil((first.count - offset) / size)) },
          (_, index) => {
            const start = offset + index * size;
            return configure(
              supabase.from(table).select(columns).order("id"),
            ).range(start, start + size - 1);
          },
        ),
      );
      for (const page of pages) {
        if (page.error) throw new Error(page.error.message);
        rows.push(...(page.data || []));
      }
    }
  } else {
    for (let offset = size; rows.length === offset; offset += size) {
      const page = await configure(
        supabase.from(table).select(columns).order("id"),
      ).range(offset, offset + size - 1);
      if (page.error) throw new Error(page.error.message);
      rows.push(...(page.data || []));
    }
  }
  return rows;
}
export function loadMarket({ refresh = false } = {}) {
  if (refresh) marketRequest = null;
  if (!marketRequest)
    marketRequest = Promise.all([
      fetchAllRows("ingredients", "id,name,unit,category"),
      fetchAllRows(
        "prices",
        "id,ingredient_id,avg_price,date,source,location_id",
      ),
    ])
      .then(([ingredients, prices]) => {
        const grouped = new Map();
        for (const price of prices) {
          if (!grouped.has(price.ingredient_id))
            grouped.set(price.ingredient_id, []);
          grouped.get(price.ingredient_id).push(price);
        }
        return ingredients.map((ingredient) => ({
          ...ingredient,
          prices: grouped.get(ingredient.id) || [],
        }));
      })
      .catch((error) => {
        marketRequest = null;
        throw error;
      });
  return marketRequest;
}
export async function loadRecipes() {
  if (!recipeRequest)
    recipeRequest = Promise.all([
      import("../data/recipes.json").then((module) => module.default),
      fetchAllRows(
        "recipes",
        "id,name,prep_time,cook_time,total_time,servings,instructions",
      ).catch(() => []),
    ])
      .then(([source, database]) => {
        const recipes = new Map(
          Object.entries(source).map(([key, row]) => [
            key,
            { ...row, id: key.replace(/ /g, "-"), key, local: true },
          ]),
        );
        for (const row of database) {
          const key = normalizeName(row.name);
          const raw = recipes.get(key);
          recipes.set(key, {
            ...row,
            ...raw,
            id: String(row.id),
            key,
            instructions:
              raw?.instructions ||
              String(row.instructions || "")
                .split("|")
                .map((s) => s.trim())
                .filter(Boolean),
            ingredients: raw?.ingredients || [],
            local: !!raw,
          });
        }
        return [...recipes.values()].sort((a, b) =>
          a.name.localeCompare(b.name),
        );
      })
      .catch((error) => {
        recipeRequest = null;
        throw error;
      });
  return recipeRequest;
}
export async function loadLinkedRecipe(id) {
  const links = await fetchAllRows(
    "recipe_ingredients",
    "id,recipe_id,ingredient_id,original_name,quantity,unit",
    (query) => query.eq("recipe_id", id),
  );
  return links;
}
