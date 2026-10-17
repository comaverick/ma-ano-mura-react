const fs = require("fs");
const path = require("path");
const { validPrice } = require("../../src/domain/costing.js");
const { manilaDate } = require("./persistence");
function evaluateQuality({
  report,
  prices,
  ingredients,
  baseline = null,
  now = new Date(),
  minCoverage = 70,
  maxDrop = 5,
  maxSourceAge = 2,
}) {
  const errors = [],
    warnings = [],
    changes = [];
  const date = manilaDate(now);
  const age = (day) =>
    (Date.parse(date) - Date.parse(String(day).slice(0, 10))) / 86400000;
  if (report.coveragePercent < minCoverage)
    errors.push(
      `Recipe coverage ${report.coveragePercent}% is below the ${minCoverage}% minimum.`,
    );
  let coverageChange = null;
  if (Number.isFinite(baseline?.coveragePercent)) {
    coverageChange = Number(
      (report.coveragePercent - baseline.coveragePercent).toFixed(2),
    );
    if (coverageChange < -maxDrop)
      errors.push(
        `Recipe coverage dropped ${Math.abs(coverageChange)} percentage points from ${baseline.coveragePercent}% to ${report.coveragePercent}%.`,
      );
  } else
    warnings.push(
      "No previous successful coverage baseline is available; this run establishes one if all checks pass.",
    );
  for (const [source, data] of Object.entries(report.sources)) {
    if (!data.latest || !data.ingredients)
      errors.push(`${source} has no usable quotes.`);
    else if (age(data.latest) > maxSourceAge)
      errors.push(
        `${source} has not produced a quote for ${Math.floor(age(data.latest))} days (latest ${data.latest}).`,
      );
    else if (age(data.latest) < 0)
      errors.push(
        `${source} contains future-dated observations (${data.latest}).`,
      );
  }
  const names = new Map(ingredients.map((item) => [item.id, item.name]));
  const grouped = new Map();
  const latestBySource = new Map();
  for (const price of prices) {
    if (!validPrice(price)) continue;
    const source = price.source || "DA Pricewatch";
    if (!latestBySource.has(source) || latestBySource.get(source) < price.date)
      latestBySource.set(source, price.date);
  }
  let invalid = 0;
  for (const price of prices) {
    if (!validPrice(price)) {
      if (!Number.isFinite(age(price.date)) || age(price.date) <= 7) invalid++;
      continue;
    }
    const key = `${price.ingredient_id}:${price.source || "DA Pricewatch"}`;
    const dates = grouped.get(key) || new Map();
    const current = dates.get(price.date);
    if (!current || Number(price.avg_price) < Number(current.avg_price))
      dates.set(price.date, price);
    grouped.set(key, dates);
  }
  if (invalid)
    errors.push(`${invalid} recent price rows have invalid amounts or dates.`);
  for (const dates of grouped.values()) {
    const [current, previous] = [...dates.values()].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
    if (
      !previous ||
      current.date !== latestBySource.get(current.source || "DA Pricewatch") ||
      age(current.date) > 2 ||
      Date.parse(current.date) - Date.parse(previous.date) > 14 * 86400000
    )
      continue;
    const ratio = Number(current.avg_price) / Number(previous.avg_price);
    if (
      (ratio >= 2 || ratio <= 0.5) &&
      Math.abs(Number(current.avg_price) - Number(previous.avg_price)) >= 20
    )
      changes.push({
        ingredient: names.get(current.ingredient_id) || current.ingredient_id,
        source: current.source || "DA Pricewatch",
        date: current.date,
        previousDate: previous.date,
        previous: Number(previous.avg_price),
        current: Number(current.avg_price),
        percent: Number(((ratio - 1) * 100).toFixed(1)),
      });
  }
  if (changes.length)
    errors.push(
      `${changes.length} ingredient/source quotes changed by at least 2× or fell by at least 50%; review source products and unit conversions.`,
    );
  return {
    date,
    passed: !errors.length,
    coverageChange,
    thresholds: {
      minCoverage,
      maxDrop,
      maxSourceAge,
      priceIncreaseRatio: 2,
      priceDecreaseRatio: 0.5,
      minAbsoluteChange: 20,
    },
    errors,
    warnings,
    changes,
  };
}
const safe = (value) =>
  String(value)
    .replace(/[\r\n|]/g, " ")
    .replace(/[%]/g, "%25");
function writeQualityReport(quality, report, dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "quality.json"),
    JSON.stringify(quality, null, 2),
  );
  const lines = [
    `## Daily price quality · ${quality.date}`,
    "",
    `**${quality.passed ? "Passed" : "Needs review"}** · ${report.coveragePercent}% recipe-row coverage · ${report.fullyPricedRecipes} complete recipes`,
    "",
    ...quality.errors.map((message) => `- ❌ ${message}`),
    ...quality.warnings.map((message) => `- ℹ️ ${message}`),
    "",
    "### Source freshness",
    "",
    "| Source | Ingredients | Latest quote |",
    "| --- | ---: | --- |",
    ...Object.entries(report.sources).map(
      ([source, data]) =>
        `| ${safe(source)} | ${data.ingredients} | ${data.latest || "None"} |`,
    ),
    "",
    "### Highest-impact coverage fixes",
    "",
    "| Ingredient | Issue | Recipes affected | Next action |",
    "| --- | --- | ---: | --- |",
    ...report.priorities
      .slice(0, 15)
      .map(
        (gap) =>
          `| ${safe(gap.name)} | ${gap.status} | ${gap.recipes} | ${gap.action} |`,
      ),
  ];
  if (quality.changes.length)
    lines.push(
      "",
      "### Unusual price changes",
      "",
      "| Ingredient | Source | Previous | Current | Change |",
      "| --- | --- | ---: | ---: | ---: |",
      ...quality.changes
        .slice(0, 30)
        .map(
          (change) =>
            `| ${safe(change.ingredient)} | ${safe(change.source)} | ${change.previous} | ${change.current} | ${change.percent}% |`,
        ),
    );
  lines.push(
    "",
    "Prices already saved are retained for review; this check does not delete or fabricate quotes. Daily source failures are also recorded in daily.json.",
    "",
  );
  const markdown = lines.join("\n");
  fs.writeFileSync(path.join(dir, "quality.md"), markdown);
  if (process.env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  for (const message of quality.errors)
    console.error(`::error::${safe(message)}`);
  for (const message of quality.warnings)
    console.warn(`::warning::${safe(message)}`);
  console.log(
    `Price quality: ${quality.passed ? "passed" : "needs review"}; ${quality.errors.length} errors, ${quality.changes.length} unusual changes.`,
  );
}
module.exports = { evaluateQuality, writeQualityReport };
