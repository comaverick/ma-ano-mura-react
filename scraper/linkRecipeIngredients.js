const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const ws = require("ws");
const { createClient } = require("@supabase/supabase-js");
const aliases = require("./recipeIngredientAliases");
const { parseIngredientText } = require("./recipeIngredientParser");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to link recipes."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: { transport: ws },
});

const recipes = parse(
  fs.readFileSync(
    path.resolve(__dirname, "../datasets/filipino_recipes.csv"),
    "utf8"
  ),
  { columns: true, skip_empty_lines: true }
);

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[(),.\-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasPhrase(text, phrase) {
  if (!text || !phrase) {
    return false;
  }

  const pluralSuffix = phrase.endsWith("s") ? "" : "s?";
  return new RegExp(
    `(^|\\s)${phrase.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}${pluralSuffix}(?=\\s|$)`,
    "i"
  ).test(text);
}

function paginate(table, columns) {
  const pageSize = 1000;
  const pages = [];

  return (async () => {
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from(table)
        .select(columns)
        .range(offset, offset + pageSize - 1);

      if (error) {
        throw error;
      }

      pages.push(...(data || []));

      if (!data || data.length < pageSize) {
        return pages;
      }
    }
  })();
}

function stripTrailingNotes(value) {
  return normalize(value)
    .replace(/\b(to taste|as needed|divided|for serving|optional)\b.*$/i, "")
    .trim();
}

function addResolvedIngredients(label, resolveLabel, resolvedMap) {
  const normalized = stripTrailingNotes(label);

  if (
    !normalized ||
    ["water", "season", "garnish", "sauce", "liquid"].includes(normalized)
  ) {
    return;
  }

  if (normalized.includes(" and ")) {
    normalized
      .split(" and ")
      .forEach((part) => addResolvedIngredients(part, resolveLabel, resolvedMap));
    return;
  }

  for (const ingredient of resolveLabel(normalized)) {
    resolvedMap.set(ingredient.id, ingredient);
  }
}

function mergeMeasurements(measurements) {
  const usable = measurements.filter(
    (measurement) =>
      measurement.quantity !== null &&
      measurement.quantity !== undefined &&
      measurement.unit
  );

  if (usable.length === 0) {
    return {
      quantity: null,
      unit: null,
      mixedUnits: false,
    };
  }

  const units = new Set(usable.map((measurement) => measurement.unit));

  if (units.size > 1) {
    return {
      quantity: null,
      unit: null,
      mixedUnits: true,
    };
  }

  return {
    quantity: usable.reduce(
      (total, measurement) => total + measurement.quantity,
      0
    ),
    unit: usable[0].unit,
    mixedUnits: false,
  };
}

