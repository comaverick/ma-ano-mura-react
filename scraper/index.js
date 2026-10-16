const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const {
  getClient,
  fetchAll,
  writePrices,
  LOCATION_ID,
  manilaDate,
} = require("./lib/persistence");
const { withRetry, mapLimit } = require("./lib/client");
const { normalizeName } = require("../src/domain/ingredientCatalog.js");
const COMMODITIES = [
  "Rice",
  "Vegetables",
  "Vegetables",
  "Fish",
  "Fruits",
  "Vegetables",
  "Vegetables",
  "Meat and Poultry",
  "Spices",
  "Other Commodities",
];
function parseMarketNumber(value) {
  const text = String(value || "")
    .trim()
    .replace(/[₱,\s]/g, "")
    .replace(/^PHP/i, "");
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) && number > 0 ? number : null;
}
function parseDATable(html) {
  const $ = cheerio.load(`<table>${html}</table>`);
  const rows = [];
  $("tr").each((_, row) => {
    const cols = $(row).find("td");
    if (cols.length < 3) return;
    const name = $(cols[0]).text().trim();
    const specification = $(cols[1]).text().trim();
    const values = cols
      .slice(2)
      .map((_, col) => parseMarketNumber($(col).text()))
      .get()
      .filter((x) => x !== null);
    if (name && values.length)
      rows.push({
        name,
        specification,
        avg_price: Number(
          (values.reduce((a, b) => a + b, 0) / values.length).toFixed(4),
        ),
        markets: values.length,
      });
  });
  return rows;
}
async function collectDA() {
  const results = await mapLimit(COMMODITIES, 2, async (category, index) => {
    return withRetry(async () => {
      const response = await fetch(
        "http://www.bantaypresyo.da.gov.ph/tbl_price_get_comm_price.php",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "MaAnoMura ingredient price tracker",
          },
          body: new URLSearchParams({
            commodity: String(index + 1),
            region: "130000000",
            count: "31",
          }),
          signal: AbortSignal.timeout(30000),
        },
      );
      if (!response.ok)
        throw new Error(`DA ${category}: HTTP ${response.status}`);
      const rows = parseDATable(await response.text());
      if (!rows.length)
        throw new Error(
          `DA ${category}: no valid market rows; refusing to save an empty response`,
        );
      return rows.map((row) => ({ ...row, category }));
    });
  });
  return results.flat();
}
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const client = getClient();
  const ingredients = await fetchAll(
    client,
    "ingredients",
    "id,name,unit,category",
  );
  const observations = await collectDA();
  const byName = new Map(
    ingredients.map((item) => [normalizeName(item.name), item]),
  );
  const date = manilaDate();
  const unmatched = [];
  const byId = new Map();
  for (const observation of observations) {
    const ingredient = byName.get(normalizeName(observation.name));
    if (!ingredient) {
      unmatched.push(observation);
      continue;
    }
    const key = ingredient.id;
    const current = byId.get(key);
    if (current) {
      current.total += observation.avg_price * observation.markets;
      current.count += observation.markets;
    } else
      byId.set(key, {
        ingredient,
        total: observation.avg_price * observation.markets,
        count: observation.markets,
      });
  }
  const rows = [...byId.values()].map(({ ingredient, total, count }) => ({
    ingredient_id: ingredient.id,
    location_id: LOCATION_ID,
    avg_price: Number((total / count).toFixed(2)),
    date,
    source: "DA Pricewatch",
  }));
  if (rows.length < 20)
    throw new Error(
      `DA matched only ${rows.length} ingredients; update stopped to preserve previous data`,
    );
  const dir = path.join(process.env.SCRAPER_OUTPUT_DIR || __dirname, "reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "da.json"),
    JSON.stringify(
      {
        date,
        source: "DA Pricewatch",
        observedAt: new Date().toISOString(),
        observations,
        pricedIngredients: rows.length,
        unmatched,
      },
      null,
      2,
    ),
  );
  console.log("DA update:", await writePrices(client, rows, { dryRun }));
}
if (require.main === module)
  main().catch((error) => {
    console.error("DA update failed:", error.message);
    process.exitCode = 1;
  });
module.exports = { parseMarketNumber, parseDATable, collectDA };
