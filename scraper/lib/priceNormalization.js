const { parseQuantity } = require("../../src/domain/recipeParser.js");
const { WEIGHTS } = require("../../src/domain/costing.js");
function parsePackage(name) {
  const text = String(name || "")
    .toLowerCase()
    .replace(/,/g, "");
  const number = "(?:\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d+(?:\\.\\d+)?)";
  // Use the minimum labelled weight for a conservative unit-price estimate.
  // Keep both bounds; never turn a midpoint into an exact observation.
  const range = text.match(
    new RegExp(
      `(${number})\\s*(kg|g|ml|l)?\\s*(?:[-–]|to)\\s*(${number})\\s*(kg|g|ml|l)\\b`,
    ),
  );
  if (range) {
    const unit = range[2] || range[4];
    if (range[2] && range[2] !== range[4])
      return { reason: "Mixed-unit variable package range" };
    const low = parseQuantity(range[1]),
      high = parseQuantity(range[3]);
    return low > 0 && high >= low
      ? {
          quantity: low,
          maxQuantity: high,
          unit,
          estimated: true,
          variable: true,
        }
      : { reason: "Invalid variable package weight" };
  }
  if (
    new RegExp(
      `${number}\\s*(?:kg|g|ml|l|oz)\\s*(?:[-–]|to)\\s*${number}`,
    ).test(text)
  )
    return { reason: "Unsupported variable package weight" };
  const match = text.match(
    new RegExp(
      `(?<![\\d/])(${number})\\s*(fl\\.?\\s*oz|kg|kilograms?|grams?|g|ml|liters?|litres?|l|ounces?|oz|lbs?|pounds?|gallons?)\\b`,
    ),
  );
  if (!match) {
    const count = text.match(/\b(\d+)\s*(?:pcs?|pieces?|eggs?)\b/);
    return count
      ? { quantity: +count[1], unit: "piece", estimated: false }
      : null;
  }
  let quantity = parseQuantity(match[1]);
  let unit = match[2].replace(/\s|\./g, "");
  const aliases = {
    kilogram: "kg",
    kilograms: "kg",
    gram: "g",
    grams: "g",
    liter: "l",
    liters: "l",
    litre: "l",
    litres: "l",
    ounce: "oz",
    ounces: "oz",
    pound: "lb",
    pounds: "lb",
    lbs: "lb",
    gallons: "gallon",
  };
  unit = aliases[unit] || unit;
  if (unit === "gallon") {
    quantity *= 3.785411784;
    unit = "l";
  }
  if (unit === "floz") {
    quantity *= 0.0295735296;
    unit = "l";
  }
  let estimated = false;
  const before = text.slice(0, match.index);
  const after = text.slice(match.index + match[0].length);
  const multiplierBefore = before.match(/\b(\d+)\s*[x×]\s*$/);
  const multiplierAfter = after.match(/^\s*[x×]\s*(\d+)\b/);
  if (multiplierBefore || multiplierAfter)
    quantity *= +(multiplierBefore || multiplierAfter)[1];
  else {
    const count = after.match(/^\s*(\d+)\s*(?:pcs?|sachets?|packs?)\b/);
    if (count && (unit === "g" || unit === "ml") && quantity <= 60) {
      quantity *= +count[1];
      estimated = true;
    }
  }
  return quantity > 0 ? { quantity, unit, estimated } : null;
}
function normalizeProductPrice(product, definition) {
  const price = Number(product.price);
  if (!Number.isFinite(price) || price <= 0)
    return { reason: "Invalid or zero price" };
  const pack = product.packageInfo || parsePackage(product.name);
  if (!pack || pack.reason)
    return { reason: pack?.reason || "Package size unavailable" };
  let baseAmount = null,
    estimated = !!pack.estimated;
  if (
    /broth$/.test(definition.key) &&
    ["kg", "g", "oz", "lb"].includes(pack.unit)
  )
    return {
      reason: "Dry broth cannot be treated as ready-to-use liquid stock",
    };
  if (definition.key === "bihon" && /140\s*oz/i.test(product.name))
    return {
      reason: "Suspicious package label: verify 140oz against the product page",
    };
  if (definition.unit === "kg" && WEIGHTS[pack.unit])
    baseAmount = pack.quantity * WEIGHTS[pack.unit];
  if (definition.unit === "l" && ["ml", "l"].includes(pack.unit))
    baseAmount = pack.quantity * (pack.unit === "ml" ? 0.001 : 1);
  if (definition.unit === "piece" && pack.unit === "piece")
    baseAmount = pack.quantity;
  // Weight- and volume-labelled sauces can share a catalog only with an explicit
  // ingredient-specific density; the audit records this approximation.
  if (!baseAmount && definition.density) {
    if (definition.unit === "l" && WEIGHTS[pack.unit]) {
      baseAmount = (pack.quantity * WEIGHTS[pack.unit]) / definition.density;
      estimated = true;
    }
    if (definition.unit === "kg" && ["ml", "l"].includes(pack.unit)) {
      baseAmount =
        pack.quantity * (pack.unit === "ml" ? 0.001 : 1) * definition.density;
      estimated = true;
    }
  }
  if (!baseAmount || baseAmount <= 0)
    return { reason: `Cannot convert ${pack.unit} to ${definition.unit}` };
  const unitPrice = price / baseAmount;
  if (!Number.isFinite(unitPrice) || unitPrice <= 0)
    return { reason: "Invalid normalized price" };
  return {
    unitPrice: Number(unitPrice.toFixed(4)),
    baseAmount,
    unit: definition.unit,
    package: pack,
    estimated,
    ...(pack.variable
      ? {
          variable: true,
          unitPriceLow: Number(
            (price / ((baseAmount * pack.maxQuantity) / pack.quantity)).toFixed(
              4,
            ),
          ),
          unitPriceHigh: Number(unitPrice.toFixed(4)),
          estimateReason: "Uses the minimum stated package weight",
        }
      : {}),
  };
}
module.exports = { parsePackage, normalizeProductPrice };
