const fs = require("fs");
const path = require("path");
const {
  catalog,
  resolveIngredient,
} = require("../src/domain/ingredientCatalog.js");
const { parseIngredientText } = require("../src/domain/recipeParser.js");
const { withRetry, mapLimit, delay } = require("./lib/client");
const OUT = process.env.SCRAPER_OUTPUT_DIR || __dirname;
const ENDPOINT = "https://smmarkets.ph/graphql";
const PAGE_SIZE = 100;
async function graphql(
  query,
  variables = {},
  { timeoutMs = 30000, attempts = 3 } = {},
) {
  return withRetry(
    async () => {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "MaAnoMura ingredient price tracker",
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`SM HTTP ${response.status}`);
      const result = await response.json();
      if (result.errors?.length)
        throw new Error(result.errors.map((x) => x.message).join("; "));
      if (!result.data) throw new Error("SM returned no data");
      return result.data;
    },
    { attempts },
  );
}
const PRODUCT_FIELDS = `total_count page_info { total_pages current_page } items { categories { name } name sku url_key stock_status price_range { minimum_price { final_price { value currency } } } }`;
function toProduct(item, category, date) {
  const quote = item.price_range?.minimum_price?.final_price;
  if (
    item.stock_status !== "IN_STOCK" ||
    quote?.currency !== "PHP" ||
    !Number.isFinite(Number(quote.value)) ||
    Number(quote.value) <= 0
  )
    return null;
  return {
    name: item.name,
    price: Number(quote.value),
    url: `https://smmarkets.ph/${item.url_key}.html`,
    sku: item.sku,
    categories: (item.categories || []).map((c) => c.name),
    source_category: category,
    observed_at: date,
    source: "SM Supermarkets",
  };
}
async function collectProducts({
  maxPages = 100,
  searchLimit = 60,
  maxSearchPages = 3,
  budgetMs = 15 * 60 * 1000,
} = {}) {
  const startedAt = Date.now();
  const truncatedSearches = [];
  const observedAt = new Date().toISOString();
  const products = new Map();
  const failures = [];
  const tree = await graphql(
    "{ category(id: 2) { children { id name url_path } } }",
  );
  const categories = tree.category.children.filter((c) =>
    /^(Fresh Produce|Fresh Meat & Seafood|Frozen Goods|Ready to Cook|Chilled & Dairy Items|Bakery|International Goods|Pantry|Beverages?|Drinks)$/i.test(
      c.name,
    ),
  );
  if (!categories.some((c) => c.name === "Pantry"))
    throw new Error("SM food category discovery failed");
  async function collect(category) {
    const query = category.search
      ? `query($search:String!,$page:Int!){ products(search:$search,pageSize:${PAGE_SIZE},currentPage:$page){${PRODUCT_FIELDS}} }`
      : `query($id:String!,$page:Int!){products(filter:{category_id:{eq:$id}},pageSize:${PAGE_SIZE},currentPage:$page){${PRODUCT_FIELDS}}}`;
    let pages = 1;
    for (let page = 1; page <= pages; page++) {
      if (Date.now() - startedAt > budgetMs)
        throw new Error("Collection time budget reached");
      const data = await graphql(
        query,
        {
          ...(category.search
            ? { search: category.search }
            : { id: String(category.id) }),
          page,
        },
        category.search ? { timeoutMs: 20000, attempts: 2 } : undefined,
      );
      const totalPages = data.products.page_info.total_pages;
      pages = category.search
        ? Math.min(totalPages, maxSearchPages)
        : totalPages;
      if (category.search && page === 1 && totalPages > maxSearchPages)
        truncatedSearches.push({
          search: category.search,
          totalPages,
          scannedPages: maxSearchPages,
        });
      if (pages > maxPages)
        throw new Error(
          `SM ${category.name}: ${pages} pages exceed the safety limit; nothing truncated silently`,
        );
      for (const item of data.products.items) {
        const product = toProduct(item, category.name, observedAt);
        if (product && !products.has(product.sku || product.url))
          products.set(product.sku || product.url, product);
      }
      await delay(120);
    }
    console.log(
      `${category.name}: ${pages} page(s); ${products.size} products collected`,
    );
  }
  await mapLimit(categories, 3, async (category) => {
    try {
      await collect(category);
    } catch (error) {
      failures.push({ category: category.name, error: error.message });
    }
  });
  // Recipe-driven searches reach goods outside the old category list (juice,
  // herbs, noodles) without relaxing ingredient identity checks.
  const { matchProduct } = require("./lib/productMatching");
  const { normalizeProductPrice } = require("./lib/priceNormalization");
  const usableKey = (product) => {
    const definition = matchProduct(product);
    return definition && !normalizeProductPrice(product, definition).reason
      ? definition.key
      : null;
  };
  const matchedKeys = new Set(
    [...products.values()].map(usableKey).filter(Boolean),
  );
  const usage = new Map();
  for (const recipe of Object.values(require("../src/data/recipes.json")))
    for (const raw of recipe.ingredients) {
      const key = resolveIngredient(parseIngredientText(raw).name)?.key;
      if (key) usage.set(key, (usage.get(key) || 0) + 1);
    }
  const searches = catalog
    .filter((item) => !matchedKeys.has(item.key))
    .sort((a, b) => (usage.get(b.key) || 0) - (usage.get(a.key) || 0))
    .slice(0, searchLimit);
  await mapLimit(searches, 3, async (item) => {
    const targeted = {
      "green chili": ["siling haba", "chili green"],
      "green onion": ["spring onion", "green onion"],
      "ground pork": ["ground pork", "pork giniling"],
      lemongrass: ["tanglad", "lemon grass"],
    };
    for (const term of targeted[item.key] ||
      [...new Set([item.name, item.aliases[1]])].filter(Boolean).slice(0, 2)) {
      if (Date.now() - startedAt > budgetMs) {
        failures.push({
          category: item.name,
          error: "Collection time budget reached",
        });
        break;
      }
      try {
        await collect({ name: `Search: ${item.name}`, search: term });
        if (
          [...products.values()].some(
            (product) => usableKey(product) === item.key,
          )
        )
          break;
      } catch (error) {
        failures.push({
          category: item.name,
          search: term,
          error: error.message,
        });
      }
    }
  });
  if (failures.length)
    console.warn(
      "SM incomplete categories/searches:",
      JSON.stringify(failures),
    );
  if (failures.some((f) => categories.some((c) => c.name === f.category)))
    throw new Error(
      "SM category collection incomplete; refusing to replace the previous catalog",
    );
  if (products.size < 100)
    throw new Error(
      "SM returned too few products; refusing to publish this catalog",
    );
  return {
    products: [...products.values()],
    observedAt,
    failures,
    truncatedSearches,
    categories: categories.map((c) => c.name),
  };
}
async function main() {
  const result = await collectProducts();
  fs.mkdirSync(OUT, { recursive: true });
  const temp = path.join(OUT, "sm-products.json.tmp");
  fs.writeFileSync(temp, JSON.stringify(result.products, null, 2));
  fs.renameSync(temp, path.join(OUT, "sm-products.json"));
  fs.writeFileSync(
    path.join(OUT, "sm-collection-report.json"),
    JSON.stringify({ ...result, products: result.products.length }, null, 2),
  );
  console.log(
    `SM collection complete: ${result.products.length} in-stock PHP products.`,
  );
}
if (require.main === module)
  main().catch((error) => {
    console.error("SM collection failed:", error.message);
    process.exitCode = 1;
  });
module.exports = { graphql, toProduct, collectProducts };
