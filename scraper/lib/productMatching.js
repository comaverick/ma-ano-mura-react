const {
  catalog,
  normalizeName,
  hasPhrase,
} = require("../../src/domain/ingredientCatalog.js");
const rules = {
  "pork chops": {
    exclude: /marinated|breaded|seasoned|sauce|ready|cooked|tocino/,
  },
  "beef chuck": { exclude: /marinated|seasoned|sauce|ready|cooked|corned/ },
  "beef sirloin": { exclude: /marinated|seasoned|sauce|ready|cooked|tapa/ },
  "vegetable broth": { exclude: /cube|powder|bouillon|mix/ },
  "heavy cream": { exclude: /coconut|sauce|sweetened|non dairy|nondairy/ },
  "corned beef": {
    exclude: /chicken|pork|meat free|vegan|plant based|pasta|sauce|noodle/,
  },
  "salted egg": {
    exclude: /sauce|flavor|flavour|chip|pasta|spread|mayo|mix|powder|bread/,
  },
  honey: {
    exclude:
      /oat|quaker|banana|yuzu|sip plus|nectar|beverage|sauce|mustard|marinade|bbq|tea|drink|dressing|roasted/,
  },
  hotdog: { exclude: /bun|bread|sandwich/ },
  bacon: { exclude: /pasta|noodle|sauce|bread|bun/ },
  "all purpose flour": {
    exclude:
      /rice|corn|glutinous|cake|bread|self rising|self raising|selfraising|whole meal|wholemeal|pancake/,
  },
  "green olive": { exclude: /black|oil/ },
  "sesame oil": { exclude: /bun|bread|noodle|sauce|dressing/ },
  raisin: { exclude: /bread|loaf|panderosa|oat|cereal/ },
  "sinigang mix": {
    exclude: /salmon|fish|bangus|pork|beef|chicken|seafood|fresh|ready to cook/,
  },
  "curry powder": { exclude: /noodle|ramen|sauce|mix|soup/ },
  sotanghon: { exclude: /rice vermicelli|soup|instant|cup noodle/ },
  "canton noodle": {
    exclude: /instant|lucky me|payless|nissin|sauce|flavor|sweet|spicy/,
  },
  "shrimp paste": { exclude: /fish|boneless|balayan|dried/ },
  lemon: {
    exclude:
      /square|wattatops|juice|drink|tea|cake|cookie|chicken|tuna|sauce|flavor|dressing|mayo/,
  },
  garlic: { exclude: /powder|bread|sauce|dressing|fried|longg?ani|sausage/ },
  ginger: { exclude: /powder|tea|drink|sauce/ },
  "white onion": { exclude: /powder|red onion|bread|rings|mayo/ },
  "red onion": { exclude: /powder|bread|rings|mayo/ },
  tomato: { exclude: /sauce|paste|ketchup|catsup|juice|sardine|tuna/ },
  "bell pepper": { exclude: /powder|sauce|relish/ },

  calamansi: { exclude: /juice|drink|sauce|concentrate|flavor/ },
  pineapple: { exclude: /juice|drink|candy|cake|jam|flavor/ },
  peanut: { exclude: /butter|spread|oil|tikoy|stew|brittle/ },
  milk: {
    exclude:
      /powder|condensed|evaporated|soy|oat|coconut|almond|chocolate|tea|drink|candy/,
  },
  parsley: { exclude: /flakes|dried/ },
  basil: { exclude: /sauce|pesto/ },
  "chili red": { exclude: /sauce|flakes|powder|paste|sinigang|green/ },
  "green chili": { exclude: /sauce|flakes|powder|paste|sinigang/ },
  rice: {
    exclude:
      /glutinous|sticky|malagkit|flour|paper|noodle|cake|cracker|wine|vinegar|cereal|coffee|drink|rice bran/,
  },
  chicken: {
    exclude:
      /breast|thigh|wing|liver|feet|skin|ground|cube|powder|seasoning|broth|stock|nugget|hotdog|longg?ani|ham|sausage|balls|popcorn|fried|breaded|rtc|griller|tapa|tocino|torika|saucy/,
  },
  pork: {
    exclude:
      /belly|liempo|kasim|shoulder|hock|knuckle|rib|liver|ground|cube|powder|seasoning|broth|stock|tocino|tapa|sausage|ham|hotdog|longg?ani|siomai|meatball|nugget|bacon|chicharon|rind|ear|blood|intestine|skin/,
  },
  beef: {
    exclude:
      /ground|brisket|rump|shank|rib|cube|powder|seasoning|broth|stock|corned|tapa|sausage|hotdog|siomai|meatball|bulgogi|yakiniku|wagyu/,
  },
  shrimp: {
    exclude:
      /paste|dried|powder|cracker|tempura|breaded|sauce|flavor|ball|siomai/,
  },

  "chicken broth": { exclude: /cube|powder|bouillon|mix/ },
  "beef broth": { exclude: /cube|powder|bouillon|mix/ },
  "pork broth": { exclude: /cube|powder|bouillon|mix/ },

  butter: { exclude: /peanut|cookie|biscuit|bread|cake|popcorn|butter flavor/ },
  "coconut milk": { exclude: /powder|drink|shampoo|coconut cream/ },
  "coconut cream": { exclude: /powder|drink|coconut milk/ },
  "black pepper": { exclude: /sauce|steak|pork|beef|chicken|fish/ },
  salt: { exclude: /salted|salt and vinegar|salt pepper|bath|salted egg/ },
  "green pea": { exclude: /snack|cracker|wasabi|soup|split pea/ },
  corn: {
    exclude:
      /corned|cornstarch|corn starch|corn oil|corn syrup|corn flour|popcorn|snack|chip|soup/,
  },

  spaghetti: { exclude: /sauce|ready to eat|with meat/ },
  "cheddar cheese": {
    exclude: /spread|cheese sauce|cracker|bread|cake|hotdog|sausage/,
  },
  "tomato sauce": { exclude: /sardine|tuna|mackerel|pork|beef|meatball/ },
  vinegar: {
    exclude: /capers|pickle|anchovy|sardine|chip|cider|balsamic|rice vinegar/,
  },
};
const reverseAliases = {
  "garlic powder": ["powder garlic"],
  "onion powder": ["powder onion"],
  "chicken cubes": ["cubes chicken", "cube chicken"],
  "pork cubes": ["cubes pork", "cube pork"],
  "beef cubes": ["cubes beef", "cube beef"],
  "banana ketchup": ["catsup banana", "ketchup banana"],
  "black pepper": ["pepper black"],
  "coconut milk": ["milk coconut"],
  "coconut cream": ["cream coconut"],
  "vegetable oil": ["oil palm", "oil vegetable"],
  "canola oil": ["oil canola"],
  "sugar brown": ["sugar brown"],
  "sugar refined": ["sugar white", "white sugar", "sugar refined"],
};
const aliases = catalog
  .flatMap((definition) =>
    [...definition.aliases, ...(reverseAliases[definition.key] || [])]
      .filter(
        (alias) =>
          ![
            "oil",
            "pepper",
            "sugar",
            "cheese",
            "gata",
            "chili",
            "sinigang",
            "cream",
            "miki",
            "saba",
            "sesame",
            "bulalo",
            "gabi",
            "olives",
            "garlic imported",
            "garlic native",
          ].includes(alias),
      )
      .map((alias) => ({ alias, definition })),
  )
  .sort((a, b) => b.alias.length - a.alias.length);
