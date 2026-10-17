const fs = require("fs");
const path = require("path");
const { getClient, fetchAll } = require("./lib/client");
const { makeSnapshot } = require("./lib/marketSnapshot");
async function main() {
  const dir = process.env.SCRAPER_OUTPUT_DIR || __dirname;
  const client = getClient();
  const [ingredients, prices] = await Promise.all([
    fetchAll(client, "ingredients", "id,name,unit,category"),
    fetchAll(
      client,
      "prices",
      "id,ingredient_id,avg_price,date,source,location_id",
    ),
  ]);
  const read = (file, fallback) =>
    fs.existsSync(path.join(dir, file))
      ? JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"))
      : fallback;
  const daily = read("reports/daily.json", {});
  const snapshot = makeSnapshot({
    ingredients,
    prices,
    products: read("sm-products.json", []),
    daily,
    reports: {
      da: read("reports/da.json", null),
      sm: read("reports/sm.json", null),
      daFailure: read("reports/da-failure.json", null),
    },
  });
  fs.mkdirSync(path.join(dir, "public"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "public/market.json"),
    JSON.stringify(snapshot),
  );
  console.log(
    `Market snapshot: ${snapshot.offers.length} verified package offers. Source statuses: ${snapshot.sources.map((item) => `${item.source}: ${item.collection}`).join(", ")}.`,
  );
}
if (require.main === module)
  main().catch((error) => {
    console.error("Market snapshot failed:", error.message);
    process.exitCode = 1;
  });
module.exports = { main };
