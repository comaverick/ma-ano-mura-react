const fs = require("fs");
const path = require("path");
const ws = require("ws");
const { createClient } = require("@supabase/supabase-js");

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

// Check environment variables
if (!supabaseUrl) {
  console.error("ERROR: SUPABASE_URL is not set.");
  console.error(
    "Make sure SUPABASE_URL is available in your .env file or GitHub Actions secrets."
  );
  process.exit(1);
}

if (!supabaseKey) {
  console.error("ERROR: SUPABASE_KEY is not set.");
  console.error(
    "Make sure SUPABASE_KEY is available in your .env file or GitHub Actions secrets."
  );
  process.exit(1);
}

// Create Supabase client
// WebSocket transport is required for Node.js 20
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
// LOAD FILTERED SM PRODUCTS
// ==========================================

const productsPath = path.resolve(
  __dirname,
  "sm-food-products.json"
);

const products = JSON.parse(
  fs.readFileSync(
    productsPath,
    "utf8"
  )
);

// ==========================================
// NORMALIZE TEXT
// ==========================================

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[()\-_,.|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ==========================================
// MAIN FUNCTION
// ==========================================

async function run() {

  console.log(
    `Loaded ${products.length} filtered SM products.\n`
  );

  // ==========================================
  // LOAD INGREDIENTS
  // ==========================================

  const {
    data: ingredients,
    error,
  } = await supabase
    .from("ingredients")
    .select("id, name, unit, category");

  if (error) {

    console.error(
      "Failed to load ingredients:"
    );

    console.error(error);

    process.exit(1);
  }

  console.log(
    `Loaded ${ingredients.length} ingredients.\n`
  );

  // ==========================================
  // MATCH PRODUCTS TO INGREDIENTS
  // ==========================================

  const matched = [];
  const unmatched = [];

  for (const product of products) {

    const productName =
      normalize(product.name);

    let match = null;

    for (const ingredient of ingredients) {

      const ingredientName =
        normalize(ingredient.name);

      if (
        productName.includes(
          ingredientName
        )
      ) {

        match = ingredient;

        break;
      }
    }

    // ========================================
    // MATCHED
    // ========================================

    if (match) {

      matched.push({

        ...product,

        ingredient_id:
          match.id,

        ingredient_name:
          match.name,

      });

    }

    // ========================================
    // UNMATCHED
    // ========================================

    else {

      unmatched.push(product);

    }
  }

  // ==========================================
  // RESULTS
  // ==========================================

  console.log(
    "================================"
  );

  console.log(
    `MATCHED: ${matched.length}`
  );

  console.log(
    `UNMATCHED: ${unmatched.length}`
  );

  console.log(
    "================================"
  );

  // ==========================================
  // SAVE MATCHED PRODUCTS
  // ==========================================

  const matchedPath = path.resolve(
    __dirname,
    "sm-matched.json"
  );

  fs.writeFileSync(
    matchedPath,
    JSON.stringify(
      matched,
      null,
      2
    )
  );

  // ==========================================
  // SAVE UNMATCHED PRODUCTS
  // ==========================================

  const unmatchedPath = path.resolve(
    __dirname,
    "sm-unmatched.json"
  );

  fs.writeFileSync(
    unmatchedPath,
    JSON.stringify(
      unmatched,
      null,
      2
    )
  );

  // ==========================================
  // DONE
  // ==========================================

  console.log("\nSaved:");

  console.log(
    matchedPath
  );

  console.log(
    unmatchedPath
  );
}

// ==========================================
// RUN
// ==========================================

run().catch((error) => {

  console.error(
    "\nUnexpected error:"
  );

  console.error(error);

  process.exit(1);
});