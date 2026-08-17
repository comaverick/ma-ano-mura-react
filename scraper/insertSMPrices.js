require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env")
});

const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.REACT_APP_SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_KEY ||
  process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const LOCATION_ID =
  "e0882552-d250-4545-8305-0fcfdff3a566";

const SOURCE = "SM Supermarkets";
const TODAY = new Date().toISOString().split("T")[0];

const products = JSON.parse(
  fs.readFileSync("scraper/sm-best-prices.json", "utf8")
);

function round(value) {
  return Math.round(value * 100) / 100;
}

async function main() {
  console.log(`Loaded ${products.length} SM best prices.`);
  console.log(`Date: ${TODAY}`);
  console.log(`Source: ${SOURCE}`);

  // Load Pantry ingredients
  const { data: ingredients, error: ingredientError } =
    await supabase
      .from("ingredients")
      .select("id, name, unit")
      .eq("category", "Pantry");

  if (ingredientError) {
    throw ingredientError;
  }

  console.log(`Loaded ${ingredients.length} Pantry ingredients.\n`);

  const ingredientMap = new Map(
    ingredients.map((ingredient) => [
      ingredient.name.toLowerCase(),
      ingredient,
    ])
  );

  const rows = [];

  for (const product of products) {
    const ingredient = ingredientMap.get(
      product.ingredient.toLowerCase()
    );

    if (!ingredient) {
      console.log(
        `⚠ INGREDIENT NOT FOUND: ${product.ingredient}`
      );
      continue;
    }

    const quantity = Number(product.package_quantity);
    const pieces = Number(product.package_pieces || 1);
    const packageUnit = product.package_unit.toLowerCase();
    const productPrice = Number(product.product_price);

    if (!quantity || !productPrice) {
      console.log(
        `⚠ INVALID PRODUCT: ${product.product_name}`
      );
      continue;
    }

    let baseAmount;

    // ================================
    // KG ingredients
    // ================================

    if (ingredient.unit === "KG") {
      if (packageUnit === "g") {
        baseAmount = quantity / 1000;
      } else if (packageUnit === "kg") {
        baseAmount = quantity;
      } else {
        console.log(
          `⚠ Cannot convert ${packageUnit} → KG: ${product.product_name}`
        );
        continue;
      }
    }

    // ================================
    // L ingredients
    // ================================

    else if (ingredient.unit === "L") {
      if (packageUnit === "ml") {
        baseAmount = quantity / 1000;
      } else if (packageUnit === "l") {
        baseAmount = quantity;
      } else {
        console.log(
          `⚠ Cannot convert ${packageUnit} → L: ${product.product_name}`
        );
        continue;
      }
    }

    else {
      console.log(
        `⚠ Unsupported unit: ${ingredient.name} → ${ingredient.unit}`
      );
      continue;
    }

    // Account for multi-piece packages
    baseAmount *= pieces;

    const pricePerBaseUnit = round(
      productPrice / baseAmount
    );

    console.log(
      `✓ ${ingredient.name}` +
      ` → ₱${pricePerBaseUnit}/${ingredient.unit}` +
      ` | ${product.product_name}`
    );

    rows.push({
      ingredient_id: ingredient.id,
      location_id: LOCATION_ID,
      avg_price: pricePerBaseUnit,
      date: TODAY,
      source: SOURCE,
    });
  }

  console.log("\n================================");
  console.log(`ROWS TO INSERT: ${rows.length}`);
  console.log("================================");

  // --------------------------------
  // DRY RUN
  // --------------------------------

  if (process.argv.includes("--dry-run")) {
    console.log("\nDRY RUN — NOTHING WAS INSERTED.");
    return;
  }

  if (rows.length === 0) {
    console.log("Nothing to insert.");
    return;
  }

  // --------------------------------
  // Prevent duplicates
  // --------------------------------

  const { data: existing, error: existingError } =
    await supabase
      .from("prices")
      .select("ingredient_id")
      .eq("location_id", LOCATION_ID)
      .eq("date", TODAY)
      .eq("source", SOURCE);

  if (existingError) {
    throw existingError;
  }

  const existingIds = new Set(
    existing.map((row) => row.ingredient_id)
  );

  const newRows = rows.filter(
    (row) => !existingIds.has(row.ingredient_id)
  );

  console.log(
    `Existing SM prices today: ${existingIds.size}`
  );

  console.log(
    `New SM prices to insert: ${newRows.length}`
  );

  if (newRows.length === 0) {
    console.log("\n✓ Nothing new to insert.");
    return;
  }

  const { error: insertError } =
    await supabase
      .from("prices")
      .insert(newRows);

  if (insertError) {
    throw insertError;
  }

  console.log(
    `\n✓ Successfully inserted ${newRows.length} SM price rows.`
  );
}

main().catch((error) => {
  console.error("\nERROR:");
  console.error(error);
  process.exit(1);
});