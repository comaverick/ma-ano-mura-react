const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const cheerio = require("cheerio");
const { withRetry } = require("./client");
const {
  resolveIngredient,
  normalizeName,
} = require("../../src/domain/ingredientCatalog.js");
const { targetIngredient, LOCATION_ID, manilaDate } = require("./persistence");
const INDEX = "https://www.da.gov.ph/wp-json/wp/v2/pages?slug=price-monitoring";
function discoverReports(html, today = manilaDate()) {
  const $ = cheerio.load(html);
  const rows = [];
  $("a[href]").each((_, element) => {
    const title = $(element).text().trim();
    const url = $(element).attr("href");
    if (
      !/^[A-Z][a-z]+ \d{1,2}, \d{4}$/.test(title) ||
      !/Daily-Price-Index|DPI-AFC/i.test(url)
    )
      return;
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return;
    }
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== "www.da.gov.ph" ||
      !parsed.pathname.startsWith("/wp-content/uploads/") ||
      !parsed.pathname.endsWith(".pdf")
    )
      return;
    const timestamp = Date.parse(title + " 00:00:00 GMT");
    if (!Number.isFinite(timestamp)) return;
    const date = new Date(timestamp).toISOString().slice(0, 10);
    const age = (Date.parse(today) - timestamp) / 86400000;
    if (age >= 0 && age <= 2) rows.push({ date, url, title });
  });
  return [...new Map(rows.map((row) => [row.url, row])).values()].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
}
function parseDailyReport(text, expectedDate) {
  if (
    !/DAILY PRICE INDEX/i.test(text) ||
    !/National Capital Region\s*\(NCR\)/i.test(text)
  )
    throw new Error("DA PDF is not an NCR daily price index");
  const found = text.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})/,
  );
  const date = found
    ? new Date(`${found[1]} ${found[2]}, ${found[3]} 00:00:00 GMT`)
        .toISOString()
        .slice(0, 10)
    : null;
  if (date !== expectedDate)
    throw new Error("DA PDF date does not match its published link");
  const observations = [];
  let last = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\f/g, "");
    if (/^\s*Note\(s\)/i.test(line)) break;
    const match = line.match(/^(.*?)\s{2,}([\d,]+\.\d{2}|n\/a)\s*$/i);
    if (match) {
      const cells = match[1].trim().split(/\s{2,}/);
      const leading = (match[1].match(/^\s*/) || [""])[0].length;
      last = {
        name: leading >= 20 ? "" : cells[0],
        specification:
          leading >= 20 ? cells.join(" ") : cells.slice(1).join(" "),
        avg_price:
          match[2].toLowerCase() === "n/a"
            ? null
            : Number(match[2].replace(/,/g, "")),
        markets: 1,
        date,
      };
      observations.push(last);
    } else if (last && /^\s{0,5}(Local|Imported|Brand\))\s*$/.test(line)) {
      last.name += " " + line.trim();
    } else if (
      last &&
      !last.name &&
      /^\s{0,5}[A-Z][a-zA-Z ,()/-]+$/.test(line) &&
      !/PREVAILING|COMMODITY|SPECIFICATION|PRICE|UNIT/.test(line)
    ) {
      last.name = line.trim();
    }
  }
  const valid = observations.filter((row) => row.name && row.avg_price > 0);
  if (valid.length < 20)
    throw new Error(`DA PDF yielded only ${valid.length} price rows`);
  return { date, observations: valid };
}
function matchDailyReport(observations, ingredients, date) {
  const selected = new Map();
  const unmatched = [];
  for (const observation of observations) {
    const name = normalizeName(observation.name);
    const oil = /^cooking oil/.test(name);
    let definition = oil
      ? /palm/.test(name)
        ? resolveIngredient("vegetable oil")
        : /coconut/.test(name)
          ? resolveIngredient("coconut oil")
          : null
      : resolveIngredient(name);
    if (/^(?:well milled|regular milled|premium)$/.test(name))
      definition = resolveIngredient("rice");
    if (
      !definition ||
      ["beef", "pork"].includes(definition.key) ||
      /^corn (?:white|yellow|grits|cracked)/.test(name) ||
      (definition.key === "chicken" && !/^whole chicken/.test(name)) ||
      (definition.key === "chicken egg" && !/\blarge\b/.test(name)) ||
      definition.key === "salmon" ||
      (definition.key === "squid pusit bisaya" && !/pusit bisaya/.test(name)) ||
      (oil && !/^1\s*liter\b/i.test(observation.specification))
    ) {
      unmatched.push(observation);
      continue;
    }
    const ingredient = targetIngredient(ingredients, definition);
    if (!ingredient) {
      unmatched.push(observation);
      continue;
    }
    const prior = selected.get(ingredient.id);
    if (!prior || observation.avg_price < prior.observation.avg_price)
      selected.set(ingredient.id, { ingredient, definition, observation });
  }
  return {
    rows: [...selected.values()].map(({ ingredient, observation }) => ({
      ingredient_id: ingredient.id,
      location_id: LOCATION_ID,
      avg_price: Number(observation.avg_price.toFixed(2)),
      source: "DA Pricewatch",
      date,
    })),
    quotes: [...selected.values()].map(
      ({ ingredient, definition, observation }) => ({
        ingredient: ingredient.name,
        ingredientId: ingredient.id,
        ingredientKey: definition.key,
        commodity: observation.name,
        specification: observation.specification,
        unit: definition.unit,
        avgPrice: observation.avg_price,
        date,
      }),
    ),
    unmatched,
  };
}
async function collectOfficialReport({
  today = manilaDate(),
  outputDir = process.env.SCRAPER_OUTPUT_DIR || path.resolve(__dirname, ".."),
  request = fetch,
} = {}) {
  const response = await withRetry(
    async () => {
      const result = await request(INDEX, {
        signal: AbortSignal.timeout(25000),
      });
      if (!result.ok) throw new Error(`DA report index HTTP ${result.status}`);
      return result;
    },
    { attempts: 2 },
  );
  const pages = await response.json();
  const links = discoverReports(pages[0]?.content?.rendered || "", today);
  if (!links.length)
    throw new Error(
      "No official DA daily report within two Manila calendar days",
    );
  const failures = [];
  for (const link of links.slice(0, 3)) {
    try {
      const result = await withRetry(
        async () => {
          const response = await request(link.url, {
            signal: AbortSignal.timeout(20000),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response;
        },
        { attempts: 2, delayMs: 500 },
      );
      const bytes = Buffer.from(await result.arrayBuffer());
      if (
        bytes.length > 10000000 ||
        bytes.subarray(0, 5).toString() !== "%PDF-"
      )
        throw new Error("Invalid DA PDF response");
      const dir = path.join(outputDir, "reports");
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `da-${link.date}.pdf`);
      fs.writeFileSync(file, bytes);
      const converted = spawnSync("pdftotext", ["-layout", file, "-"], {
        encoding: "utf8",
        timeout: 30000,
        maxBuffer: 4000000,
      });
      if (converted.status !== 0)
        throw new Error("DA PDF extraction requires pdftotext (poppler-utils)");
      const parsed = parseDailyReport(converted.stdout, link.date);
      fs.writeFileSync(path.join(dir, `da-${link.date}.txt`), converted.stdout);
      return {
        ...parsed,
        method: "DA Daily Price Index",
        reportUrl: link.url,
        indexUrl: INDEX,
        failures,
      };
    } catch (error) {
      failures.push({ url: link.url, date: link.date, error: error.message });
    }
  }
  throw new Error(
    `Official DA reports unavailable: ${failures.map((item) => `${item.date} ${item.error}`).join("; ")}`,
  );
}
module.exports = {
  discoverReports,
  parseDailyReport,
  matchDailyReport,
  collectOfficialReport,
};
