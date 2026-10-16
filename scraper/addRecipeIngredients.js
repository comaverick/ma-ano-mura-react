const { getClient, ensureCatalog } = require("./lib/persistence");
ensureCatalog(getClient(), {
  dryRun: process.argv.includes("--dry-run"),
}).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
