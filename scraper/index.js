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
  const first = await collectCommodity(COMMODITIES[0], 0);
  const results = await mapLimit(
    COMMODITIES.slice(1),
    2,
    async (category, offset) => collectCommodity(category, offset + 1),
  );
  return [first, ...results].flat();
}
async function collectCommodity(category, index) {
  return withRetry(
    async () => {
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
          signal: AbortSignal.timeout(12000),
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
    },
    { attempts: 2 },
  );
}
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const client = getClient();
  const ingredients = await fetchAll(
    client,
    "ingredients",
    "id,name,unit,category",
  );
  let observations,
    official = null,
    primaryError = "";
  try {
    observations = await collectDA();
  } catch (error) {
    primaryError = error.message;
    console.warn(
      `Bantay Presyo unavailable (${primaryError}); checking the official DA daily report.`,
    );
    official = await require("./lib/daReports").collectOfficialReport();
    observations = official.observations;
  }
  const byName = new Map(
    ingredients.map((item) => [normalizeName(item.name), item]),
  );
  const date = official?.date || manilaDate();
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
  let rows = [...byId.values()].map(({ ingredient, total, count }) => ({
    ingredient_id: ingredient.id,
    location_id: LOCATION_ID,
    avg_price: Number((total / count).toFixed(2)),
    date,
    source: "DA Pricewatch",
  }));
  let quotes = [];
  if (official) {
    const matched = require("./lib/daReports").matchDailyReport(
      observations,
      ingredients,
      date,
    );
    rows = matched.rows;
    quotes = matched.quotes;
    unmatched.splice(0, unmatched.length, ...matched.unmatched);
  }
  let preservedHistorical = 0;
  if (date < manilaDate()) {
    const { data: existing, error } = await client
      .from("prices")
      .select("ingredient_id")
      .eq("date", date)
      .eq("location_id", LOCATION_ID);
    if (error) throw error;
    const ids = new Set(existing.map((row) => row.ingredient_id));
    const count = rows.length;
    rows = rows.filter((row) => !ids.has(row.ingredient_id));
    preservedHistorical = count - rows.length;
  }
  if (rows.length + preservedHistorical < 20)
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
        method: official?.method || "Bantay Presyo market table",
        reportUrl: official?.reportUrl || "http://www.bantaypresyo.da.gov.ph/",
        quotes,
        primaryError,
        failures: official?.failures || [],
        preservedHistorical,
      },
      null,
      2,
    ),
  );
  console.log(
    "DA update:",
    rows.length
      ? await writePrices(client, rows, { dryRun })
      : { inserted: 0, preservedHistorical },
  );
}
if (require.main === module)
  main().catch((error) => {
    const dir = path.join(
      process.env.SCRAPER_OUTPUT_DIR || __dirname,
      "reports",
    );
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "da-failure.json"),
      JSON.stringify(
        { observedAt: new Date().toISOString(), error: error.message },
        null,
        2,
      ),
    );
    console.error("DA update failed:", error.message);
    process.exitCode = 1;
  });
module.exports = { parseMarketNumber, parseDATable, collectDA };
