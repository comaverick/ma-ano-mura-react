const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const URL = "https://smmarkets.ph/pantry.html";

const MAX_SCROLLS = 50;
const WAIT_AFTER_SCROLL = 1500;

async function scrapeSM() {
  console.log("========================================");
  console.log("🚀 STARTING SM SUPERMARKETS SCRAPER");
  console.log("========================================");

  console.log("🌐 Launching Chrome...");

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  console.log("✓ Chrome launched");

  const page = await browser.newPage();

  await page.setViewport({
    width: 1366,
    height: 768,
  });

  console.log(`🌐 Opening ${URL}`);

  await page.goto(URL, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });

  console.log("✓ Pantry page loaded");

  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("🔎 Starting product collection...");
  console.log(`⚙️ Maximum scrolls: ${MAX_SCROLLS}`);

  const products = new Map();

  let previousCount = 0;
  let unchangedCount = 0;
  let scrollNumber = 0;

  while (scrollNumber < MAX_SCROLLS) {
    scrollNumber++;

    console.log("");
    console.log(`🔄 SCROLL #${scrollNumber}/${MAX_SCROLLS}`);

    /*
     * Collect currently visible products
     */
    const newProducts = await page.evaluate(() => {
      const results = [];

      const links = Array.from(
        document.querySelectorAll('a[href*=".html"]')
      );

      for (const link of links) {
        const href = link.href;

        if (!href.includes("smmarkets.ph")) {
          continue;
        }

        if (href.includes("pantry.html")) {
          continue;
        }

        const card =
          link.closest(".product-item") ||
          link.closest(".product") ||
          link.closest(".item") ||
          link.parentElement?.parentElement;

        if (!card) {
          continue;
        }

        const text = card.innerText || "";

        const priceMatch = text.match(
          /₱\s*([\d,]+(?:\.\d{1,2})?)/
        );

        if (!priceMatch) {
          continue;
        }

        const price = parseFloat(
          priceMatch[1].replace(/,/g, "")
        );

        if (!price || price <= 0) {
          continue;
        }

        let name = "";

        const nameElement =
          card.querySelector(".product-name") ||
          card.querySelector(".name") ||
          card.querySelector("h2") ||
          card.querySelector("h3") ||
          card.querySelector("h4");

        if (nameElement) {
          name = nameElement.innerText.trim();
        }

        if (!name) {
          name = link.innerText.trim();
        }

        if (!name) {
          continue;
        }

        results.push({
          name,
          price,
          url: href,
        });
      }

      return results;
    });

    /*
     * Add products to Map
     */
    for (const product of newProducts) {
      if (!products.has(product.url)) {
        products.set(product.url, product);
      }
    }

    console.log(`   Products found this scroll: ${newProducts.length}`);
    console.log(`   TOTAL PRODUCTS: ${products.size}`);

    /*
     * Check if we're still finding new products
     */
    if (products.size === previousCount) {
      unchangedCount++;

      console.log(
        `   ⚠️ No new products (${unchangedCount}/5)`
      );
    } else {
      unchangedCount = 0;
      previousCount = products.size;

      console.log("   ✓ New products found");
    }

    /*
     * Stop if nothing new for 5 consecutive scrolls
     */
    if (unchangedCount >= 5) {
      console.log("");
      console.log(
        "🛑 No new products for 5 consecutive scrolls."
      );
      console.log("   Assuming we've reached the end.");
      break;
    }

    /*
     * Scroll to bottom
     */
    const scrollInfo = await page.evaluate(() => {
      const oldHeight = document.body.scrollHeight;

      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "instant",
      });

      return {
        oldHeight,
        scrollY: window.scrollY,
        height: document.body.scrollHeight,
      };
    });

    console.log(
      `   Page height: ${scrollInfo.height}px`
    );

    /*
     * Wait for lazy-loaded products
     */
    await new Promise((resolve) =>
      setTimeout(resolve, WAIT_AFTER_SCROLL)
    );
  }

  /*
   * Maximum scroll reached
   */
  if (scrollNumber >= MAX_SCROLLS) {
    console.log("");
    console.log(
      `⚠️ Reached maximum scroll limit of ${MAX_SCROLLS}.`
    );
  }

  /*
   * Convert Map to array
   */
  const productArray = Array.from(products.values());

  console.log("");
  console.log("========================================");
  console.log("SCRAPING COMPLETE");
  console.log("========================================");
  console.log(`SCROLLS USED: ${scrollNumber}`);
  console.log(`TOTAL PRODUCTS: ${productArray.length}`);

  /*
   * Save output
   */
  const outputPath = path.join(
    __dirname,
    "sm-products.json"
  );

  fs.writeFileSync(
    outputPath,
    JSON.stringify(productArray, null, 2),
    "utf8"
  );

  console.log(`✓ Saved: ${outputPath}`);

  await browser.close();

  console.log("✓ Chrome closed");
  console.log("========================================");
}

scrapeSM().catch((error) => {
  console.error("");
  console.error("========================================");
  console.error("❌ SM SCRAPER FAILED");
  console.error("========================================");
  console.error(error);

  process.exit(1);
});