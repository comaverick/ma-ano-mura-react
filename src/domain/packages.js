import { byKey } from "./ingredientCatalog.js";
function validOffer(offer) {
  if (
    !offer ||
    !byKey.has(offer.ingredientKey) ||
    !["kg", "l", "piece"].includes(offer.unit) ||
    offer.unit !== byKey.get(offer.ingredientKey).unit ||
    !Number.isFinite(offer.packPrice) ||
    offer.packPrice <= 0 ||
    !Number.isFinite(offer.baseAmount) ||
    offer.baseAmount <= 0 ||
    typeof offer.product !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(offer.date)
  )
    return false;
  try {
    const url = new URL(offer.url);
    return (
      url.protocol === "https:" &&
      url.hostname === "smmarkets.ph" &&
      Number.isFinite(Date.parse(offer.date))
    );
  } catch {
    return false;
  }
}
function estimatePackages(
  list,
  offers,
  { source = "best", now = Date.now(), latestSMDate = null } = {},
) {
  const candidates = (offers || []).filter(
    (offer) =>
      validOffer(offer) &&
      now - Date.parse(offer.date) <= 3 * 86400000 &&
      Date.parse(offer.date) - now <= 86400000 &&
      (!latestSMDate || offer.date === latestSMDate),
  );
  const rows = list.items.map((item) => {
    const ingredientKey = item.key.slice(0, item.key.lastIndexOf(":"));
    const options =
      source === "DA Pricewatch" || item.unknownQuantity || !(item.amount > 0)
        ? []
        : candidates
            .filter(
              (offer) =>
                offer.ingredientKey === ingredientKey &&
                offer.unit === item.unit,
            )
            .map((offer) => {
              const packs = Math.max(
                1,
                Math.ceil(item.amount / offer.baseAmount - 1e-9),
              );
              return {
                offer,
                packs,
                total: Number((packs * offer.packPrice).toFixed(2)),
                bought: packs * offer.baseAmount,
                leftover: Math.max(0, packs * offer.baseAmount - item.amount),
              };
            })
            .sort(
              (a, b) =>
                a.total - b.total ||
                a.leftover - b.leftover ||
                a.offer.product.localeCompare(b.offer.product),
            );
    return {
      ...item,
      purchase: options[0] || null,
      packageReason:
        source === "DA Pricewatch"
          ? "DA quotes do not include retail package sizes"
          : item.unknownQuantity
            ? "Set the missing recipe quantity first"
            : "No recent verified SM package available",
    };
  });
  const covered = rows.filter((row) => row.purchase);
  return {
    items: rows,
    total: covered.reduce((sum, row) => sum + row.purchase.total, 0),
    covered: covered.length,
    missing: rows.length - covered.length,
    complete:
      !list.unresolvedMeals &&
      rows.length === covered.length &&
      (rows.length > 0 || list.complete),
    estimated: covered.some((row) => row.purchase.offer.estimated),
    source: "SM Supermarkets",
  };
}
function cleanSnapshot(value) {
  if (
    value?.version !== 1 ||
    !Array.isArray(value.offers) ||
    value.offers.length > 10000
  )
    throw new Error("Package data format is invalid");
  return {
    ...value,
    offers: value.offers.filter(validOffer),
    quotes: Array.isArray(value.quotes)
      ? value.quotes.filter(
          (quote) =>
            quote &&
            typeof quote.ingredientId === "string" &&
            validOffer({ ...quote, packPrice: quote.unitPrice, baseAmount: 1 }),
        )
      : [],
    sources: Array.isArray(value.sources)
      ? value.sources
          .filter(
            (item) =>
              item &&
              ["DA Pricewatch", "SM Supermarkets"].includes(item.source),
          )
          .map((item) => {
            let evidenceUrl = null;
            try {
              const url = new URL(item.evidenceUrl);
              if (
                url.protocol === "https:" &&
                ["www.da.gov.ph", "smmarkets.ph"].includes(url.hostname)
              )
                evidenceUrl = url.href;
            } catch {}
            return { ...item, evidenceUrl };
          })
      : [],
  };
}
const api = { validOffer, estimatePackages, cleanSnapshot };
export { validOffer, estimatePackages, cleanSnapshot };
export default api;
