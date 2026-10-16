const {
  catalog,
  catalogForMarket,
  normalizeName,
} = require("../../src/domain/ingredientCatalog.js");
const { getClient, fetchAll, withRetry } = require("./client");
const LOCATION_ID = "e0882552-d250-4545-8305-0fcfdff3a566";
function manilaDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
async function ensureCatalog(client, { dryRun = false } = {}) {
  let existing = await fetchAll(client, "ingredients", "id,name,unit,category");
  const keys = new Set(
    existing
      .map(catalogForMarket)
      .filter(Boolean)
      .map((item) => item.key),
  );
  const missing = catalog
    .filter((item) => !keys.has(item.key))
    .map((item) => ({
      name: item.name,
      unit: item.unit.toUpperCase(),
      category: item.category,
    }));
  if (!dryRun && missing.length) {
    const { data, error } = await client
      .from("ingredients")
      .insert(missing)
      .select("id,name,unit,category");
    if (error)
      throw new Error(
        `Cannot add recipe ingredients: ${error.message}. Use a Supabase key authorized for ingredient writes.`,
      );
    existing = existing.concat(data);
  }
  console.log(
    `Catalog: ${existing.length} existing ingredients; ${missing.length} ${dryRun ? "would be added" : "added"}.`,
  );
  return { ingredients: existing, missing };
}
function targetIngredient(ingredients, definition) {
  const exact = ingredients.find(
    (item) => normalizeName(item.name) === definition.key,
  );
  if (exact) return exact;
  if (definition.key === "chicken egg") {
    const large = ingredients.find(
      (item) =>
        /^chicken egg/i.test(item.name) &&
        /\blarge\b/i.test(item.name) &&
        !/extra/i.test(item.name),
    );
    if (large) return large;
  }
  return (
    ingredients.find(
      (item) => catalogForMarket(item)?.key === definition.key,
    ) || null
  );
}
async function writePrices(client, rows, { dryRun = false } = {}) {
  if (!rows.length) throw new Error("No valid prices to save");
  if (new Set(rows.map((row) => row.ingredient_id)).size !== rows.length)
    throw new Error("Duplicate ingredient in daily price batch");
  const source = rows[0].source;
  const date = rows[0].date;
  if (
    !["DA Pricewatch", "SM Supermarkets"].includes(source) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    rows.some(
      (row) =>
        !row.ingredient_id ||
        row.location_id !== LOCATION_ID ||
        row.source !== source ||
        row.date !== date ||
        !Number.isFinite(row.avg_price) ||
        row.avg_price <= 0,
    )
  )
    throw new Error("Price batch failed source/date/value validation");
  if (dryRun) {
    console.log(
      `Dry run: ${rows.length} valid normalized price rows; database unchanged.`,
    );
    return { inserted: 0, updated: 0, planned: rows.length };
  }
  const { data: existing, error } = await client
    .from("prices")
    .select("id,ingredient_id,avg_price,source,date")
    .eq("date", date)
    .eq("source", source)
    .eq("location_id", LOCATION_ID);
  if (error) throw new Error(`Cannot check daily prices: ${error.message}`);
  const byId = new Map();
  for (const row of existing) {
    if (!byId.has(row.ingredient_id)) byId.set(row.ingredient_id, []);
    byId.get(row.ingredient_id).push(row);
  }
  const inserts = [];
  let updated = 0;
  for (const row of rows) {
    const current = byId.get(row.ingredient_id);
    if (!current) {
      inserts.push(row);
      continue;
    }
    if (current.some((item) => Number(item.avg_price) !== row.avg_price)) {
      const { error: updateError } = await withRetry(() =>
        client
          .from("prices")
          .update({ avg_price: row.avg_price })
          .in(
            "id",
            current.map((item) => item.id),
          )
          .throwOnError(),
      );
      if (updateError) throw updateError;
      updated += 1;
    }
  }
  for (let i = 0; i < inserts.length; i += 200) {
    const chunk = inserts.slice(i, i + 200);
    await withRetry(async () => {
      // A timed-out insert may already have committed. Reconcile before retrying
      // so a lost HTTP response cannot create duplicate daily price records.
      const { data: present, error: checkError } = await client
        .from("prices")
        .select("ingredient_id")
        .eq("date", date)
        .eq("source", source)
        .eq("location_id", LOCATION_ID)
        .in(
          "ingredient_id",
          chunk.map((row) => row.ingredient_id),
        );
      if (checkError) throw new Error(checkError.message);
      const saved = new Set(present.map((row) => row.ingredient_id));
      const pending = chunk.filter((row) => !saved.has(row.ingredient_id));
      if (pending.length)
        await client.from("prices").insert(pending).throwOnError();
    });
  }
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { data: verified, error: verifyError } = await client
      .from("prices")
      .select("ingredient_id,avg_price")
      .eq("date", date)
      .eq("source", source)
      .eq("location_id", LOCATION_ID)
      .in(
        "ingredient_id",
        chunk.map((row) => row.ingredient_id),
      );
    if (verifyError)
      throw new Error(`Cannot verify saved prices: ${verifyError.message}`);
    const byIngredient = new Map(
      verified.map((row) => [row.ingredient_id, Number(row.avg_price)]),
    );
    if (
      chunk.some(
        (row) =>
          !byIngredient.has(row.ingredient_id) ||
          Math.abs(byIngredient.get(row.ingredient_id) - row.avg_price) > 0.005,
      )
    )
      throw new Error(
        "Price persistence verification failed. Check the server key's insert/update permissions.",
      );
  }
  return {
    inserted: inserts.length,
    updated,
    unchanged: rows.length - inserts.length - updated,
  };
}
module.exports = {
  LOCATION_ID,
  manilaDate,
  ensureCatalog,
  targetIngredient,
  writePrices,
  getClient,
  fetchAll,
};
