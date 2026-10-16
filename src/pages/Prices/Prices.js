import { useMemo, useDeferredValue, useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Alert, Skeleton } from "antd";
import {
  SearchOutlined,
  ArrowRightOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useMarket } from "../../context/MarketContext";
import domainCosting from "../../domain/costing.js";
import { CATEGORIES } from "../../domain/categories";
import { formatDate, isStale } from "../../utils/format";
import IngredientCard from "../../components/IngredientCard/IngredientCard";
import "./Prices.css";
const { getLatestPrice, PRICE_SOURCES } = domainCosting;
export default function Prices() {
  const { priceIndex, loading, error, refresh } = useMarket();
  const [params, setParams] = useSearchParams();
  const [limit, setLimit] = useState(24);
  const query = params.get("q") || "";
  const category = CATEGORIES.some((c) => c.name === params.get("category"))
    ? params.get("category")
    : "All";
  const source = PRICE_SOURCES.some((s) => s.value === params.get("source"))
    ? params.get("source")
    : "best";
  const sort = params.get("sort") || "name";
  const deferredQuery = useDeferredValue(query);
  function update(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }
  useEffect(() => {
    setLimit(24);
  }, [deferredQuery, category, source, sort]);
  const entries = useMemo(
    () =>
      [...priceIndex.values()]
        .map((entry) => {
          const price = getLatestPrice(entry, source);
          if (!price) return null;
          const history = entry.prices.filter(
            (p) =>
              p.source === price.source &&
              p.ingredientId === price.ingredientId,
          );
          const recent = history.filter(
            (p) => Date.now() - Date.parse(p.date) <= 30 * 86400000,
          );
          const byDate = new Map();
          for (const p of recent)
            if (
              !byDate.has(p.date) ||
              +p.avg_price < +byDate.get(p.date).avg_price
            )
              byDate.set(p.date, p);
          const values = [...byDate.values()];
          const average = values.length
            ? values.reduce((sum, p) => sum + Number(p.avg_price), 0) /
              values.length
            : null;
          return {
            ...entry,
            price,
            history,
            average,
            change: average
              ? ((+price.avg_price - average) / average) * 100
              : 0,
          };
        })
        .filter(Boolean),
    [priceIndex, source],
  );
  const filtered = useMemo(
    () =>
      entries
        .filter(
          ({ definition }) =>
            (category === "All" || definition.category === category) &&
            `${definition.name} ${definition.aliases.join(" ")}`
              .toLowerCase()
              .includes(deferredQuery.trim().toLowerCase()),
        )
        .sort((a, b) =>
          sort === "price-low"
            ? a.price.avg_price - b.price.avg_price
            : sort === "price-high"
              ? b.price.avg_price - a.price.avg_price
              : sort === "best"
                ? a.change - b.change
                : a.definition.name.localeCompare(b.definition.name),
        ),
    [entries, category, deferredQuery, sort],
  );
  const latest = entries
    .map((entry) => entry.price.date)
    .sort()
    .at(-1);
  const stale = entries.filter((entry) => isStale(entry.price.date)).length;
  return (
    <main className="page-shell prices-page">
      <section className="page-intro prices-intro">
        <div>
          <span className="eyebrow">
            <span className="status-dot" /> THE NCR MARKET NOTEBOOK
          </span>
          <h1>
            A smarter trip
            <br />
            to the <em>market.</em>
          </h1>
          <p>
            Check ingredient prices before you fill your basket. Compare source
            quotes, follow price trends, and plan with a clearer picture.
          </p>
        </div>
        <div className="price-intro-note">
          <span className="price-note-icon">↗</span>
          <strong>{loading ? "—" : entries.length}</strong>
          <span>ingredients with price data</span>
          <small>
            {loading
              ? "Loading observations…"
              : `Latest observation · ${formatDate(latest)}`}
          </small>
        </div>
      </section>
      <div className="price-toolbar">
        <label className="search-field">
          <SearchOutlined />
          <input
            aria-label="Search ingredients"
            placeholder="Search ingredients, e.g. garlic or kamatis…"
            value={query}
            onChange={(event) => update("q", event.target.value)}
          />
        </label>
        <div className="source-tabs" aria-label="Choose price source">
          {PRICE_SOURCES.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={source === item.value}
              onClick={() => update("source", item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="category-filters" aria-label="Filter by category">
        {[
          { name: "All", label: "All ingredients", emoji: "🧺" },
          ...CATEGORIES,
        ].map((item) => (
          <button
            key={item.name}
            type="button"
            aria-pressed={category === item.name}
            onClick={() =>
              update("category", item.name === "All" ? "" : item.name)
            }
          >
            <span aria-hidden="true">{item.emoji}</span>
            {item.label}
          </button>
        ))}
      </div>
      <div className="results-summary">
        <span>
          {loading
            ? "Loading your market notebook…"
            : `${filtered.length} ingredients${category === "All" ? "" : ` in ${category.toLowerCase()}`}`}
        </span>
        <label>
          Sort by{" "}
          <select
            aria-label="Sort prices"
            value={sort}
            onChange={(event) => update("sort", event.target.value)}
          >
            <option value="name">Name A–Z</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
            <option value="best">Below 30-day average</option>
          </select>
        </label>
        <button className="text-link" onClick={refresh} disabled={loading}>
          <ReloadOutlined spin={loading} /> Refresh
        </button>
      </div>
      {error && (
        <Alert
          className="data-warning"
          type="error"
          showIcon
          title={error}
          action={<button onClick={refresh}>Retry</button>}
        />
      )}
      {!loading && stale > 0 && (
        <p className="price-freshness-note">
          {stale} ingredient{stale === 1 ? " has" : "s have"} quotes older than
          7 days. Each card shows its observation date.
        </p>
      )}
      <div className="ingredient-grid" aria-busy={loading}>
        {loading
          ? Array.from({ length: 8 }, (_, i) => (
              <div className="price-loading-card" key={i}>
                <Skeleton active paragraph={{ rows: 5 }} />
              </div>
            ))
          : filtered
              .slice(0, limit)
              .map(({ definition, price, history, average }) => (
                <IngredientCard
                  key={definition.key}
                  name={definition.name}
                  category={definition.category}
                  price={Number(price.avg_price)}
                  averagePrice={average}
                  unit={definition.unit}
                  priceHistory={history}
                  source={price.source}
                  reference={price.ingredientName}
                  rateReference={!!price.reference}
                  date={price.date}
                />
              ))}
      </div>
      {!loading && !error && !filtered.length && (
        <div className="state-message">
          <h2>No matching prices yet.</h2>
          <p>
            Try another ingredient or source. Some foods are not currently
            listed by DA or SM.
          </p>
          <button className="button" onClick={() => setParams({})}>
            Clear filters
          </button>
        </div>
      )}
      {!loading && filtered.length > limit && (
        <div className="load-more">
          <button
            className="button"
            onClick={() => setLimit((value) => value + 24)}
          >
            Show more ingredients <ArrowRightOutlined />
          </button>
          <span>
            Showing {Math.min(limit, filtered.length)} of {filtered.length}
          </span>
        </div>
      )}
      <div className="price-method-note">
        <div>
          <strong>A quick note on these numbers</strong>
          <p>
            DA Pricewatch shows available NCR market averages. SM shows the
            lowest matched in-stock product per unit. “Lowest available”
            compares recent source quotes; it does not include every store or
            market. Prices are collected on a daily schedule, and collection can
            be delayed.
          </p>
        </div>
        <Link className="text-link" to="/recipes">
          Put prices into a recipe <ArrowRightOutlined />
        </Link>
      </div>
    </main>
  );
}
