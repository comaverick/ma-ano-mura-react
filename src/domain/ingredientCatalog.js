/* One vocabulary for recipe text, DA commodities, and supermarket products.
 * Cup/piece weights are cooking estimates, never scraped prices. Distinct foods
 * (e.g. coconut cream/milk, long beans/green beans) deliberately stay separate.
 */
const definitions = [
  ["Pork Chops", "Meat and Poultry", "kg", "pork chop|pork chops"],
  ["Beef Chuck", "Meat and Poultry", "kg", "beef chuck|chuck beef"],
  ["Beef Sirloin", "Meat and Poultry", "kg", "beef sirloin|sirloin beef"],
  ["Pork Blood", "Meat and Poultry", "l", "pig blood|pork blood|dugo ng baboy"],
  [
    "Salted Egg",
    "Meat and Poultry",
    "piece",
    "salted eggs|itlog na maalat|itlog na pula",
  ],
  [
    "Vegetable Broth",
    "Pantry",
    "l",
    "vegetable stock|vegetable broth",
    null,
    null,
    1.0,
  ],
  ["Bottle Gourd", "Vegetables", "kg", "upo|bottle gourd", 116],
  ["Kamias", "Fruits", "kg", "bilimbi|kamias"],
  [
    "Heavy Cream",
    "Pantry",
    "l",
    "heavy whipping cream|heavy cream|double cream",
    null,
    null,
    1.0,
  ],
  ["Corned Beef", "Pantry", "kg", "corned beef", 240],
  ["Honey", "Pantry", "kg", "honey", 340, null, 1.42],
  ["Hoisin Sauce", "Pantry", "l", "hoisin", null, null, 1.2],
  [
    "Hot Sauce",
    "Pantry",
    "l",
    "chili sauce|hot pepper sauce",
    null,
    null,
    1.05,
  ],
  ["Lechon Sauce", "Pantry", "l", "sarsa|litson sauce", null, null, 1.1],
  [
    "Liquid Seasoning",
    "Pantry",
    "l",
    "knorr liquid seasoning",
    null,
    null,
    1.1,
  ],
  ["Pickle Relish", "Pantry", "kg", "sweet pickle relish", 240],
  [
    "Chinese Sausage",
    "Meat and Poultry",
    "kg",
    "chinese sausage|lap cheong",
    150,
    50,
  ],
  [
    "Ground Chicken",
    "Meat and Poultry",
    "kg",
    "minced chicken|chicken ground",
    225,
  ],
  ["Beef Shank", "Meat and Poultry", "kg", "beef shanks|bulalo"],
  ["Leek", "Vegetables", "kg", "leeks", 89, 90],
  [
    "Jackfruit",
    "Vegetables",
    "kg",
    "unripe jackfruit|green langka|langka",
    151,
  ],
  ["Oregano", "Spices", "kg", "dried oregano", 48],
  ["Basil", "Spices", "kg", "fresh basil|basil leaves", 24, 50],
  ["Dried Basil", "Spices", "kg", "dried basil|basil leaves whole", 43],
  [
    "Five Spice Powder",
    "Spices",
    "kg",
    "chinese five spice powder|five spice",
    100,
  ],
  ["Dried Parsley", "Spices", "kg", "parsley flakes|dried parsley", 25],
  ["Dried Shrimp", "Fish", "kg", "hibe|dried shrimp", 100],
  ["Crab Meat", "Fish", "kg", "crabmeat|crab meat", 135],
  ["Lime", "Fruits", "kg", "lime juice|dayap", 240, 70],
  [
    "Rice Wine",
    "Pantry",
    "l",
    "chinese rice wine|shaoxing wine",
    null,
    null,
    1.0,
  ],
  ["Annatto Seeds", "Spices", "kg", "atsuete seeds|annatto seeds", 120],
  // name, category, base unit, recipe/product aliases, grams/cup, grams/piece, density g/ml
  [
    "Garlic",
    "Spices",
    "kg",
    "bawang|garlic imported|garlic native|garlic bawang",
    136,
    3,
  ],
  [
    "Ginger",
    "Spices",
    "kg",
    "luya|ginger luya|thumbs ginger|thumb size ginger",
    96,
    15,
  ],
  [
    "White Onion",
    "Spices",
    "kg",
    "onion|yellow onion|onion sibuya|onions|white onion imported",
    160,
    150,
  ],
  ["Red Onion", "Spices", "kg", "red onion imported", 160, 120],
  [
    "Green Onion",
    "Spices",
    "kg",
    "spring onion|scallion|green onions|onion leek",
    100,
    15,
  ],
  ["Shallot", "Spices", "kg", "shallots", 160, 25],
  [
    "Tomato",
    "Vegetables",
    "kg",
    "tomatoes|roma tomato|native tomato|plum tomato|tomatoes kamati",
    180,
    100,
  ],
  ["Carrots", "Vegetables", "kg", "carrot", 128, 80],
  [
    "White Potato",
    "Vegetables",
    "kg",
    "potato|potatoes|potatoes patata",
    150,
    150,
  ],
  [
    "Eggplant",
    "Vegetables",
    "kg",
    "talong|chinese eggplant|aubergine",
    82,
    200,
  ],
  [
    "Sitao",
    "Vegetables",
    "kg",
    "sitaw|string bean|long bean|yardlong bean|string beans|snake beans",
    100,
    10,
  ],
  [
    "Habichuelas (Baguio Bean)",
    "Vegetables",
    "kg",
    "baguio bean|green bean|french bean|habichuelas",
    100,
    5,
  ],
  ["Okra", "Vegetables", "kg", "lady finger|ladies fingers", 100, 12],
  ["Kangkong", "Vegetables", "kg", "water spinach|kangkong leaves", 30, 200],
  [
    "Pechay",
    "Vegetables",
    "kg",
    "pechay native|bok choy|baby bok choy|pak choi",
    70,
    200,
  ],
  [
    "Pechay (Baguio)",
    "Vegetables",
    "kg",
    "napa cabbage|chinese cabbage|wombok",
    76,
    700,
  ],
  [
    "Cabbage",
    "Vegetables",
    "kg",
    "cabbage rare ball|cabbage scorpio|cabbage wonder ball",
    89,
    750,
  ],
  ["Kalabasa", "Vegetables", "kg", "squash|kalabasa squash|pumpkin", 116, 1000],
  [
    "Bell Pepper",
    "Vegetables",
    "kg",
    "bell pepper green|bell pepper red|red bell pepper|green bell pepper|capsicum",
    149,
    150,
  ],
  ["Radish", "Vegetables", "kg", "labanos|daikon|white radish", 116, 200],
  ["Chayote", "Vegetables", "kg", "sayote", 132, 250],
  ["Ampalaya", "Vegetables", "kg", "bitter melon|bitter gourd", 94, 200],
  ["Spinach", "Vegetables", "kg", "baby spinach", 30, 200],
  [
    "Malunggay",
    "Vegetables",
    "kg",
    "moringa|malunggay leave|malunggay leaves",
    25,
    100,
  ],
  ["Green Pea", "Vegetables", "kg", "green peas|peas", 145],
  ["Snow Pea", "Vegetables", "kg", "snow peas|sitsaro|sugar snap peas", 98],
  ["Celery", "Vegetables", "kg", "celery stalk|stalk celery", 101, 40],
  ["Broccoli", "Vegetables", "kg", "broccoli florets", 91, 350],
  ["Cauliflower", "Vegetables", "kg", "cauliflower florets", 107, 600],
  ["Green Papaya", "Vegetables", "kg", "unripe papaya", 140, 700],
  ["Cucumber", "Vegetables", "kg", "pipino", 104, 200],
  ["Taro", "Vegetables", "kg", "gabi|taro root", 132, 150],
  ["Sweet Potato", "Vegetables", "kg", "kamote", 133, 150],
  [
    "Banana Blossom",
    "Vegetables",
    "kg",
    "banana heart|puso ng saging",
    120,
    500,
  ],
  [
    "Mustard Leaves",
    "Vegetables",
    "kg",
    "mustasa|mustard greens|mustard leave",
    56,
    150,
  ],
  [
    "Lemongrass",
    "Spices",
    "kg",
    "tanglad|stalks lemongrass|lemon grass",
    68,
    20,
  ],
  ["Cilantro", "Spices", "kg", "coriander leaves|wansoy", 16, 50],
  ["Parsley", "Spices", "kg", "fresh parsley", 60, 50],
  [
    "Laurel Leaves",
    "Spices",
    "kg",
    "bay leaf|bay leaves|bay leave|dried bay leave|dried bay leaf|dahon ng laurel|laurel",
    5,
    0.2,
  ],
  [
    "Black Pepper",
    "Spices",
    "kg",
    "pepper|peppercorn|pepper corn|whole peppercorn|black peppercorn|whole black peppercorn|black pepper paminta|ground black pepper",
    110,
  ],
  ["White Pepper", "Spices", "kg", "ground white pepper", 110],
  [
    "Chili (Red)",
    "Spices",
    "kg",
    "chili|chili pepper|red chili|thai chili|thai chili pepper|siling labuyo|labuyo|chily",
    45,
    5,
  ],
  [
    "Green Chili",
    "Spices",
    "kg",
    "finger chili|green finger chili|green chili pepper|long green pepper|long green chili|siling haba|green chily|long green chily|finger chilies|green chilies|siling pangsigang",
    75,
    15,
  ],
  ["Paprika", "Spices", "kg", "ground paprika", 108],
  [
    "Annatto Powder",
    "Spices",
    "kg",
    "anatto powder|atsuete powder|achuete powder|annatto",
    115,
  ],
  ["Garlic Powder", "Spices", "kg", "powder garlic", 155],
  ["Onion Powder", "Spices", "kg", "powder onion", 115],
  ["Curry Powder", "Spices", "kg", "curry", 100],
  ["Cumin", "Spices", "kg", "ground cumin", 100],
  ["Turmeric", "Spices", "kg", "luyang dilaw|turmeric powder", 150],
  ["Star Anise", "Spices", "kg", "star anis", 80, 1],
  [
    "Chili Flakes",
    "Spices",
    "kg",
    "chili flake|red pepper flake|chilli flakes|crushed red pepper",
    90,
  ],
  ["Chicken", "Meat and Poultry", "kg", "whole chicken|manok"],
  [
    "Chicken Breast",
    "Meat and Poultry",
    "kg",
    "breast chicken|chicken breast fillet",
  ],
  ["Chicken Thigh", "Meat and Poultry", "kg", "chicken thighs"],
  ["Chicken Wings", "Meat and Poultry", "kg", "chicken wing"],
  ["Chicken Liver", "Meat and Poultry", "kg", "liver chicken"],
  ["Pork", "Meat and Poultry", "kg", "pork meat"],
  [
    "Pork Belly (Liempo)",
    "Meat and Poultry",
    "kg",
    "pork belly|liempo|frozen liempo",
  ],
  [
    "Pork Ham (Kasim)",
    "Meat and Poultry",
    "kg",
    "pork shoulder|pork ham|kasim|frozen kasim",
  ],
  ["Pork Hock", "Meat and Poultry", "kg", "pork hocks|pata|pork knuckle"],
  [
    "Pork Ribs",
    "Meat and Poultry",
    "kg",
    "pork spare ribs|pork spareribs|baby back ribs",
  ],
  ["Pork Liver", "Meat and Poultry", "kg", "liver pork|pig liver"],
  [
    "Ground Pork",
    "Meat and Poultry",
    "kg",
    "pork ground|minced pork|pork mince",
    225,
  ],
  ["Beef", "Meat and Poultry", "kg", "beef meat"],
  ["Beef Brisket", "Meat and Poultry", "kg", "brisket"],
  ["Beef Rump", "Meat and Poultry", "kg", "rump"],
  [
    "Ground Beef",
    "Meat and Poultry",
    "kg",
    "beef ground|minced beef|beef mince",
    225,
  ],
  [
    "Chicken Egg",
    "Meat and Poultry",
    "piece",
    "egg|eggs|raw egg|hard boiled egg|chicken eggs",
  ],
  ["Hotdog", "Meat and Poultry", "kg", "hot dog|hotdogs|frankfurter", 140, 40],
  ["Bacon", "Meat and Poultry", "kg", "bacon strips", 100, 15],
  [
    "Chorizo",
    "Meat and Poultry",
    "kg",
    "chorizo de bilbao|chorizo bilbao",
    150,
    50,
  ],
  ["Ham", "Meat and Poultry", "kg", "cooked ham|sweet ham", 140, 25],
  ["Shrimp", "Fish", "kg", "prawn|prawns|hipon|shrimps", 140, 15],
  [
    "Bangus",
    "Fish",
    "kg",
    "bangus medium|bangus large|milkfish|bangus milkfish",
  ],
  ["Tilapia", "Fish", "kg", "tilapia fish"],
  ["Squid (Pusit Bisaya)", "Fish", "kg", "squid|pusit|calamari"],
  [
    "Galunggong",
    "Fish",
    "kg",
    "galunggong local|galunggong imported|round scad",
  ],
  ["Mussel", "Fish", "kg", "mussels|tahong"],
  ["Clam", "Fish", "kg", "clams|halaan"],
  ["Salmon", "Fish", "kg", "salmon fillet"],
  ["Salmon Head", "Fish", "kg", "salmon heads"],
  ["Tuna", "Fish", "kg", "yellow fin tuna tambakol|yellowfin tuna|tambakol"],
  ["Calamansi", "Fruits", "kg", "kalamansi|calamansi juice", 240, 15],
  ["Lemon", "Fruits", "kg", "lemon juice|lemons", 244, 100],
  ["Banana (Saba)", "Fruits", "kg", "saba|saba banana|plantain", 150, 100],
  [
    "Pineapple",
    "Fruits",
    "kg",
    "pineapple chunk|pineapple chunks|pinya",
    165,
    1000,
  ],
  ["Mango", "Fruits", "kg", "mango carabao|mangga", 165, 200],
  ["Raisin", "Pantry", "kg", "raisins", 150],
  [
    "Coconut Milk",
    "Pantry",
    "l",
    "gata|coconut milk unsweetened",
    null,
    null,
    1.01,
  ],
  ["Coconut Cream", "Pantry", "l", "kakang gata", null, null, 1.0],
  [
    "Milk",
    "Pantry",
    "l",
    "fresh milk|whole milk|full cream milk",
    null,
    null,
    1.03,
  ],
  ["Evaporated Milk", "Pantry", "l", "evap milk", null, null, 1.07],
  [
    "Condensed Milk",
    "Pantry",
    "l",
    "sweetened condensed milk",
    null,
    null,
    1.3,
  ],
  [
    "All Purpose Cream",
    "Pantry",
    "l",
    "all purpose creamer|table cream",
    null,
    null,
    1.0,
  ],
  ["Butter", "Pantry", "kg", "unsalted butter|salted butter", 227],
  ["Margarine", "Pantry", "kg", "margarin", 227],
  ["Cheddar Cheese", "Pantry", "kg", "cheddar|cheese", 113],
  ["Canola Oil", "Pantry", "l", "canola", null, null, 0.92],
  [
    "Vegetable Oil",
    "Pantry",
    "l",
    "cooking oil|oil|oil mantika|palm oil|palm cooking oil",
    null,
    null,
    0.92,
  ],
  ["Coconut Oil", "Pantry", "l", "cooking oil coconut", null, null, 0.92],
  ["Olive Oil", "Pantry", "l", "extra virgin olive oil", null, null, 0.91],
  ["Sesame Oil", "Pantry", "l", "sesame", null, null, 0.92],
  ["Soy Sauce", "Pantry", "l", "toyo|soy sauce soy sauce", null, null, 1.16],
  [
    "Vinegar",
    "Pantry",
    "l",
    "vinegar suka|white vinegar|cane vinegar|coconut vinegar|suka",
    null,
    null,
    1.01,
  ],
  [
    "Fish Sauce",
    "Pantry",
    "l",
    "patis|fish sauce fish sauce|patis fish sauce",
    null,
    null,
    1.2,
  ],
  ["Oyster Sauce", "Pantry", "l", "oyster flavored sauce", null, null, 1.2],
  ["Worcestershire Sauce", "Pantry", "l", "worcester sauce", null, null, 1.05],
  [
    "Banana Ketchup",
    "Pantry",
    "l",
    "banana catsup|catsup banana|ketchup banana",
    null,
    null,
    1.1,
  ],
  [
    "Tomato Ketchup",
    "Pantry",
    "l",
    "tomato catsup|catsup tomato",
    null,
    null,
    1.1,
  ],
  ["Mayonnaise", "Pantry", "l", "mayo", null, null, 0.94],
  ["Tomato Sauce", "Pantry", "kg", "sauce tomato", 245, null, 1.04],
  ["Tomato Paste", "Pantry", "kg", "paste tomato", 262, null, 1.1],
  [
    "Shrimp Paste",
    "Pantry",
    "l",
    "bagoong alamang|bagoong alamang shrimp paste|shrimp paste shrimp paste|bagoong",
    null,
    null,
    1.2,
  ],
  ["Liver Spread", "Pantry", "kg", "liver pate|liver spread paste", 240],
  ["Peanut Butter", "Pantry", "kg", "peanut spread", 258],
  ["Peanut", "Pantry", "kg", "peanuts|mani", 146],
  ["Pineapple Juice", "Pantry", "l", "juice pineapple", null, null, 1.04],
  ["Beef Broth", "Pantry", "l", "beef stock", null, null, 1.0],
  ["Chicken Broth", "Pantry", "l", "chicken stock", null, null, 1.0],
  ["Pork Broth", "Pantry", "l", "pork stock", null, null, 1.0],
  [
    "Beef Cubes",
    "Pantry",
    "kg",
    "beef cube|beef bouillon cube|beef bouillon cubes|beef powder|cubes beef",
    180,
    10,
  ],
  [
    "Chicken Cubes",
    "Pantry",
    "kg",
    "chicken cube|chicken bouillon cube|chicken bouillon cubes|cubes chicken",
    180,
    10,
  ],
  [
    "Pork Cubes",
    "Pantry",
    "kg",
    "pork cube|pork bouillon cube|cubes pork",
    180,
    10,
  ],
  [
    "Sinigang Mix",
    "Pantry",
    "kg",
    "sinigang sa sampaloc|sampalok mix|sinigang|magic sinigang",
    130,
  ],
  [
    "Maggi Magic Sarap",
    "Pantry",
    "kg",
    "magic sarap|all in one seasoning",
    150,
  ],
  [
    "Salt",
    "Pantry",
    "kg",
    "salt asin|asin|rock salt|sea salt|iodized salt",
    273,
  ],
  [
    "Sugar (Brown)",
    "Pantry",
    "kg",
    "brown sugar|brown sugar asukal na pula|muscovado",
    200,
  ],
  [
    "Sugar (Refined)",
    "Pantry",
    "kg",
    "white sugar|sugar|refined sugar|sugar washed",
    200,
  ],
  ["All Purpose Flour", "Pantry", "kg", "flour|all purpose flour", 125],
  ["Cornstarch", "Pantry", "kg", "corn starch", 128],
  ["Breadcrumbs", "Pantry", "kg", "bread crumb|breadcrumbs|panko", 108],
  ["Baking Powder", "Pantry", "kg", "baking powder", 192],
  ["Baking Soda", "Pantry", "kg", "bicarbonate of soda", 220],
  ["Corn", "Pantry", "kg", "corn kernel|sweet corn kernel|corn kernels", 164],
  ["Mushroom", "Pantry", "kg", "button mushroom|mushrooms|champignon", 70, 18],
  ["Tofu", "Pantry", "kg", "firm tofu|tokwa|tofu firm", 248, 200],
  ["Green Olive", "Pantry", "kg", "green olives|olives", 134],
  ["Black Bean", "Pantry", "kg", "black beans|tausi", 172],
  ["Miso", "Pantry", "kg", "miso paste|soybean paste", 275],
  ["Chicharon", "Pantry", "kg", "pork rind|pork rinds", 28],
  [
    "Lumpia Wrapper",
    "Pantry",
    "kg",
    "spring roll wrapper|lumpia wrappers",
    null,
    12,
  ],
  ["Rice Paper", "Pantry", "kg", "rice wrapper", null, 8],
  [
    "Bihon",
    "Pantry",
    "kg",
    "rice vermicelli|rice stick|rice noodle|rice noodles|pancit bihon",
    100,
  ],
  [
    "Sotanghon",
    "Pantry",
    "kg",
    "glass noodle|bean thread|sotanghon noodle|vermicelli",
    100,
  ],
  ["Spaghetti", "Pantry", "kg", "spaghetti noodle|spaghetti pasta", 100],
  [
    "Miki Noodle",
    "Pantry",
    "kg",
    "miki|miki noodle|fresh miki|egg noodle",
    160,
  ],
  ["Canton Noodle", "Pantry", "kg", "pancit canton|canton noodles", 100],
  ["Macaroni", "Pantry", "kg", "elbow macaroni|macaroni pasta", 100],
  [
    "Rice",
    "Rice",
    "kg",
    "white rice|bigas|uncooked rice|well milled rice",
    185,
  ],
  ["Glutinous Rice", "Rice", "kg", "sticky rice|malagkit|sweet rice", 185],
  [
    "Mungbean",
    "Vegetables",
    "kg",
    "mung bean|mung beans|mongo|monggo|munggo",
    202,
  ],
];

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/\bchilies\b/g, "chili")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const catalog = definitions.map(
  ([name, category, unit, aliases, cupGrams, pieceGrams, density]) => ({
    key: normalizeName(name),
    name,
    category,
    unit,
    aliases: [
      ...new Set([
        normalizeName(name),
        ...String(aliases || "")
          .split("|")
          .map(normalizeName),
      ]),
    ].filter(Boolean),
    cupGrams: cupGrams || null,
    pieceGrams: pieceGrams || null,
    density: density || null,
  }),
);
const byKey = new Map(catalog.map((item) => [item.key, item]));
const exactAliases = new Map();
for (const item of catalog)
  for (const alias of item.aliases)
    if (!exactAliases.has(alias)) exactAliases.set(alias, item);
