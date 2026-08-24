const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const CATEGORY_PAGES = [
  { name: "Fresh Produce", url: "https://smmarkets.ph/fresh-produce.html" },
  { name: "Fresh Meat & Seafood", url: "https://smmarkets.ph/fresh-meat-seafood.html" },
  { name: "Frozen Goods", url: "https://smmarkets.ph/frozen-goods.html" },
  { name: "Ready to Cook", url: "https://smmarkets.ph/ready-to-cook.html" },
  { name: "Chilled & Dairy Items", url: "https://smmarkets.ph/chilled-dairy-items.html" },
  { name: "Bakery", url: "https://smmarkets.ph/bakery.html" },
  { name: "International Goods", url: "https://smmarkets.ph/international-goods.html" },
  { name: "Pantry", url: "https://smmarkets.ph/pantry.html" },
];

const MAX_SCROLLS = 500;
const WAIT_AFTER_SCROLL = 900;
const WAIT_AFTER_PAGE_LOAD = 3000;

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function collectVisibleProducts(page, category) {
  return page.evaluate((sourceCategory) => {
    const results = [];
    const links = Array.from(document.querySelectorAll('a[href*=".html"]'));

    for (const link of links) {
      const href = link.href;

      if (!href.includes("smmarkets.ph") || href.includes(".html#")) {
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
        /(?:\u20b1|PHP)\s*([\d,]+(?:\.\d{1,2})?)/i
      );

      if (!priceMatch) {
        continue;
      }

      const price = parseFloat(priceMatch[1].replace(/,/g, ""));

      if (!Number.isFinite(price) || price <= 0) {
        continue;
      }

      const nameElement =
        card.querySelector(".product-name") ||
        card.querySelector(".name") ||
        card.querySelector("h2") ||
        card.querySelector("h3") ||
        card.querySelector("h4");

      const name = (nameElement?.innerText || link.innerText || "").trim();

      if (!name) {
        continue;
      }

      results.push({
        name,
        price,
        url: href,
        source_category: sourceCategory,
      });
    }

    return results;
  }, category);
}

async function collectCategory(page, category, products) {
  console.log(`\nOpening ${category.name}: ${category.url}`);

  await page.goto(category.url, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });

  await sleep(WAIT_AFTER_PAGE_LOAD);

  let previousProductCount = products.size;
  let unchangedCount = 0;
  let scrollNumber = 0;

  while (scrollNumber < MAX_SCROLLS) {
    scrollNumber++;

    const visibleProducts = await collectVisibleProducts(page, category.name);

    for (const product of visibleProducts) {
      if (!products.has(product.url)) {
        products.set(product.url, product);
      }
    }

    console.log(
      `  Scroll ${scrollNumber}/${MAX_SCROLLS}: ` +
        `${visibleProducts.length} visible, ${products.size} total`
    );

    if (products.size === previousProductCount) {
      unchangedCount++;
    } else {
      unchangedCount = 0;
      previousProductCount = products.size;
    }

    if (unchangedCount >= 5) {
      break;
    }

    await page.evaluate(() => {
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "instant",
      });
    });

    await sleep(WAIT_AFTER_SCROLL);
  }

  console.log(`  Finished ${category.name}: ${products.size} unique products`);
}

async function scrapeSM() {
  console.log("Starting SM Supermarkets food catalog scraper");

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });

  const products = new Map();

  try {
    for (const category of CATEGORY_PAGES) {
      await collectCategory(page, category, products);
    }

    const productArray = Array.from(products.values());
    const outputPath = path.join(__dirname, "sm-products.json");

    fs.writeFileSync(
      outputPath,
      JSON.stringify(productArray, null, 2),
      "utf8"
    );

    console.log(`\nScraping complete: ${productArray.length} unique products`);
    console.log(`Saved: ${outputPath}`);
  } finally {
    await browser.close();
  }
}

scrapeSM().catch((error) => {
  console.error("SM scraper failed:", error);
  process.exit(1);
});
