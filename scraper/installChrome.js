const { install } = require("@puppeteer/browsers");

(async () => {
  try {
    await install({
      browser: "chrome",
      buildId: "147.0.7727.57",
      cacheDir: process.env.PUPPETEER_CACHE_DIR || "/home/runner/.cache/puppeteer",
    });

    console.log("Chrome installed successfully.");
  } catch (error) {
    console.error("Failed to install Chrome:", error);
    process.exit(1);
  }
})();