const fs = require("fs");
const path = require("path");
const {
  getClient,
  ensureCatalog,
  writePrices,
  ensureSMLocation,
} = require("./lib/persistence");
const { prepareSMPrices } = require("./lib/smPipeline");
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const client = getClient();
  await ensureSMLocation(client, { dryRun });
  const dir = process.env.SCRAPER_OUTPUT_DIR || __dirname;
  const { ingredients } = await ensureCatalog(client, { dryRun });
  const products = JSON.parse(
    fs.readFileSync(path.join(dir, "sm-products.json"), "utf8"),
  );
  const result = prepareSMPrices(products, ingredients);
  fs.mkdirSync(path.join(dir, "reports"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "reports/sm.json"),
    JSON.stringify(result.report, null, 2),
  );
  if (!result.rows.length)
    throw new Error(
      "No fresh normalized SM prices; previous records have been preserved.",
    );
  const saved = await writePrices(client, result.rows, { dryRun });
  console.log(
    JSON.stringify({ ...saved, pricedIngredients: result.rows.length }),
  );
}
if (require.main === module)
  main().catch((error) => {
    console.error("SM price update failed:", error.message);
    process.exitCode = 1;
  });
module.exports = { main };
