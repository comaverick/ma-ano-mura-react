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
  { value: "best", label: "Best available" },
  { value: "DA Pricewatch", label: "DA Pricewatch" },
  { value: "SM Supermarkets", label: "SM Supermarket" },
];

const PIECE_WEIGHTS_KG = [
  { names: ["garlic"], weight: 0.003 },
  { names: ["habichuelas", "string bean", "green bean", "sitao"], weight: 0.01 },
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

const normalizeIngredientText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[()[\],./-]/g, " ")
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

  if (
    catalogUnit === "piece" &&
    ["piece", "thumb", "clove", "bunch"].includes(normalizedRecipeUnit)
  ) {
    return {
      amount: numericQuantity,
      baseUnit: "piece",
      estimated: normalizedRecipeUnit !== "piece",
      reason: normalizedRecipeUnit === "piece" ? "" : "Uses the catalog piece price",
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
      (source === "best" || (price.source || "DA Pricewatch") === source) &&
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

const getSourceIngredientMatchScore = (sourceName, item) => {
  const sourceText = normalizeIngredientText(sourceName);
  const originalText = normalizeIngredientText(item.original_name);
  const ingredientText = normalizeIngredientText(item.ingredient?.name);

  if (!sourceText) {
    return 0;
  }

  if (sourceText === originalText || sourceText === ingredientText) {
    return 100;
  }

  if (
    (originalText && sourceText.includes(originalText)) ||
    (originalText && originalText.includes(sourceText))
  ) {
    return 85;
  }

  if (ingredientText && sourceText.includes(ingredientText)) {
    return 70;
  }

  const ingredientTokens = ingredientText
    .split(" ")
    .filter((token) => token.length > 2);
  const matchingTokens = ingredientTokens.filter((token) =>
    sourceText.split(" ").includes(token)
  );

  return ingredientTokens.length > 0 && matchingTokens.length === ingredientTokens.length
    ? 45
    : 0;
};

const buildRecipeIngredientRows = (sourceIngredients, costData) => {
  const linkedIngredients = costData?.ingredients || [];
  const rawIngredients = Array.isArray(sourceIngredients)
    ? sourceIngredients.filter(Boolean)
    : [];

  if (rawIngredients.length === 0) {
    return {
      rows: linkedIngredients.map((item) => ({
        ...item,
        isRawSource: false,
        displayStatus: item.cost !== null ? "priced" : "missing",
      })),
      hasRawIngredients: false,
      sourceCount: linkedIngredients.length,
      coveredSourceCount: costData?.pricedIngredients?.length || 0,
      missingSourceRows: costData?.missingIngredients || [],
    };
  }

  const usedLinkIds = new Set();
  const sourceRows = rawIngredients.map((rawName, index) => {
    const candidates = linkedIngredients
      .map((item) => ({
        item,
        score: getSourceIngredientMatchScore(rawName, item),
        used: usedLinkIds.has(item.id),
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) =>
        b.score - a.score || Number(a.used) - Number(b.used)
      );
    const match = candidates[0];

    if (!match || match.score < 40) {
      return {
        id: `raw-${index}`,
        rawName,
        isRawSource: true,
        displayStatus: "not-catalog",
        ingredient: { name: rawName, unit: null, prices: [] },
        cost: null,
        price: null,
        conversion: { estimated: false, reason: "Not yet in ingredient catalog" },
      };
    }

    usedLinkIds.add(match.item.id);
    const isCombined = match.used;

    return {
      ...match.item,
      id: `raw-${index}`,
      rawName,
      matchedIngredientName: match.item.ingredient.name,
      isRawSource: true,
      isCombined,
      displayStatus: isCombined
        ? "combined"
        : match.item.cost !== null
          ? "priced"
          : "missing",
      cost: isCombined ? null : match.item.cost,
    };
  });

  const extraLinkedRows = linkedIngredients
    .filter((item) => !usedLinkIds.has(item.id))
    .map((item) => ({
      ...item,
      isRawSource: false,
      displayStatus: item.cost !== null ? "priced" : "missing",
    }));
  const rows = [...sourceRows, ...extraLinkedRows];
  const missingSourceRows = sourceRows.filter(
    (item) => !["priced", "combined"].includes(item.displayStatus)
  );

  return {
    rows,
    hasRawIngredients: true,
    sourceCount: rawIngredients.length,
    coveredSourceCount: sourceRows.filter((item) =>
      ["priced", "combined"].includes(item.displayStatus)
    ).length,
    missingSourceRows,
  };
};

export {
  PRICE_SOURCES,
  buildRecipeIngredientRows,
  calculateRecipeCost,
  convertRecipeQuantity,
  getLatestPrice,
  normalizeIngredientText,
  normalizeCatalogUnit,
  normalizeRecipeUnit,
};
