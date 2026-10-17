import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Skeleton } from "antd";
import { useMarket } from "../context/MarketContext";
import coverage from "../domain/coverage.js";
import { formatDate, formatSource } from "../utils/format";
import "./Coverage.css";
const reasons = {
  "no-price": "Missing price",
  quantity: "Quantity or unit",
  unmatched: "Ingredient match",
};
export default function Coverage() {
  const {
    recipes,
    priceIndex,
    loading,
    recipesLoading,
    error,
    refresh,
    marketSnapshot,
    packageError,
    refreshPackages,
  } = useMarket();
  const [reason, setReason] = useState("all");
  const [limit, setLimit] = useState(20);
  const report = useMemo(
    () =>
      coverage.summarizeCoverage(
        recipes.filter((recipe) => recipe.ingredients?.length),
        priceIndex,
      ),
    [recipes, priceIndex],
  );
  const priorities = report.priorities.filter(
    (gap) => reason === "all" || gap.status === reason,
  );
  return (
    <main className="page-shell coverage-page">
      <section className="page-intro">
        <span className="eyebrow">THE NUMBERS BEHIND YOUR MEALS</span>
        <h1>
          More clarity.
          <br />
          <em>Better estimates.</em>
        </h1>
        <p>
          See how much of our recipe collection can be priced, which ingredients
          need attention, and when each source was last observed.
        </p>
      </section>
      {error && (
        <Alert
          type="warning"
          title={error}
          action={<button onClick={refresh}>Retry prices</button>}
          showIcon
        />
      )}
      {loading || recipesLoading ? (
        <Skeleton active paragraph={{ rows: 12 }} />
      ) : (
        <>
          <section className="coverage-stats">
            <div>
              <strong>{report.coveragePercent}%</strong>
              <span>required ingredient rows priced</span>
            </div>
            <div>
              <strong>{report.fullyPricedRecipes.toLocaleString()}</strong>
              <span>recipes with all required costs</span>
            </div>
            <div>
              <strong>
                {(
                  report.requiredIngredientRows - report.pricedIngredientRows
                ).toLocaleString()}
              </strong>
              <span>ingredient rows needing review</span>
            </div>
          </section>
          <p className="coverage-note">
            Based on {report.recipes.toLocaleString()} recipes with ingredient
            details and current available source quotes. Water and unmeasured
            seasonings are excluded. Fully priced recipes can still use
            approximate cooking conversions or older quotes; the planner flags
            older shopping quotes separately.
          </p>
          <section className="coverage-sources">
            {Object.entries(report.sources).map(([source, data]) => {
              const attempt = marketSnapshot?.sources?.find(
                (item) => item.source === source,
              );
              const old =
                !data.latest ||
                Date.now() - Date.parse(data.latest) > 3 * 86400000;
              return (
                <article key={source}>
                  <span className={`pill ${old ? "pill-review" : ""}`}>
                    {old
                      ? "Source needs a refresh"
                      : "Recent observations available"}
                  </span>
                  <h2>{formatSource(source)}</h2>
                  <strong>{data.ingredients} ingredients</strong>
                  <p>Latest quote: {formatDate(data.latest)}</p>
                  <small>
                    Daily collection is scheduled. A quote date records
                    available data; it doesn’t confirm that today’s collection
                    succeeded.
                  </small>
                  {attempt && (
                    <div className="coverage-source-attempt">
                      <p>
                        Last collection report:{" "}
                        {formatDate(attempt.attemptedAt)}
                      </p>
                      <strong>
                        {attempt.collection === "success"
                          ? "Collection completed"
                          : "Collection needs attention"}
                      </strong>
                      <p>
                        {attempt.method}
                        {attempt.reportDate
                          ? ` · report dated ${formatDate(attempt.reportDate)}`
                          : ""}
                      </p>
                      {attempt.reportDate &&
                        attempt.reportDate < marketSnapshot.date && (
                          <p>
                            Uses an earlier published report. Its prices keep
                            the report date.
                          </p>
                        )}
                      {attempt.evidenceUrl && (
                        <a
                          className="text-link"
                          href={attempt.evidenceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View source evidence ↗
                        </a>
                      )}
                      {attempt.error && <small>{attempt.error}</small>}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
          {packageError && (
            <p className="coverage-note">
              Daily collection evidence could not be loaded. Quote dates above
              still reflect the saved prices.{" "}
              <button className="text-link" onClick={refreshPackages}>
                Retry collection details
              </button>
            </p>
          )}
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE MOST USEFUL GAPS TO CLOSE</span>
              <h2>Start where it helps more meals.</h2>
              <p>
                Ranked by recipes affected. Price gaps and quantity gaps need
                different fixes.
              </p>
            </div>
            <Link className="text-link" to="/planner">
              Find meals with complete shopping estimates →
            </Link>
          </div>
          <div className="coverage-filter" aria-label="Filter coverage gaps">
            {[["all", "All gaps"], ...Object.entries(reasons)].map(
              ([key, label]) => (
                <button
                  key={key}
                  aria-pressed={reason === key}
                  onClick={() => {
                    setReason(key);
                    setLimit(20);
                  }}
                >
                  {label}
                  {key !== "all"
                    ? ` (${report.missingByReason[key] || 0})`
                    : ""}
                </button>
              ),
            )}
          </div>
          <div className="coverage-gaps">
            {priorities.slice(0, limit).map((gap) => (
              <article className="coverage-gap" key={gap.key}>
                <div>
                  <span className="pill pill-review">
                    {reasons[gap.status]}
                  </span>
                  <h3>{gap.name}</h3>
                  <p>{gap.action}.</p>
                  <details>
                    <summary>Example recipe text</summary>
                    {gap.examples.map((text) => (
                      <p key={text}>{text}</p>
                    ))}
                  </details>
                </div>
                <div>
                  <strong>{gap.recipes}</strong>
                  <span>recipes affected</span>
                  <small>{gap.rows} ingredient rows</small>
                </div>
              </article>
            ))}
            {!priorities.length && (
              <p className="state-message">No gaps in this category.</p>
            )}
          </div>
          {priorities.length > limit && (
            <button className="button" onClick={() => setLimit(limit + 20)}>
              Show more ingredient gaps
            </button>
          )}
        </>
      )}
    </main>
  );
}