const snack =
  /\b(ice cream|candy|candies|cookie|cookies|biscuit|biscuits|cracker|crackers|chips|chocolate|brownie|cake|shampoo|soap|dog food|cat food)\b/;
const rawCategories = new Set([
  "Vegetables",
  "Fruits",
  "Fish",
  "Meat and Poultry",
]);
function matchProduct(product) {
  const text = normalizeName(product.name);
  if (
    snack.test(text) ||
    /\b(dogfood|catfood|pedigree|whiskas|treatos|kojic|soap|lotion|shampoo|detergent|pet food|dog treat|cat treat)\b/.test(
      text,
    )
  )
    return null;
  const categories = [
    product.source_category,
    ...(product.categories || []),
  ].map(normalizeName);
  const inFreshAisle = categories.some((value) =>
    /^(fresh produce|fresh meat (?:and )?seafood|frozen goods|fruits|vegetables|frozen vegetables|frozen seafood|seafood|beef|pork|chicken)$/.test(
      value,
    ),
  );
  for (const { alias, definition } of aliases) {
    if (!hasPhrase(text, alias)) continue;
    const freshProduce =
      new Set(["Spices", "Vegetables", "Fruits"]).has(definition.category) &&
      !new Set([
        "mungbean",
        "green pea",
        "black pepper",
        "white pepper",
        "paprika",
        "annatto powder",
        "garlic powder",
        "onion powder",
        "curry powder",
        "cumin",
        "turmeric",
        "star anise",
        "chili flakes",
        "laurel leaves",
        "dried parsley",
        "oregano",
        "dried basil",
        "five spice powder",
        "annatto seeds",
      ]).has(definition.key);
    if (freshProduce && !inFreshAisle) continue;
    const inProduce = categories.some((value) =>
      /^(fresh produce|vegetables|frozen vegetables|fruits)$/.test(value),
    );
    if (
      freshProduce &&
      !inProduce &&
      !/\b(frozen|diced|chopped|florets|whole|cut)\b/.test(text)
    )
      continue;
    if (
      freshProduce &&
      /\b(ringers|french fries|sweet potato fries|shoe ?string|bratw|kimchi|seoul|ade)\b/.test(
        text,
      )
    )
      continue;
    if (
      freshProduce &&
      /\b(powder|ground|granules|flakes|dried|starch|flour|kimchi|pickled|juice|drink|sauce|dressing|marinade|spag|pasta|pstasce|salad|shots|hopia|noodle|noodles|ramen|lucky me|sam ?yang|marshmallow|kasalo)\b/.test(
        text,
      )
    )
      continue;
    if (
      freshProduce &&
      definition.category === "Spices" &&
      product.source_category === "Pantry"
    )
      continue;
    const rawProtein =
      definition.category === "Fish" ||
      (definition.category === "Meat and Poultry" &&
        ![
          "hotdog",
          "bacon",
          "chorizo",
          "ham",
          "chinese sausage",
          "chicken egg",
          "salted egg",
        ].includes(definition.key));
    if (rawProtein && !inFreshAisle) continue;
    if (
      ["tuna", "salmon", "bangus"].includes(definition.key) &&
      /\b(century|san marino|gold seas|spanish style|canned|in (?:natural |vegetable |olive )?oil|in brine|in water)\b/.test(
        text,
      )
    )
      continue;
    if (
      ["tuna", "salmon"].includes(definition.key) &&
      !/\b(raw|fresh|frozen|steak|loin|belly|strips?|cubes?)\b/.test(text)
    )
      continue;
    if (
      rawProtein &&
      /\b(franks?|frankfurter|ramyun|mami|supreme|spicy|snack|flakes?|chip|chips|kropek|caldereta|afritada|menudo|salpicao|adobo|mechado|hotpot|ready|garlic butter|breaded)\b/.test(
        text,
      )
    )
      continue;
    if (
      ["chicken", "beef", "pork"].includes(definition.key) &&
      !/\b(raw|whole|fillet|cuts?|steak|slice|strip|loin|meat)\b/.test(text)
    )
      continue;
    if (
      rawProtein &&
      /\b(nuggets?|balls?|breaded|tempura|spring rolls?|siomai|dumpling|gyoza|sausage|hotdogs?|ham|bacon|longg?ani[sz]a|tocino|tapa|patties|burger|marinated|bbq|barbecue|griller|rtc|corned|loaf|luncheon|pate|cooked|crispy|sisig|with|beans|rice|pasta|supreme|lucky me|sinigang)\b/.test(
        text,
      )
    )
      continue;
    if (
      rawProtein &&
      /\b(in oil|in brine|in tomato|smoked|fried|adobo|teriyaki)\b/.test(text)
    )
      continue;
    if (
      ["hotdog", "bacon", "ham", "chorizo", "chinese sausage"].includes(
        definition.key,
      ) &&
      /\b(pasta|noodle|ramyun|ramen|bread|bun|buns|roll|rolls|sandwich|sauce|soup)\b/.test(
        text,
      )
    )
      continue;
    if (
      definition.key === "chicken egg" &&
      /\b(quail|duck|salted|century|balut|noodle|mayo)\b/.test(text)
    )
      continue;
    if (
      definition.key === "chicken" &&
      /\b(neck|gizzard|isaw|cutlet|spicy)\b/.test(text)
    )
      continue;
    if (
      definition.key === "sinigang mix" &&
      !/\b(knorr|maggi|mama sita|seasoning|powder)\b/.test(text)
    )
      continue;
    if (rules[definition.key]?.exclude?.test(text)) continue;
    if (
      definition.category === "Spices" &&
      /\b(noodle|noodles|ramen|ramyun|soup|pasta|pstasce|marinade|dressing|salad|shots|sauce|flavor|flavour)\b/.test(
        text,
      )
    )
      continue;
    if (
      [
        "canola oil",
        "vegetable oil",
        "coconut oil",
        "olive oil",
        "sesame oil",
      ].includes(definition.key) &&
      /\b(stock|broth|dressing|sauce|noodle|pasta|bread|bun)\b/.test(text)
    )
      continue;
    if (
      definition.key === "honey" &&
      /\b(concentrate|calamansi|juice|lemon|with|drink)\b/.test(text)
    )
      continue;
    if (
      definition.key === "peanut" &&
      /\b(kisses|snack|coated|butter|biscuit|puff)\b/.test(text)
    )
      continue;
    if (
      definition.key === "peanut butter" &&
      /\b(creams|jelly|sandwich|biscuit|cookie)\b/.test(text)
    )
      continue;
    if (
      definition.key === "pineapple juice" &&
      (/\b(zesto|drink|cocktail|flavored|flavoured|concentrate)\b/.test(text) ||
        !/100|pure|unsweetened|dole|del monte/.test(text))
    )
      continue;
    if (definition.key === "chicken broth" && /vegan|style/.test(text))
      continue;
    if (definition.key === "maggi magic sarap" && !/magic sarap/.test(text))
      continue;
    if (
      rawCategories.has(definition.category) &&
      /\b(sauce|dressing|spread|juice|drink|seasoning|soup|noodle|noodles|pate|bread|pandesal|mayo|instant)\b/.test(
        text,
      )
    )
      continue;
    if (
      ["Spices", "Vegetables"].includes(definition.category) &&
      /\b(sausage|longg?anisa|chorizo|ham|beef|pork|chicken|steak)\b/.test(text)
    )
      continue;
    return definition;
  }
  return null;
}
module.exports = { matchProduct, rules };
