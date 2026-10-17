import { useMemo, useState } from "react";
import { useMarket } from "../context/MarketContext";
import domain from "../domain/packages.js";
import {
  formatMoney,
  formatShoppingQuantity,
  formatDate,
} from "../utils/format";
import "./PackageEstimate.css";
export default function PackageEstimate({ list, source, budget }) {
  const {
    marketSnapshot,
    packageLoading,
    packageError,
    refreshPackages,
    ingredients = [],
  } = useMarket();
  const [copied, setCopied] = useState("");
  const latest = ingredients
    .flatMap((ingredient) => ingredient.prices || [])
    .filter((price) => price.source === "SM Supermarkets")
    .map((price) => price.date)
    .sort()
    .at(-1);
  const purchase = useMemo(
    () =>
      domain.estimatePackages(list, marketSnapshot?.offers || [], {
        source,
        latestSMDate: latest,
      }),
    [list, marketSnapshot, source, latest],
  );
  if (!list.items.length) return null;
  async function copy() {
    const text = [
      "Ma-Ano-Mura · SM whole-pack shopping estimate",
      ...purchase.items.map((item) =>
        item.purchase
          ? `${item.purchase.packs} × ${item.purchase.offer.product} — ${formatMoney(item.purchase.total)}`
          : `${item.name} — ${item.packageReason}`,
      ),
      `${purchase.complete ? "Estimated pack total" : "Known pack subtotal"}: ${formatMoney(purchase.total)}`,
      "Prices and stock can change; verify at the store.",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied("Pack shopping list copied.");
    } catch {
      setCopied("Copy is unavailable. Use Print list to save these details.");
    }
  }
  return (
    <section className="package-estimate">
      <div className="package-heading">
        <div>
          <span className="eyebrow">WHAT YOU MAY NEED TO BUY</span>
          <h3>From recipe amounts to whole packs.</h3>
        </div>
        <span aria-hidden="true">🛒</span>
      </div>
      <p>
        The ingredient subtotal uses only what you cook with. This estimate
        rounds up to complete SM packages and excludes your pantry ingredients.
      </p>
      {packageLoading ? (
        <p role="status">Loading verified package sizes…</p>
      ) : packageError ? (
        <div className="package-warning">
          <p>{packageError}</p>
          <button className="text-link" onClick={refreshPackages}>
            Retry package details
          </button>
        </div>
      ) : (
        <>
          <div className="package-summary">
            <div>
              <small>
                {purchase.complete
                  ? "ESTIMATED SM PACK TOTAL"
                  : "KNOWN SM PACK SUBTOTAL"}
              </small>
              <strong>
                {purchase.covered ? formatMoney(purchase.total) : "—"}
              </strong>
              <span>
                {purchase.covered}/{purchase.items.length} ingredients have
                recent package details
                {marketSnapshot?.date
                  ? ` · ${formatDate(marketSnapshot.date)}`
                  : ""}
              </span>
            </div>
            <button className="button no-print" onClick={copy}>
              Copy pack list
            </button>
          </div>
          {refreshPackages && (
            <button className="text-link no-print" onClick={refreshPackages}>
              Refresh package details
            </button>
          )}
          <p role="status">{copied}</p>
          {!purchase.complete && (
            <p className="package-warning">
              {purchase.missing} ingredient{purchase.missing === 1 ? "" : "s"}{" "}
              still need a verified package or quantity. This subtotal does not
              confirm your full checkout budget.
            </p>
          )}
          {Number(budget) > 0 && purchase.covered > 0 && (
            <p
              className={
                purchase.total > Number(budget) ? "package-warning" : ""
              }
            >
              {purchase.total > Number(budget)
                ? `${formatMoney(purchase.total - Number(budget))} over your weekly budget${purchase.complete ? "" : " already, before remaining purchases"}.`
                : purchase.complete
                  ? `${formatMoney(Number(budget) - purchase.total)} remains after the listed packs.`
                  : "Remaining purchases may put you over budget."}
            </p>
          )}
          <div className="package-items">
            {purchase.items.map((item) => (
              <article key={item.key}>
                <div>
                  <h4>{item.name}</h4>
                  {item.purchase ? (
                    <>
                      <a
                        href={item.purchase.offer.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {item.purchase.packs} × {item.purchase.offer.product} ↗
                      </a>
                      <small>
                        Need {formatShoppingQuantity(item.amount, item.unit)} ·
                        Buy {item.purchase.offer.variable ? "at least " : ""}
                        {formatShoppingQuantity(
                          item.purchase.bought,
                          item.unit,
                        )}{" "}
                        ·{" "}
                        {item.purchase.offer.variable ? "At least " : "About "}
                        {formatShoppingQuantity(
                          item.purchase.leftover,
                          item.unit,
                        )}{" "}
                        left
                        {item.purchase.offer.estimated
                          ? " · package conversion approximate"
                          : ""}
                      </small>
                      {item.purchase.offer.variable && (
                        <small>
                          Variable-weight pack: uses the minimum stated weight.
                          Final weighed price may differ.
                        </small>
                      )}
                      <small>
                        SM Supermarkets · observed{" "}
                        {formatDate(item.purchase.offer.date)}
                      </small>
                    </>
                  ) : (
                    <small>
                      {item.packageReason}. Ingredient amount:{" "}
                      {item.amount
                        ? formatShoppingQuantity(item.amount, item.unit)
                        : "not specified"}
                      .
                    </small>
                  )}
                </div>
                <strong>
                  {item.purchase ? formatMoney(item.purchase.total) : "—"}
                </strong>
              </article>
            ))}
          </div>
          <p className="package-footnote">
            One matched product option per ingredient. Quotes are observed
            online prices; availability, delivery fees and actual checkout
            prices can differ. DA market quotes have no verified retail package
            sizes.
          </p>
        </>
      )}
    </section>
  );
}
