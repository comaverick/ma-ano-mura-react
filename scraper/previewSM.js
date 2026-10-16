const fs = require("fs");
const path = require("path");
const { getClient, fetchAll } = require("./lib/client");
const { prepareSMPrices } = require("./lib/smPipeline");
async function main() {
  const dir = process.env.SCRAPER_OUTPUT_DIR || __dirname;
  const ingredients = await fetchAll(
    getClient(),
    "ingredients",
    "id,name,unit,category",
  );
  const result = prepareSMPrices(
    JSON.parse(fs.readFileSync(path.join(dir, "sm-products.json"), "utf8")),
    ingredients,
    { requireFresh: false },
  );
  const out = path.join(dir, "reports");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(
    path.join(out, "sm-preview.json"),
    JSON.stringify(result.report, null, 2),
  );
  console.log(
    `Preview only: ${result.rows.length} ingredients; ${result.report.rejected.length} products need review. Historical files are never inserted as today's prices.`,
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