const phraseAliases = [...exactAliases].sort(
  (a, b) => b[0].length - a[0].length,
);
const phrasePatterns = new Map();
function hasPhrase(text, phrase) {
  if (!phrasePatterns.has(phrase))
    phrasePatterns.set(
      phrase,
      new RegExp(
        `(?:^| )${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${phrase.endsWith("s") ? "" : "s?"}(?= |$)`,
      ),
    );
  return phrasePatterns.get(phrase).test(text);
}
function resolveIngredient(value) {
  const name = normalizeName(value)
    .replace(/\b(to taste|as needed|optional|for garnish|for serving)\b.*$/, "")
    .trim();
  if (
    !name ||
    /^(water|water tubig|ice|rice water|rice wash|salt and pepper)$/.test(name)
  )
    return null;
  if (exactAliases.has(name)) return exactAliases.get(name);
  // Do not silently replace specific cuts/preparations with a different food.
  const match = phraseAliases.find(([alias]) => hasPhrase(name, alias));
  if (!match) return null;
  const item = match[1];
  if (
    item.key === "chicken egg" &&
    /\b(quail|duck|salted|century|balut)\b/.test(name)
  )
    return null;
  if (
    ["beef", "pork", "chicken"].includes(item.key) &&
    /\b(corned|canned|jerky|tocino|tapa|sausage|hotdog|ham|bacon)\b/.test(name)
  )
    return null;
  if (
    item.key === "pork" &&
    /\b(hock|rib|liver|ear|blood|intestine|kidney|skin|ground|belly|shoulder|leg|fat|chop)s?\b/.test(
      name,
    )
  )
    return null;
  if (
    item.key === "beef" &&
    /\b(shank|rib|liver|tripe|tongue|oxtail|ground|tendon|chuck|sirloin|tenderloin|flank|round)s?\b/.test(
      name,
    )
  )
    return null;
  if (
    item.key === "chicken" &&
    /\b(breast|thigh|wing|liver|feet|skin|ground|gizzard|blood|powder|cube)s?\b/.test(
      name,
    )
  )
    return null;
  if (item.key === "shrimp" && /\b(shell|head|paste|dried|powder)\b/.test(name))
    return null;
  if (
    item.key === "milk" &&
    /\b(coconut|soy|oat|almond|powder|chocolate)\b/.test(name)
  )
    return null;
  if (
    item.key === "rice" &&
    /\b(flour|cooked|wine|vinegar|water|wash|paper|noodle|cake)\b/.test(name)
  )
    return null;
  return item;
}
function catalogForMarket(ingredient) {
  const name = normalizeName(ingredient.name);
  if (/^chicken egg/.test(name)) return byKey.get("chicken egg");
  if (/^commercial |^nfa$/.test(name)) return byKey.get("rice");
  if (/^cooking oil palm/.test(name)) return byKey.get("vegetable oil");
  if (/^cooking oil coconut/.test(name)) return byKey.get("coconut oil");
  return resolveIngredient(name);
}
export {
  catalog,
  byKey,
  normalizeName,
  hasPhrase,
  resolveIngredient,
  catalogForMarket,
};
const api = {
  catalog,
  byKey,
  normalizeName,
  hasPhrase,
  resolveIngredient,
  catalogForMarket,
};

export default api;