async function main() {
  const [dbRecipes, ingredients, existingLinks] = await Promise.all([
    paginate("recipes", "id, name"),
    paginate("ingredients", "id, name"),
    paginate(
      "recipe_ingredients",
      "id, recipe_id, ingredient_id, original_name, quantity, unit"
    ),
  ]);

  const recipeMap = new Map(
    dbRecipes.map((recipe) => [normalize(recipe.name), recipe])
  );
  const ingredientMap = new Map(
    ingredients.map((ingredient) => [normalize(ingredient.name), ingredient])
  );
  const ingredientEntries = ingredients
    .map((ingredient) => ({
      ingredient,
      name: normalize(ingredient.name),
    }))
    .filter((entry) => entry.name)
    .sort((a, b) => b.name.length - a.name.length);

  function resolveLabel(label) {
    const normalized = stripTrailingNotes(label);

    if (!normalized) {
      return [];
    }

    const aliasTarget = aliases[normalized];
    if (aliasTarget) {
      const ingredient = ingredientMap.get(normalize(aliasTarget));
      if (ingredient) {
        return [ingredient];
      }
    }

    const directMatch = ingredientEntries.find((entry) =>
      hasPhrase(normalized, entry.name)
    );

    return directMatch ? [directMatch.ingredient] : [];
  }

  const existingByKey = new Map(
    existingLinks.map((link) => [
      `${link.recipe_id}:${link.ingredient_id}`,
      link,
    ])
  );
  const desiredByKey = new Map();
  const missingRecipes = new Set();
  const unresolvedLabels = new Map();
  const mixedUnitLabels = [];
  let parsedSegments = 0;
  let measuredSegments = 0;

  for (const recipe of recipes) {
    const dbRecipe = recipeMap.get(normalize(recipe.recipe_name));

    if (!dbRecipe) {
      missingRecipes.add(recipe.recipe_name);
      continue;
    }

    const parsedIngredients = String(recipe.ingredients || "")
      .split("|")
      .map((value) => parseIngredientText(value))
      .filter((parsed) => parsed.name);

    parsedSegments += parsedIngredients.length;
    measuredSegments += parsedIngredients.filter(
      (parsed) => parsed.quantity !== null
    ).length;

    const targetIngredients = new Map();
    const labels = String(recipe.ingredient_names || "")
      .split("|")
      .map((label) => label.trim())
      .filter(Boolean);

    for (const label of labels) {
      const resolved = new Map();
      addResolvedIngredients(label, resolveLabel, resolved);

      if (resolved.size === 0) {
        const key = normalize(label);
        unresolvedLabels.set(key, (unresolvedLabels.get(key) || 0) + 1);
        continue;
      }

      for (const ingredient of resolved.values()) {
        targetIngredients.set(ingredient.id, {
          ingredient,
          label,
        });
      }
    }

    for (const { ingredient, label } of targetIngredients.values()) {
      const matchingSegments = parsedIngredients.filter((parsed) => {
        const resolved = new Map();
        addResolvedIngredients(parsed.name, resolveLabel, resolved);

        return (
          resolved.has(ingredient.id) ||
          hasPhrase(normalize(parsed.name), normalize(ingredient.name))
        );
      });

      const measurement = mergeMeasurements(matchingSegments);
      const matchingOriginal = matchingSegments
        .map((segment) => segment.original)
        .join(" + ");
      const key = `${dbRecipe.id}:${ingredient.id}`;

      if (measurement.mixedUnits) {
        mixedUnitLabels.push({
          recipe: recipe.recipe_name,
          ingredient: ingredient.name,
          values: matchingSegments.map(
            (segment) => `${segment.quantity} ${segment.unit}`
          ),
        });
      }

      desiredByKey.set(key, {
        recipe_id: dbRecipe.id,
        ingredient_id: ingredient.id,
        original_name: matchingOriginal || label,
        quantity: measurement.quantity,
        unit: measurement.unit,
      });
    }

    // Some older recipe rows were created from the full raw ingredient list
    // before the canonical ingredient_names links were added. Update those
    // existing rows too, but do not create new raw-only links in this pass.
    for (const parsed of parsedIngredients) {
      if (parsed.quantity === null || parsed.unit === null) {
        continue;
      }

      const resolved = new Map();
      addResolvedIngredients(parsed.name, resolveLabel, resolved);

      for (const ingredient of resolved.values()) {
        const key = `${dbRecipe.id}:${ingredient.id}`;

        if (!existingByKey.has(key)) {
          continue;
        }

        const currentDesired = desiredByKey.get(key);
        if (currentDesired && currentDesired.quantity !== null) {
          continue;
        }

        desiredByKey.set(key, {
          recipe_id: dbRecipe.id,
          ingredient_id: ingredient.id,
          original_name: parsed.original,
          quantity: parsed.quantity,
          unit: parsed.unit,
        });
      }
    }
  }

  const updatesByMeasurement = new Map();
  const rowsToInsert = [];

  for (const [key, desired] of desiredByKey) {
    const existing = existingByKey.get(key);

    if (!existing) {
      rowsToInsert.push(desired);
      continue;
    }

    if (desired.quantity === null || desired.unit === null) {
      continue;
    }

    const existingQuantity =
      existing.quantity === null || existing.quantity === undefined
        ? null
        : Number(existing.quantity);
    const sameQuantity = existingQuantity === desired.quantity;
    const sameUnit = String(existing.unit || "") === desired.unit;

    if (sameQuantity && sameUnit) {
      continue;
    }

    const measurementKey = JSON.stringify({
      quantity: desired.quantity,
      unit: desired.unit,
    });

    if (!updatesByMeasurement.has(measurementKey)) {
      updatesByMeasurement.set(measurementKey, []);
    }

    updatesByMeasurement.get(measurementKey).push(existing.id);
  }

  const updateCount = [...updatesByMeasurement.values()].reduce(
    (count, ids) => count + ids.length,
    0
  );

  console.log(`CSV recipes: ${recipes.length}`);
  console.log(`Database recipes: ${dbRecipes.length}`);
  console.log(`Existing recipe links: ${existingLinks.length}`);
  console.log(`Parsed ingredient segments: ${parsedSegments}`);
  console.log(`Segments with quantities: ${measuredSegments}`);
  console.log(`Recipe links to update: ${updateCount}`);
  console.log(`New links needed: ${rowsToInsert.length}`);
  console.log(`Recipes not in database: ${missingRecipes.size}`);
  console.log(`Mixed-unit measurements left blank: ${mixedUnitLabels.length}`);
  console.log("Most common unresolved canonical labels:");
  console.table(
    [...unresolvedLabels.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([label, count]) => ({ label, count }))
  );

  if (process.argv.includes("--dry-run")) {
    console.log("Dry run complete. Nothing was changed.");
    return;
  }

  for (const [measurementKey, ids] of updatesByMeasurement) {
    const measurement = JSON.parse(measurementKey);

    for (let offset = 0; offset < ids.length; offset += 500) {
      const chunk = ids.slice(offset, offset + 500);
      const { error } = await supabase
        .from("recipe_ingredients")
        .update({
          quantity: measurement.quantity,
          unit: measurement.unit,
        })
        .in("id", chunk);

      if (error) {
        throw error;
      }
    }
  }

  for (let offset = 0; offset < rowsToInsert.length; offset += 500) {
    const chunk = rowsToInsert.slice(offset, offset + 500);
    const { error } = await supabase
      .from("recipe_ingredients")
      .insert(chunk);

    if (error) {
      throw error;
    }
  }

  console.log(`Updated recipe links: ${updateCount}`);
  console.log(`Inserted recipe links: ${rowsToInsert.length}`);
}

main().catch((error) => {
  console.error("Could not sync recipe ingredient details:", error);
  process.exit(1);
});
