const puppeteer = require("puppeteer");
const fs = require("fs");

const URL = "https://smmarkets.ph/pantry.html";

async function scrapeSM() {

  const browser = await puppeteer.launch({
    headless: true,
  });

  try {

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36"
    );

    console.log("Opening SM Markets Pantry...\n");

    await page.goto(URL, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    await new Promise(resolve =>
      setTimeout(resolve, 5000)
    );


    const allProducts = new Map();

    let previousCount = 0;
    let unchangedRounds = 0;


    // =====================================================
    // INFINITE SCROLL
    // =====================================================

    while (true) {

      // ---------------------------------------------
      // Extract currently visible products
      // ---------------------------------------------

      const products =
        await page.evaluate(() => {

          const results = [];

          const buttons =
            Array.from(
              document.querySelectorAll(
                "button, a"
              )
            );

          buttons.forEach((button) => {

            const buttonText =
              button.innerText
                ?.replace(/\s+/g, " ")
                .trim();

            if (
              buttonText !== "Add to Cart"
            ) {
              return;
            }

            let card =
              button.parentElement;


            for (
              let i = 0;
              i < 8 && card;
              i++
            ) {

              const text =
                card.innerText
                  ?.replace(/\s+/g, " ")
                  .trim();

              if (
                text &&
                text.includes("₱") &&
                text.length < 1000
              ) {
                break;
              }

              card =
                card.parentElement;
            }


            if (!card) {
              return;
            }


            const text =
              card.innerText
                .replace(/\s+/g, " ")
                .trim();


            const link =
              card.querySelector(
                "a[href]"
              );


            const url =
              link
                ? link.href
                : null;


            const priceMatch =
              text.match(
                /₱\s*([\d,]+(?:\.\d{1,2})?)/
              );


            const price =
              priceMatch
                ? parseFloat(
                    priceMatch[1]
                      .replace(/,/g, "")
                  )
                : null;


            let name =
              text
                .replace(
                  /Quick View/g,
                  ""
                )
                .replace(
                  /Add to Cart/g,
                  ""
                )
                .replace(
                  /₱\s*[\d,]+(?:\.\d{1,2})?/g,
                  ""
                )
                .replace(
                  /\s+/g,
                  " "
                )
                .trim();


            if (
              name &&
              price !== null &&
              url
            ) {

              results.push({
                name,
                price,
                url,
              });

            }

          });


          return results;

        });


      // ---------------------------------------------
      // Add products to Map
      // ---------------------------------------------

      for (const product of products) {

        allProducts.set(
          product.url,
          product
        );

      }


      const currentCount =
        allProducts.size;


      console.log(
        `Products collected: ${currentCount}`
      );


      // ---------------------------------------------
      // Check if new products appeared
      // ---------------------------------------------

      if (
        currentCount === previousCount
      ) {

        unchangedRounds++;

      } else {

        unchangedRounds = 0;

      }


      previousCount =
        currentCount;


      // ---------------------------------------------
      // Stop after several scrolls with no new items
      // ---------------------------------------------

      if (
        unchangedRounds >= 3
      ) {

        console.log(
          "\nNo new products found."
        );

        break;

      }


      // ---------------------------------------------
      // Scroll to bottom
      // ---------------------------------------------

      await page.evaluate(() => {

        window.scrollTo(
          0,
          document.body.scrollHeight
        );

      });


      // ---------------------------------------------
      // Wait for lazy loading
      // ---------------------------------------------

      await new Promise(resolve =>
        setTimeout(resolve, 3000)
      );

    }


    // =====================================================
    // SAVE
    // =====================================================

    const products =
      Array.from(
        allProducts.values()
      );


    console.log(
      "\n================================"
    );

    console.log(
      `TOTAL PRODUCTS: ${products.length}`
    );

    console.log(
      "================================\n"
    );


    fs.writeFileSync(
      "scraper/sm-products.json",
      JSON.stringify(
        products,
        null,
        2
      )
    );


    console.log(
      "Saved:"
    );

    console.log(
      "scraper/sm-products.json"
    );


  } catch (error) {

    console.error(
      "\nSCRAPER FAILED:"
    );

    console.error(
      error.message
    );

  } finally {

    await browser.close();

  }

}

scrapeSM();