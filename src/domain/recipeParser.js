import { normalizeName } from "./ingredientCatalog.js";
const UNIT_ALIASES = {
  kg: "kg",
  kgs: "kg",
  kilo: "kg",
  kilos: "kg",
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
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  cup: "cup",
  cups: "cup",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tbsp: "tbsp",
  tbs: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tsp: "tsp",
  quart: "quart",
  quarts: "quart",
  piece: "piece",
  pieces: "piece",
  pc: "piece",
  pcs: "piece",
  clove: "clove",
  cloves: "clove",
  head: "head",
  heads: "head",
  bunch: "bunch",
  bunches: "bunch",
  thumb: "thumb",
  thumbs: "thumb",
  stalk: "stalk",
  stalks: "stalk",
  can: "can",
  cans: "can",
  pack: "pack",
  packs: "pack",
  package: "pack",
  packages: "pack",
};
const FRACTIONS = {
  "½": "1/2",
  "¼": "1/4",
  "¾": "3/4",
  "⅓": "1/3",
  "⅔": "2/3",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
};
function expandFractions(value) {
  return String(value || "")
    .replace(/(\d)([½¼¾⅓⅔⅛⅜⅝⅞])/g, "$1 $2")
    .replace(/[½¼¾⅓⅔⅛⅜⅝⅞]/g, (x) => FRACTIONS[x]);
}
function parseQuantity(value) {
  const text = expandFractions(value).trim();
  const mixed = text.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) return Number(mixed[3]) ? +mixed[1] + mixed[2] / mixed[3] : null;
  const fraction = text.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) return Number(fraction[2]) ? fraction[1] / fraction[2] : null;
  const n = Number(text);
  return text && Number.isFinite(n) && n >= 0 ? n : null;
}
const QUANTITY = "(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?|\\.\\d+)";
const UNIT = Object.keys(UNIT_ALIASES)
  .sort((a, b) => b.length - a.length)
  .join("|");
const MASS =
  "kilograms?|kilos?|kg|grams?|g|pounds?|lbs?|ounces?|oz|milliliters?|ml|liters?|l";
function cleanIngredientName(value) {
  return String(value || "")
    .replace(/\b(?:shell and head|head and shell) removed\b/gi, "")
    .replace(/\(note[^)]*\)/gi, "")
    .replace(/\s+/g, " ")
    .replace(
      /^(?:(?:fresh|finely|roughly|thinly|crushed|chopped|diced|sliced|cubed|peeled)\s+)+/i,
      "",
    )
    .replace(
      /\b(cleaned|washed|peeled|deveined|diced|cubed|sliced|chopped|crushed|julienned|wedged|quartered|halved|cut into|to taste|as needed|divided|for serving|optional)\b.*$/i,
      "",
    )
    .replace(/^\s*(?:fresh|medium|large|small)\s+/i, "")
    .replace(/[,;\s]+$/, "")
    .trim();
}
function parseIngredientText(text) {
  const original = String(text || "")
    .trim()
    .replace(/\s+/g, " ");
  let rest = expandFractions(original)
    .replace(/^optional:\s*/i, "")
    .replace(/table\s+spoons?/gi, "tablespoon")
    .replace(/tea\s+spoons?/gi, "teaspoon");
  let quantity = null,
    unit = null,
    estimated = false;
  let match = rest.match(
    new RegExp(`^(${QUANTITY})(?:\\s*(?:to|–|-)\\s*(${QUANTITY}))?\\s*`, "i"),
  );
  if (match) {
    quantity = parseQuantity(match[1]);
    if (match[2]) {
      quantity = (quantity + parseQuantity(match[2])) / 2;
      estimated = true;
    }
    rest = rest.slice(match[0].length);
  }
  if (quantity !== null) {
    const parenthetical = rest.match(
      new RegExp(
        `^\\(\\s*(?:about\\s+)?(${QUANTITY})(?:\\s*(?:to|–|-)\\s*(${QUANTITY}))?\\s*(${MASS})(?:\\s+each)?\\s*\\)\\s*`,
        "i",
      ),
    );
    if (parenthetical) {
      const low = parseQuantity(parenthetical[1]);
      const high = parenthetical[2] ? parseQuantity(parenthetical[2]) : low;
      quantity *= (low + high) / 2;
      unit = UNIT_ALIASES[parenthetical[3].toLowerCase()];
      estimated = estimated || !!parenthetical[2];
      rest = rest.slice(parenthetical[0].length);
      return {
        original,
        quantity,
        unit,
        name: cleanIngredientName(rest),
        estimated,
        toTaste: /\b(to taste|as needed)\b/i.test(original),
        optional: /\boptional\b/i.test(original),
        isWater: false,
      };
    }
    // Explicit package weights: 2 (400g) cans, 1 8 oz. can, 2 packs (20g each).
    const front = rest.match(
      new RegExp(
        `^\\(?\\s*(${QUANTITY})\\s*-?\\s*(${MASS})\\.?(?:\\s*(?:each|pack))?\\s*\\)?\\s*(?:cans?|packs?|packages?|pieces?|pc)?\\.?\\s*`,
        "i",
      ),
    );
    if (front) {
      quantity *= parseQuantity(front[1]);
      unit = UNIT_ALIASES[front[2].toLowerCase()];
      rest = rest.slice(front[0].length);
    } else {
      const unitMatch = rest.match(
        new RegExp(`^(${UNIT})(?=\\s|\\.|$)\\.?\\s*`, "i"),
      );
      if (unitMatch) {
        unit = UNIT_ALIASES[unitMatch[1].toLowerCase()];
        rest = rest.slice(unitMatch[0].length);
      } else unit = "piece";
      if (["can", "pack"].includes(unit)) {
        const size = rest.match(
          new RegExp(
            `(?:^|\\s|\\()(${QUANTITY})\\s*-?\\s*(${MASS})(?=\\b|\\.)`,
            "i",
          ),
        );
        if (size) {
          quantity *= parseQuantity(size[1]);
          unit = UNIT_ALIASES[size[2].toLowerCase()];
          rest = rest.replace(size[0], " ");
        }
      }
    }
  }
  return {
    original,
    quantity,
    unit,
    name: cleanIngredientName(rest),
    estimated,
    toTaste: /\b(to taste|as needed)\b/i.test(original),
    optional: /\boptional\b/i.test(original),
    isWater:
      /^(?:(?:of|hot|cold|warm|boiling) )?(?:water|water tubig|tubig water|ice|rice water|rice wash)(?:\s|$)/.test(
        normalizeName(cleanIngredientName(rest)),
      ),
  };
}
const normalizeUnit = (value) =>
  UNIT_ALIASES[String(value || "").toLowerCase()] || null;
export {
  UNIT_ALIASES,
  normalizeUnit,
  parseQuantity,
  parseIngredientText,
  cleanIngredientName,
};
const api = {
  UNIT_ALIASES,
  normalizeUnit,
  parseQuantity,
  parseIngredientText,
  cleanIngredientName,
};

export default api;
