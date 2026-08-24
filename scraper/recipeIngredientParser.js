const UNIT_ALIASES = {
  kilogram: "kg",
  kilograms: "kg",
  kg: "kg",
  gram: "g",
  grams: "g",
  g: "g",
  pound: "lb",
  pounds: "lb",
  lb: "lb",
  lbs: "lb",
  ounce: "oz",
  ounces: "oz",
  oz: "oz",
  milliliter: "ml",
  milliliters: "ml",
  ml: "ml",
  liter: "l",
  liters: "l",
  l: "l",
  quart: "quart",
  quarts: "quart",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tbsp: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tsp: "tsp",
  cup: "cup",
  cups: "cup",
  clove: "clove",
  cloves: "clove",
  piece: "piece",
  pieces: "piece",
  pc: "piece",
  pcs: "piece",
  bunch: "bunch",
  bunches: "bunch",
  can: "can",
  cans: "can",
  thumb: "thumb",
  thumbs: "thumb",
};

const FRACTIONS = {
  "½": 0.5,
  "¼": 0.25,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

function parseQuantity(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, " ");

  if (!normalized) {
    return null;
  }

  if (FRACTIONS[normalized] !== undefined) {
    return FRACTIONS[normalized];
  }

  if (/^\d+\s+\d+\/\d+$/.test(normalized)) {
    const [whole, fraction] = normalized.split(" ");
    const [numerator, denominator] = fraction.split("/").map(Number);
    return Number(whole) + numerator / denominator;
  }

  if (/^\d+\/\d+$/.test(normalized)) {
    const [numerator, denominator] = normalized.split("/").map(Number);
    return denominator ? numerator / denominator : null;
  }

  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeUnit(unit) {
  return UNIT_ALIASES[String(unit || "").toLowerCase()] || null;
}

function cleanIngredientName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(
      /\s+(cleaned|clean|washed|diced|cubed|sliced|chopped|crushed|julienned|wedged|frozen|quartered|halved|cut into|ground|to taste|as needed|divided|for serving|optional)\b.*$/i,
      ""
    )
    .replace(/^\s*(fresh|whole|medium|large|small|dried)\s+/i, "")
    .replace(/\s+and$/i, "")
    .trim();
}

function parseIngredientText(text) {
  const original = String(text || "")
    .trim()
    .replace(/\s+/g, " ");

  if (!original) {
    return {
      original: "",
      quantity: null,
      unit: null,
      name: "",
    };
  }

  const quantityPattern =
    "(?:\\d+(?:\\.\\d+)?(?:\\s+\\d+\\/\\d+)?|\\d+\\/\\d+|[½¼¾⅓⅔⅛⅜⅝⅞])";
  const unitsPattern =
    "kilograms?|kgs?|kg|grams?|g|pounds?|lbs?|lb|ounces?|oz|milliliters?|ml|liters?|l|quarts?|quart|tablespoons?|tbsp|teaspoons?|tsp|cups?|cup|cloves?|pieces?|pcs?|pc|bunch(?:es)?|cans?|can|thumbs?|thumb";

  const quantityAndUnitMatch = original.match(
    new RegExp(
      `^(${quantityPattern})\\s*(${unitsPattern})(?=\\s|\\.|$)\\.?\\s*(.*)$`,
      "i"
    )
  );

  if (quantityAndUnitMatch) {
    return {
      original,
      quantity: parseQuantity(quantityAndUnitMatch[1]),
      unit: normalizeUnit(quantityAndUnitMatch[2]),
      name: cleanIngredientName(quantityAndUnitMatch[3]),
    };
  }

  const quantityOnlyMatch = original.match(
    new RegExp(`^(${quantityPattern})\\s+(.+)$`, "i")
  );

  if (quantityOnlyMatch) {
    return {
      original,
      quantity: parseQuantity(quantityOnlyMatch[1]),
      unit: "piece",
      name: cleanIngredientName(quantityOnlyMatch[2]),
    };
  }

  return {
    original,
    quantity: null,
    unit: null,
    name: cleanIngredientName(original),
  };
}

module.exports = {
  normalizeUnit,
  parseIngredientText,
  parseQuantity,
};
