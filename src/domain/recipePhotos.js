import catalog from "../data/recipePhotos.json";
import { normalizeName } from "./ingredientCatalog.js";
import { recipeTraits } from "./preferences.js";

// Match the dish and its main protein, never a broad category or a price match.
// These are credited serving suggestions, not photographs of each recipe variant.
const rules = [
  [
    "garlic-shrimp",
    /\b(?:garlic|butter).*(?:shrimp|hipon)\b|\b(?:shrimp|hipon).*(?:garlic|butter)\b/,
    "seafood",
  ],
  ["salmon-curry", /\bcurry.*salmon\b|\bsalmon.*curry\b/, "seafood"],
  [
    "corned-beef",
    /\bcorned beef(?: stew| guisado)?$|\bginisang corned beef\b/,
    "beef",
  ],
  [
    "bok-choy",
    /\bbok choy.*(?:guisado|stir fry)\b|\b(?:guisado|stir fried).*bok choy\b/,
  ],
  ["ampalaya", /\bginisang ampalaya\b/, "eggs"],
  ["bangus-bistek", /\bbangus.*bistek\b|\bbistek.*bangus\b/, "seafood"],
  ["mixed-adobo", /\b(?:adobo|adobong)\b/, ["chicken", "pork"]],
  ["tofu-sisig", /\b(?:tofu|tokwa).*sisig|\bsisig.*(?:tofu|tokwa)\b/, "tofu"],
  ["chicken-adobo", /\b(?:adobo|adobong)\b/, "chicken"],
  ["pork-adobo", /\b(?:adobo|adobong)\b/, "pork"],
  ["pork-sinigang", /\bsinigang\b/, "pork"],
  ["tinola", /\btinola(?:ng)?\b/, "chicken"],
  ["chicken-afritada", /\bafritada\b/, "chicken"],
  ["chicken-curry", /\bcurry\b/, "chicken"],
  ["pininyahang-manok", /\bpininyahan?g?\b/, "chicken"],
  ["inasal", /\binasal\b/, "chicken"],
  ["fried-chicken", /\bfried chicken\b|\bchicken.*(?:fried|fry)\b/, "chicken"],
  ["arroz-caldo", /\barroz caldo\b/, "chicken"],
  ["sopas", /\bsopas\b/, "chicken"],
  ["kare-kare", /\bkare kare\b/, "beef"],
  ["kaldereta", /\b(?:kaldereta|caldereta)\b/, "beef"],
  ["mechado", /\bmechado\b/, "beef"],
  ["bistek", /\bbistek\b|\bbeef steak\b/, "beef"],
  ["bulalo", /\bbulalo\b/, "beef"],
  ["nilaga", /\bnilaga(?:ng)?\b/, "beef"],
  ["bicol-express", /\bbicol express\b/, "pork"],
  ["pork-sisig", /\bsisig\b/, "pork"],
  ["dinuguan", /\bdinuguan\b/, "pork"],
  ["menudo", /\bmenudo\b/, "pork"],
  ["lechon-kawali", /\blechon kawali\b|\bcrispy pork belly\b/, "pork"],
  ["crispy-pata", /\bcrispy pata\b/, "pork"],
  ["pork-barbecue", /\b(?:pork|baboy).*(?:barbecue|barbeque|bbq)\b/, "pork"],
  ["bangus", /\bdaing na bangus\b/, "seafood"],
  [
    "fried-tilapia",
    /\b(?:fried|pritong).*tilapia\b|\btilapia.*fried\b/,
    "seafood",
  ],
  ["ukoy", /\b(?:ukoy|okoy)\b/, "seafood"],
  ["ginataang-kalabasa", /\bginataang kalabasa\b/, "seafood"],
  ["pork-ginataang-kalabasa", /\bginataang kalabasa\b/, "pork"],
  ["tortang-talong", /\btortang talong\b/, "eggs"],
  ["monggo", /\b(?:ginisang )?(?:monggo|munggo)\b/],
  ["laing", /\blaing\b/],
  ["pinakbet", /\bpinakbet\b/, "pork"],
  ["sinangag", /\bsinangag\b|\bgarlic fried rice\b/],
  ["pancit-bihon", /\b(?:pancit|pansit).*bihon\b/],
  ["pancit-canton", /\b(?:pancit|pansit).*canton\b/],
  ["palabok", /\bpalabok\b/],
  ["spaghetti", /\b(?:filipino|pinoy).*spaghetti\b/],
  ["lumpia", /\blumpia(?:ng)? shanghai\b/, "pork"],
  ["turon", /\bturon\b/],
  ["biko", /\bbiko\b/],
  ["champorado", /\bchamporado\b/],
  ["kutsinta", /\bkutsinta\b/],
  ["maja-blanca", /\bmaja blanca\b/],
  ["palitaw", /\bpalitaw\b/],
  ["suman", /\bsuman\b/],
  ["ube-halaya", /\bube halaya\b/],
  ["pandesal", /\bpan ?de ?sal\b/],
  ["bibingka", /\bbibingka\b/],
  ["puto", /\bputo(?: cheese| recipe)?$/],
  ["leche-flan", /\bleche flan\b/],
  ["ensaymada", /\bensaymada\b/],
];

const cache = new WeakMap();
function getRecipePhoto(recipe) {
  if (!recipe || typeof recipe !== "object") return null;
  if (cache.has(recipe)) return cache.get(recipe);
  const name = normalizeName(recipe.name || "")
    .replace(/\brecipe\b/g, "")
    .trim();
  const proteins = recipeTraits(recipe).proteins;
  // A bowl of adobo is misleading on an adobo sandwich or a plate of fried rice.
  const transformed =
    /\b(?:burrito|sandwich|pizza|pasta|pate|spread|flakes|meatballs|pulled|slab|tacos?)\b/.test(
      name,
    ) ||
    (/\brice\b/.test(name) && /\badobo(?:ng)?\b/.test(name));
  const differentCut =
    /\b(?:adobo|adobong|bistek)\b/.test(name) &&
    /\b(?:atay|liver|gizzards?|balunbalunan|intestines?|isaw|feet|hearts?|tenga|ears?)\b/.test(
      name,
    );
  const match =
    !transformed &&
    !differentCut &&
    rules.find(
      ([id, pattern, protein]) =>
        catalog[id] &&
        pattern.test(name) &&
        (!protein ||
          (Array.isArray(protein)
            ? protein.every((item) => proteins.includes(item))
            : proteins.includes(protein))),
    );
  const photo = match ? { id: match[0], ...catalog[match[0]] } : null;
  cache.set(recipe, photo);
  return photo;
}

function photoUrl(photo, width = 480) {
  return `${process.env.PUBLIC_URL || ""}/food-photos/${photo.id}-${width}.webp`;
}

export { getRecipePhoto, photoUrl };
