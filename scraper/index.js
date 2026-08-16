const axios = require("axios");
const cheerio = require("cheerio");
const ws = require("ws");
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env")
});

const {
  createClient
} = require("@supabase/supabase-js");

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.REACT_APP_SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_KEY ||
  process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase =
  createClient(

    supabaseUrl,

    supabaseKey,

    {
      realtime: {
        transport: ws
      }
    }

  );

async function getPrices() {

  try {

    console.log(
      "SUPABASE CONNECTED!"
    );

    // NCR LOCATION ID
    const locationId =
      "e0882552-d250-4545-8305-0fcfdff3a566";

    // LOAD INGREDIENTS ONCE
    const {
      data: ingredients,
      error: ingredientLoadError
    } = await supabase

      .from("ingredients")

      .select("id, name");

    if (ingredientLoadError) {

      console.error(
        ingredientLoadError
      );

      return;

    }

    console.log(
      "INGREDIENTS LOADED:",
      ingredients.length
    );

    // DA COMMODITIES
    const commodities = [

      {
        id: 1,
        category: "Rice"
      },

      {
        id: 2,
        category: "Vegetables"
      },

      {
        id: 3,
        category: "Vegetables"
      },

      {
        id: 4,
        category: "Fish"
      },

      {
        id: 5,
        category: "Fruits"
      },

      {
        id: 6,
        category: "Vegetables"
      },

      {
        id: 7,
        category: "Vegetables"
      },

      {
        id: 8,
        category: "Meat and Poultry"
      },

      {
        id: 9,
        category: "Spices"
      },

      {
        id: 10,
        category:
          "Other Commodities"
      }

    ];

    // LOOP COMMODITIES
    for (
      const commodity
      of commodities
    ) {

      try {

        console.log(
          "\nREQUESTING:",
          commodity.category
        );

        // FETCH DA DATA
        const response =
          await axios.post(

            "http://www.bantaypresyo.da.gov.ph/tbl_price_get_comm_price.php",

            new URLSearchParams({

              commodity:
                commodity.id,

              region:
                "130000000",

              count: 31

            }),

            {
              headers: {
                "Content-Type":
                  "application/x-www-form-urlencoded"
              }
            }

          );

        // WRAP HTML
        const html =
          `<table><tbody>${response.data}</tbody></table>`;

        const $ =
          cheerio.load(html);

        const results = [];

        const rows = $("tr");

        console.log(
          "ROWS:",
          rows.length
        );

        rows.each((i, row) => {

          const cols =
            $(row).find("td");

          if (
            cols.length > 2
          ) {

            const marketPrices = [];

            // GET MARKET PRICES
            for (
              let j = 2;
              j < cols.length;
              j++
            ) {

              const value =
                $(cols[j])
                  .text()
                  .trim();

              if (
                value !== "N/A" &&
                value !== ""
              ) {

                marketPrices.push(
                  parseFloat(value)
                );

              }

            }

            // COMPUTE AVERAGE
            let averagePrice =
              "N/A";

            if (
              marketPrices.length > 0
            ) {

              const total =
                marketPrices.reduce(

                  (
                    sum,
                    price
                  ) =>
                    sum + price,

                  0

                );

              averagePrice =
                (
                  total /
                  marketPrices.length
                ).toFixed(2);

            }

            results.push({

              ingredient:
                $(cols[0])
                  .text()
                  .trim(),

              specification:
                $(cols[1])
                  .text()
                  .trim(),

              averagePrice

            });

          }

        });

        console.table(results);

        // INSERT TO SUPABASE
        for (
          const item
          of results
        ) {

          // SKIP N/A
          if (
            item.averagePrice ===
            "N/A"
          ) {
            continue;
          }

          // FIND INGREDIENT LOCALLY
          const ingredient =
            ingredients.find(

              ing =>
                ing.name ===
                item.ingredient

            );

          if (!ingredient) {

            console.log(
              "Ingredient not found:",
              item.ingredient
            );

            continue;

          }

          // TODAY DATE
          const todayDate =
            new Date()
              .toISOString()
              .split("T")[0];

          // CHECK DUPLICATE
          const {

            data: existingPrice,

            error: checkError

          } = await supabase

            .from("prices")

            .select("id")

            .eq(
              "ingredient_id",
              ingredient.id
            )

            .eq(
              "location_id",
              locationId
            )

            .eq(
              "date",
              todayDate
            )

            .maybeSingle();

          if (checkError) {

            console.error(
              checkError
            );

            continue;

          }

          // SKIP IF EXISTS
          if (existingPrice) {

            console.log(
              "Already exists:",
              item.ingredient
            );

            continue;

          }

          // INSERT PRICE
          const {

            error: insertError

          } = await supabase

            .from("prices")

            .insert({

              ingredient_id:
                ingredient.id,

              location_id:
                locationId,

              avg_price:
                parseFloat(
                  item.averagePrice
                ),

              date:
                todayDate

            });

          if (insertError) {

            console.error(
              insertError
            );

          } else {

            console.log(
              "Inserted:",
              item.ingredient
            );

          }

        }

      } catch (commodityError) {

        console.error(
          "FAILED:",
          commodity.category
        );

        console.error(
          commodityError.message
        );

      }

    }

    console.log(
      "\nSCRAPING FINISHED"
    );

  } catch (err) {

    console.error(err);

  }

}

getPrices();