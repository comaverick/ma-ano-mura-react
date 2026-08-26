const fs = require("fs");
const path = require("path");
const ws = require("ws");
const { createClient } = require("@supabase/supabase-js");

// ==========================================
// ENVIRONMENT VARIABLES
// ==========================================

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

// ==========================================
// SUPABASE CONFIG
// ==========================================

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.REACT_APP_SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_KEY ||
  process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error("ERROR: SUPABASE_URL is not set.");
  console.error(
    "Make sure SUPABASE_URL is available in your .env or GitHub Actions secrets."
  );
  process.exit(1);
}

if (!supabaseKey) {
  console.error("ERROR: SUPABASE_KEY is not set.");
  console.error(
    "Make sure SUPABASE_KEY is available in your .env or GitHub Actions secrets."
  );
  process.exit(1);
}

// Node.js 20 WebSocket support
const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    realtime: {
      transport: ws,
    },
  }
);

// ==========================================
// CONFIG
// ==========================================

const LOCATION_ID =
  "e0882552-d250-4545-8305-0fcfdff3a566";

const SOURCE = "SM Supermarkets";

const TODAY =
  new Date().toISOString().split("T")[0];

// ==========================================
// LOAD SM BEST PRICES
// ==========================================

const inputPath = path.resolve(
  __dirname,
  "sm-best-prices.json"
);

const products = JSON.parse(
  fs.readFileSync(
    inputPath,
    "utf8"
  )
);

// ==========================================
// HELPERS
// ==========================================

function round(value) {
  return Math.round(value * 100) / 100;
}

// ==========================================
// MAIN
// ==========================================

