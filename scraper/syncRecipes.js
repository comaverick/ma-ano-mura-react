const { getClient, fetchAll } = require("./lib/client");
const { normalizeName } = require("../src/domain/ingredientCatalog.js");
const source = Object.values(require("../src/data/recipes.json"));
async function main() {
  const client = getClient();
  const dryRun = process.argv.includes("--dry-run");
  const current = await fetchAll(client, "recipes", "id,name");
  const names = new Set(current.map((row) => normalizeName(row.name)));
  const missing = source
    .filter((row) => !names.has(normalizeName(row.name)))
    .map(({ ingredients, instructions, ...row }) => ({
      ...row,
      instructions: instructions.join(" | "),
    }));
  console.log(
    `${current.length} database recipes; ${missing.length} unique recipes ${dryRun ? "would be added" : "to add"}.`,
  );
  if (dryRun) return;
  for (let offset = 0; offset < missing.length; offset += 200) {
    const { error } = await client
      .from("recipes")
      .insert(missing.slice(offset, offset + 200));
    if (error) throw new Error(error.message);
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error("Recipe sync failed:", error.message);
    process.exitCode = 1;
  });
module.exports = { main };
