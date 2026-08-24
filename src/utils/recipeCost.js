const UNIT_ALIASES = {
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  g: "g",
  gram: "g",
  grams: "g",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  l: "l",
  liter: "l",
  liters: "l",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  cup: "cup",
  cups: "cup",
  quart: "quart",
  quarts: "quart",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  piece: "piece",
  pieces: "piece",
  pc: "piece",
  pcs: "piece",
  clove: "clove",
  cloves: "clove",
  bunch: "bunch",
  bunches: "bunch",
  thumb: "thumb",
  thumbs: "thumb",
  can: "can",
  cans: "can",
};

const PRICE_SOURCES = [
  { value: "DA Pricewatch", label: "DA Pricewatch" },
  { value: "SM Supermarkets", label: "SM Supermarket" },
];

const PIECE_WEIGHTS_KG = [
  { names: ["garlic"], weight: 0.003 },
  { names: ["white onion", "red onion", "shallot"], weight: 0.12 },
  { names: ["tomato"], weight: 0.1 },
  { names: ["carrot"], weight: 0.08 },
  { names: ["potato"], weight: 0.15 },
  { names: ["bell pepper"], weight: 0.15 },
  { names: ["chili"], weight: 0.015 },
  { names: ["green onion"], weight: 0.015 },
  { names: ["kangkong"], weight: 0.2 },
  { names: ["pechay"], weight: 0.2 },
  { names: ["cilantro", "parsley"], weight: 0.05 },
  { names: ["malunggay"], weight: 0.1 },
  { names: ["lemongrass"], weight: 0.05 },
];

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[(),./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeRecipeUnit = (unit) =>
  UNIT_ALIASES[String(unit || "").toLowerCase().trim()] || null;

const normalizeCatalogUnit = (unit) => {
  const normalized = String(unit || "").toLowerCase().trim();

  if (normalized === "kg") return "kg";
  if (normalized === "l") return "l";

  if (
    normalized === "pc" ||
    normalized === "piece" ||
    normalized.includes("medium") ||
    normalized.includes("large") ||
    normalized.includes("extra large") ||
    normalized.includes("small") ||
    normalized.includes("grams/pc") ||
    normalized.includes("gram/pc")
  ) {
    return "piece";
  }

  return null;
};

const findPieceWeight = (ingredientName) => {
  const normalizedName = normalize(ingredientName);
  return PIECE_WEIGHTS_KG.find((entry) =>
    entry.names.some((name) => normalizedName.includes(name))
  )?.weight || null;
};

const convertRecipeQuantity = ({ quantity, recipeUnit, ingredient }) => {
  const numericQuantity = Number(quantity);
  const normalizedRecipeUnit = normalizeRecipeUnit(recipeUnit);
  const catalogUnit = normalizeCatalogUnit(ingredient?.unit);

  if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
    return { amount: null, baseUnit: catalogUnit, estimated: false, reason: "Quantity unavailable" };
  }

  if (!normalizedRecipeUnit) {
    return { amount: null, baseUnit: catalogUnit, estimated: false, reason: "Unit unavailable" };
  }

  if (!catalogUnit) {
    return { amount: null, baseUnit: null, estimated: false, reason: "Catalog unit is not supported" };
  }

  if (catalogUnit === "kg") {
    const weightConversions = {
      kg: numericQuantity,
      g: numericQuantity / 1000,
      lb: numericQuantity * 0.45359237,
      oz: numericQuantity * 0.0283495231,
    };

    if (weightConversions[normalizedRecipeUnit] !== undefined) {
      return {
        amount: weightConversions[normalizedRecipeUnit],
        baseUnit: "kg",
        estimated: false,
        reason: "",
      };
    }

    if (["piece", "clove", "thumb", "bunch"].includes(normalizedRecipeUnit)) {
      const pieceWeight = findPieceWeight(ingredient.name);

      if (pieceWeight) {
        return {
          amount: numericQuantity * pieceWeight,
          baseUnit: "kg",
          estimated: true,
          reason: "Uses an average piece weight",
        };
      }
    }

    return {
      amount: null,
      baseUnit: "kg",
      estimated: false,
      reason: "This recipe unit cannot be converted to kilograms",
    };
  }

  if (catalogUnit === "l") {
    const volumeConversions = {
      l: numericQuantity,
      ml: numericQuantity / 1000,
      cup: numericQuantity * 0.2365882365,
      quart: numericQuantity * 0.946352946,
      tbsp: numericQuantity * 0.0147867648,
      tsp: numericQuantity * 0.00492892159,
      oz: numericQuantity * 0.0295735296,
    };

    if (volumeConversions[normalizedRecipeUnit] !== undefined) {
      return {
        amount: volumeConversions[normalizedRecipeUnit],
        baseUnit: "l",
        estimated: false,
        reason: "",
      };
    }

    return {
      amount: null,
      baseUnit: "l",
      estimated: false,
      reason: "This recipe unit cannot be converted to liters",
    };
  }

  if (catalogUnit === "piece" && normalizedRecipeUnit === "piece") {
    return {
      amount: numericQuantity,
      baseUnit: "piece",
      estimated: false,
      reason: "",
    };
  }

  return {
    amount: null,
    baseUnit: catalogUnit,
    estimated: false,
    reason: "This recipe unit cannot be converted to the catalog unit",
  };
};

const getLatestPrice = (ingredient, source) => {
  const prices = (ingredient?.prices || [])
    .filter((price) =>
      (price.source || "DA Pricewatch") === source &&
      Number.isFinite(Number(price.avg_price)) &&
      Number.isFinite(new Date(price.date).getTime())
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return prices[0] || null;
};

const calculateRecipeCost = (links, source) => {
  const ingredients = (links || []).map((link) => {
    const ingredient = link.ingredient || {};
    const price = getLatestPrice(ingredient, source);
    const conversion = convertRecipeQuantity({
      quantity: link.quantity,
      recipeUnit: link.unit,
      ingredient,
    });
    const unitPrice = price ? Number(price.avg_price) : null;
    const cost =
      unitPrice !== null && conversion.amount !== null
        ? unitPrice * conversion.amount
        : null;

    return {
      ...link,
      ingredient,
      price,
      conversion,
      unitPrice,
      cost,
    };
  });

  const pricedIngredients = ingredients.filter((item) => item.cost !== null);
  const missingIngredients = ingredients.filter((item) => item.cost === null);

  return {
    ingredients,
    pricedIngredients,
    missingIngredients,
    total: pricedIngredients.reduce((sum, item) => sum + item.cost, 0),
  };
};

export {
  PRICE_SOURCES,
  calculateRecipeCost,
  convertRecipeQuantity,
  getLatestPrice,
  normalizeCatalogUnit,
  normalizeRecipeUnit,
};