async function main() {

  const dryRun = process.argv.includes("--dry-run");
  const replaceToday = process.argv.includes("--replace-today");

  console.log(
    `Loaded ${products.length} SM best prices.`
  );

  console.log(
    `Date: ${TODAY}`
  );

  console.log(
    `Source: ${SOURCE}`
  );

  if (replaceToday) {
    console.log("Mode: replace today's SM prices");
  }

  // ========================================
  // LOAD ALL INGREDIENTS
  // ========================================

  const {
    data: ingredients,
    error: ingredientError,
  } = await supabase
    .from("ingredients")
    .select("id, name, unit, category");

  if (ingredientError) {
    throw ingredientError;
  }

  console.log(
    `Loaded ${ingredients.length} ingredients.\n`
  );

  // ========================================
  // CREATE INGREDIENT MAP
  // ========================================

  const ingredientMap = new Map(
    ingredients.map(
      (ingredient) => [
        ingredient.id,
        ingredient,
      ]
    )
  );

  const ingredientNameMap = new Map(
    ingredients.map(
      (ingredient) => [
        ingredient.name.toLowerCase().trim(),
        ingredient,
      ]
    )
  );

  // ========================================
  // BUILD PRICE ROWS
  // ========================================

  const rows = [];

  for (const product of products) {

    if (!product.ingredient) {

      console.log(
        `⚠ PRODUCT HAS NO INGREDIENT: ${product.product_name}`
      );

      continue;
    }

    const ingredient =
      ingredientMap.get(product.ingredient_id) ||
      ingredientNameMap.get(
        product.ingredient.toLowerCase().trim()
      );

    if (!ingredient) {

      console.log(
        `⚠ INGREDIENT NOT FOUND: ${product.ingredient}`
      );

      continue;
    }

    const quantity =
      Number(product.package_quantity);

    const packageUnit =
      product.package_unit
        ?.toLowerCase();

    const productPrice =
      Number(product.product_price);

    // ======================================
    // VALIDATE PRODUCT
    // ======================================

    if (
      !quantity ||
      !productPrice ||
      !packageUnit
    ) {

      console.log(
        `⚠ INVALID PRODUCT: ${product.product_name}`
      );

      continue;
    }

    let baseAmount;

    // ======================================
    // KG INGREDIENTS
    // ======================================

    if (
      ingredient.unit
        .toUpperCase() === "KG"
    ) {

      if (packageUnit === "g") {

        baseAmount =
          quantity / 1000;

      }

      else if (
        packageUnit === "kg"
      ) {

        baseAmount =
          quantity;

      }

      else {

        console.log(
          `⚠ Cannot convert ${packageUnit} → KG: ${product.product_name}`
        );

        continue;
      }
    }

    // ======================================
    // L INGREDIENTS
    // ======================================

    else if (
      ingredient.unit
        .toUpperCase() === "L"
    ) {

      if (
        packageUnit === "ml"
      ) {

        baseAmount =
          quantity / 1000;

      }

      else if (
        packageUnit === "l"
      ) {

        baseAmount =
          quantity;

      }

      else if (
        packageUnit === "g" &&
        ingredient.name.toLowerCase().includes("broth")
      ) {

        baseAmount =
          quantity / 1000;

      }

      else {

        console.log(
          `⚠ Cannot convert ${packageUnit} → L: ${product.product_name}`
        );

        continue;
      }
    }

    // ======================================
    // UNSUPPORTED INGREDIENT UNIT
    // ======================================

    else {

      console.log(
        `⚠ Unsupported unit: ${ingredient.name} → ${ingredient.unit}`
      );

      continue;
    }

    // ======================================
    // CALCULATE PRICE PER BASE UNIT
    // ======================================

    /*
      IMPORTANT:

      normalizeSM.js already accounts for
      multipacks when calculating
      package_quantity.

      Therefore we DO NOT multiply
      baseAmount by package_pieces again.
    */

    if (
      !baseAmount ||
      baseAmount <= 0
    ) {

      console.log(
        `⚠ INVALID PACKAGE SIZE: ${product.product_name}`
      );

      continue;
    }

    const pricePerBaseUnit =
      round(
        productPrice /
        baseAmount
      );

    console.log(
      `✓ ${ingredient.name}` +
      ` → ₱${pricePerBaseUnit}/${ingredient.unit}` +
      ` | ${product.product_name}`
    );

    // ======================================
    // PREPARE DATABASE ROW
    // ======================================

    rows.push({
      ingredient_id:
        ingredient.id,

      location_id:
        LOCATION_ID,

      avg_price:
        pricePerBaseUnit,

      date:
        TODAY,

      source:
        SOURCE,
    });
  }

  // ========================================
  // RESULTS
  // ========================================

  console.log(
    "\n================================"
  );

  console.log(
    `ROWS TO INSERT: ${rows.length}`
  );

  console.log(
    "================================"
  );

  // ========================================
  // DRY RUN
  // ========================================

  if (dryRun) {

    console.log(
      "\nDRY RUN — NOTHING WAS INSERTED."
    );

    return;
  }

  if (
    rows.length === 0
  ) {

    console.log(
      "Nothing to insert."
    );

    return;
  }

  if (replaceToday) {
    const { error: deleteError } = await supabase
      .from("prices")
      .delete()
      .eq("location_id", LOCATION_ID)
      .eq("date", TODAY);

    if (deleteError) {
      throw deleteError;
    }

    console.log("Removed today's existing prices for this location before replacement.");
  }

  // ========================================
  // CHECK EXISTING PRICES
  // ========================================

  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from("prices")
    .select("ingredient_id")
    .eq(
      "location_id",
      LOCATION_ID
    )
    .eq(
      "date",
      TODAY
    );

  if (existingError) {
    throw existingError;
  }

  // ========================================
  // PREVENT DUPLICATES
  // ========================================

  const existingIds =
    new Set(
      existing.map(
        (row) =>
          row.ingredient_id
      )
    );

  const newRows =
    rows.filter(
      (row) =>
        !existingIds.has(
          row.ingredient_id
        )
    );

  console.log(
    `Existing prices today at this location: ${existingIds.size}`
  );

  console.log(
    `New SM prices to insert: ${newRows.length}`
  );

  if (
    newRows.length === 0
  ) {

    console.log(
      "\n✓ Nothing new to insert."
    );

    return;
  }

  // ========================================
  // INSERT INTO SUPABASE
  // ========================================

  const {
    data: insertedRows,
    error: insertError,
  } = await supabase
    .from("prices")
    .upsert(
      newRows,
      {
        onConflict: "ingredient_id,location_id,date",
        ignoreDuplicates: true,
      }
    )
    .select("ingredient_id");

  if (insertError) {
    throw insertError;
  }

  console.log(
    `\n✓ Successfully inserted ${insertedRows.length} SM price rows.`
  );

  if (insertedRows.length < newRows.length) {
    console.log(
      `Skipped ${newRows.length - insertedRows.length} rows that already existed.`
    );
  }
}

// ==========================================
// RUN
// ==========================================

main().catch(
  (error) => {

    console.error(
      "\nERROR:"
    );

    console.error(
      error
    );

    process.exit(1);
  }
);
