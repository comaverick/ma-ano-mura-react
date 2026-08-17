const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const products = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "sm-food-products.json"),
    "utf8"
  )
);

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[()\-_,.|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
      "Failed to load ingredients:",
      error
    );

    return;
  }

  console.log(
    `Loaded ${ingredients.length} ingredients.\n`
  );


  // ==========================================
  // MATCH
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

    if (match) {

      matched.push({

        ...product,

        ingredient_id:
          match.id,

        ingredient_name:
          match.name,

      });

    } else {

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
  // SAVE
  // ==========================================

  fs.writeFileSync(

    path.resolve(
      __dirname,
      "sm-matched.json"
    ),

    JSON.stringify(
      matched,
      null,
      2
    )

  );

  fs.writeFileSync(

    path.resolve(
      __dirname,
      "sm-unmatched.json"
    ),

    JSON.stringify(
      unmatched,
      null,
      2
    )

  );


  console.log(
    "\nSaved:"
  );

  console.log(
    "scraper/sm-matched.json"
  );

  console.log(
    "scraper/sm-unmatched.json"
  );

}

run();