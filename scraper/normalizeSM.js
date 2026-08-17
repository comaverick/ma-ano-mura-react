const fs = require("fs");
const path = require("path");

// ---------------------------------------
// File paths
// ---------------------------------------

const inputPath = path.join(
  __dirname,
  "sm-pantry-matched.json"
);

const outputPath = path.join(
  __dirname,
  "sm-normalized.json"
);

// ---------------------------------------
// Load products
// ---------------------------------------

const products = JSON.parse(
  fs.readFileSync(
    inputPath,
    "utf8"
  )
);

function parsePackage(name) {
  const text = name.toLowerCase();

  // ---------------------------------------
  // GALLON
  // ---------------------------------------

  const gallonMatch = text.match(
    /(\d+\/\d+|\d+(?:\.\d+)?)\s*gallon\b/i
  );

  if (gallonMatch) {
    let gallons;

    if (gallonMatch[1] === "1/2") {
      gallons = 0.5;
    } else if (gallonMatch[1] === "1/4") {
      gallons = 0.25;
    } else if (gallonMatch[1] === "3/4") {
      gallons = 0.75;
    } else if (gallonMatch[1].includes("/")) {
      const [a, b] = gallonMatch[1].split("/");
      gallons = Number(a) / Number(b);
    } else {
      gallons = Number(gallonMatch[1]);
    }

    return {
      quantity: gallons * 3785.41,
      unit: "ml",
      pieces: 1,
    };
  }

  // ---------------------------------------
  // NORMAL SIZE
  // ---------------------------------------

  const sizeMatch = text.match(
    /(\d+(?:\.\d+)?)\s*(kg|g|ml|l|oz)\b/i
  );

  if (!sizeMatch) {
    return null;
  }

  let quantity = Number(sizeMatch[1]);
  let unit = sizeMatch[2].toLowerCase();

  if (unit === "kg") {
    quantity *= 1000;
    unit = "g";
  }

  if (unit === "l") {
    quantity *= 1000;
    unit = "ml";
  }

  if (unit === "oz") {
    quantity *= 28.3495;
    unit = "g";
  }

  // ---------------------------------------
  // MULTIPACK
  // ---------------------------------------

  const piecesMatch = text.match(
    /(\d+)\s*(?:pcs?|pieces?)\b/i
  );

  let pieces = 1;

  if (piecesMatch) {
    pieces = Number(piecesMatch[1]);
    quantity *= pieces;
  }

  return {
    quantity,
    unit,
    pieces,
  };
}

function pricePer100(price, packageInfo) {

  if (!packageInfo) {
    return null;
  }

  if (!packageInfo.quantity) {
    return null;
  }

  return (
    price /
    packageInfo.quantity *
    100
  );
}

const normalized = [];

for (const product of products) {

  const packageInfo =
    parsePackage(product.name);

  const price100 =
    pricePer100(
      product.price,
      packageInfo
    );

  normalized.push({

    ...product,

    package_quantity:
      packageInfo?.quantity ?? null,

    package_unit:
      packageInfo?.unit ?? null,

    package_pieces:
      packageInfo?.pieces ?? null,

    price_per_100:
      price100 !== null
        ? Number(price100.toFixed(2))
        : null,

  });
}

// ---------------------------------------
// Save
// ---------------------------------------

fs.writeFileSync(

  outputPath,

  JSON.stringify(
    normalized,
    null,
    2
  )

);

// ---------------------------------------
// Test important examples
// ---------------------------------------

console.log(
  `PRODUCTS: ${normalized.length}\n`
);

const testProducts =
  normalized.slice(0, 30);

for (const product of testProducts) {

  console.log(
    product.name
  );

  console.log(
    `  → ${product.pantry_ingredient}`
  );

  console.log(
    `  → ₱${product.price}`
  );

  console.log(
    `  → ${product.package_quantity ?? "N/A"} ${product.package_unit ?? ""}`
  );

  console.log(
    `  → ${product.package_pieces ?? 1} pcs`
  );

  console.log(
    `  → ₱${product.price_per_100 ?? "N/A"} / 100${product.package_unit ?? ""}`
  );

  console.log("");
}

console.log(
  `Saved: ${outputPath}`
);