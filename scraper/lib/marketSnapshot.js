const { validOffer } = require("../../src/domain/packages.js");
const { prepareSMPrices } = require("./smPipeline");
const { manilaDate } = require("./persistence");
function makeSnapshot({
  ingredients,
  prices,
  products = [],
  daily = {},
  reports = {},
  now = new Date(),
}) {
  const date = manilaDate(now);
  const prepared = prepareSMPrices(products, ingredients, { date });
  const saved = new Map(
    prices
      .filter(
        (price) => price.source === "SM Supermarkets" && price.date === date,
      )
      .map((price) => [price.ingredient_id, Number(price.avg_price)]),
  );
  const verifiedKeys = new Set(
    prepared.selected
      .filter(
        (item) =>
          Math.abs(
            (saved.get(item.ingredient.id) || -1) - item.normalized.unitPrice,
          ) < 0.011,
      )
      .map((item) => item.definition.key),
  );
  const offers = prepared.offers.filter(
    (offer) => verifiedKeys.has(offer.ingredientKey) && validOffer(offer),
  );
  return {
    version: 1,
    date,
    generatedAt: now.toISOString(),
    offers,
    quotes: prepared.selected
      .filter((item) => verifiedKeys.has(item.definition.key))
      .map(({ ingredient, definition, product, normalized }) => ({
        ingredientId: ingredient.id,
        ingredientKey: definition.key,
        date,
        source: "SM Supermarkets",
        unitPrice: Number(normalized.unitPrice.toFixed(2)),
        unit: definition.unit,
        product: product.name,
        url: product.url,
        estimated: normalized.estimated,
        estimateReason:
          normalized.estimateReason ||
          (normalized.estimated ? "Uses a package conversion estimate" : ""),
        variable: !!normalized.variable,
        ...(normalized.variable
          ? {
              unitPriceLow: normalized.unitPriceLow,
              unitPriceHigh: normalized.unitPriceHigh,
            }
          : {}),
      })),
    sources: ["DA Pricewatch", "SM Supermarkets"].map((source) => ({
      source,
      latestDate:
        prices
          .filter(
            (price) => price.source === source && Number(price.avg_price) > 0,
          )
          .map((price) => price.date)
          .sort()
          .at(-1) || null,
      collection:
        source === "DA Pricewatch"
          ? daily.da === true
            ? "success"
            : "failed"
          : daily.sm === true
            ? "success"
            : "failed",
      attemptedAt: daily.finishedAt || daily.startedAt || now.toISOString(),
      method:
        source === "DA Pricewatch"
          ? reports.da?.method || "Bantay Presyo / official DA daily reports"
          : "SM public catalog",
      reportDate:
        (source === "DA Pricewatch" ? reports.da : reports.sm)?.date || null,
      evidenceUrl:
        source === "DA Pricewatch"
          ? reports.da?.reportUrl || null
          : "https://smmarkets.ph/",
      error:
        source === "DA Pricewatch"
          ? reports.daFailure?.error || ""
          : daily.sm === false
            ? "Collection or persistence failed; previous quotes remain available."
            : "",
    })),
  };
}
module.exports = { makeSnapshot };
