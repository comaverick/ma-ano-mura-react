const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const ws = require("ws");
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to sync recipes."
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

function paginateRecipes() {
  const rows = [];
  const pageSize = 1000;

  return (async () => {
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from("recipes")
        .select("id, name")
        .range(offset, offset + pageSize - 1);

      if (error) {
        throw error;
      }

      rows.push(...(data || []));
      if (!data || data.length < pageSize) {
        return rows;
      }
    }
  })();
}

async function main() {
  const existing = await paginateRecipes();
  const existingNames = new Set(existing.map((recipe) => recipe.name));
  const missing = recipes
    .filter((recipe) => !existingNames.has(recipe.recipe_name))
    .map((recipe) => ({
      name: recipe.recipe_name,
      prep_time: recipe.prep_time || null,
      cook_time: recipe.cook_time || null,
      total_time: recipe.total_time || null,
      servings: recipe.servings ? parseInt(recipe.servings, 10) : null,
      instructions: recipe.instructions || null,
    }));

  console.log(`CSV recipes: ${recipes.length}`);
  console.log(`Existing recipes: ${existing.length}`);
  console.log(`Missing recipes: ${missing.length}`);

  if (process.argv.includes("--dry-run") || missing.length === 0) {
    console.log("Dry run complete. Nothing was inserted.");
    return;
  }

  for (let offset = 0; offset < missing.length; offset += 250) {
    const chunk = missing.slice(offset, offset + 250);
    const { error } = await supabase.from("recipes").insert(chunk);

    if (error) {
      throw error;
    }

    console.log(`Inserted recipes ${offset + 1}-${offset + chunk.length}.`);
  }
}

main().catch((error) => {
  console.error("Could not sync recipes:", error);
  process.exit(1);
});
