const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { manilaDate } = require("./lib/persistence");
function run(script, args = []) {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, script), ...args],
    { stdio: "inherit", env: process.env },
  );
  return result.status === 0;
}
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const args = dryRun ? ["--dry-run"] : [];
  const statuses = {
    date: manilaDate(),
    startedAt: new Date().toISOString(),
    dryRun,
  };
  // Source failures stay independent: a DA outage must not prevent SM updates.
  statuses.catalog = run("addRecipeIngredients.js", args);
  statuses.recipes = run("syncRecipes.js", args);
  statuses.links =
    dryRun || process.env.SUPABASE_SERVICE_ROLE_KEY
      ? statuses.catalog && statuses.recipes
        ? run("linkRecipeIngredients.js", args)
        : false
      : "skipped_without_server_key";
  if (statuses.links === "skipped_without_server_key")
    console.log(
      "Stored recipe-link backfill skipped: SUPABASE_SERVICE_ROLE_KEY is not configured. Browser costing still uses the full recipe text and shared catalog.",
    );
  statuses.da = run("index.js", args);
  statuses.smCollection = run("scrapeSM.js");
  statuses.sm = statuses.smCollection ? run("insertSMPrices.js", args) : false;
  const dir = path.join(process.env.SCRAPER_OUTPUT_DIR || __dirname, "reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "daily.json"),
    JSON.stringify(
      { ...statuses, finishedAt: new Date().toISOString() },
      null,
      2,
    ),
  );
  console.log("Daily pipeline:", statuses);
  if (
    ["catalog", "recipes", "links", "da", "smCollection", "sm"].some(
      (key) => statuses[key] === false,
    )
  )
    process.exitCode = 1;
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
