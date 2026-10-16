import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Skeleton } from "antd";
import { ArrowRightOutlined, SearchOutlined } from "@ant-design/icons";
import { CATEGORIES } from "../domain/categories";
import domainCosting from "../domain/costing.js";
import { useMarket } from "../context/MarketContext";
import "./Categories.css";
const { getLatestPrice } = domainCosting;
export default function Categories() {
  const { priceIndex, loading, error, refresh } = useMarket();
  const [search, setSearch] = useState("");
  const categories = useMemo(
    () =>
      CATEGORIES.map((category) => {
        const entries = [...priceIndex.values()].filter(
          (entry) => entry.definition.category === category.name,
        );
        const priced = entries.filter((entry) => getLatestPrice(entry));
        return { ...category, entries, priced };
      })
        .filter(
          (category) =>
            category.name !== "Other Commodities" ||
            loading ||
            category.entries.length,
        )
        .filter(
          (category) =>
            !search.trim() ||
            `${category.label} ${category.description} ${category.entries.map((entry) => entry.definition.name).join(" ")}`
              .toLowerCase()
              .includes(search.trim().toLowerCase()),
        ),
    [priceIndex, search, loading],
  );
  return (
    <main className="page-shell categories-page">
      <section className="page-intro category-intro">
        <div>
          <span className="eyebrow">THE INGREDIENT AISLE</span>
          <h1>
            Good meals start
            <br />
            with good <em>ingredients.</em>
          </h1>
          <p>
            Browse the essentials, discover what’s available, and take a little
            more confidence to your next market run.
          </p>
        </div>
        <div className="category-intro-art" aria-hidden="true">
          <span>🥬</span>
          <span>🍋</span>
          <span>🧄</span>
        </div>
      </section>
      <div className="category-toolbar">
        <div>
          <strong>Explore your basket</strong>
          <span>{categories.length} categories</span>
        </div>
        <label className="search-field">
          <SearchOutlined />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a category or ingredient…"
            aria-label="Search categories"
          />
        </label>
      </div>
      {error && (
        <Alert
          className="data-warning"
          type="warning"
          showIcon
          title={error}
          action={
            <button className="text-link" onClick={refresh}>
              Retry
            </button>
          }
        />
      )}
      <div className="category-directory">
        {categories.map((category) => (
          <Link
            className="category-tile"
            key={category.name}
            to={`/prices?category=${encodeURIComponent(category.name)}`}
            style={{ "--category-color": category.color }}
          >
            <div className="category-tile-top">
              <span className="category-emoji" aria-hidden="true">
                {category.emoji}
              </span>
              <span className="category-tile-arrow">
                <ArrowRightOutlined />
              </span>
            </div>
            <h2>{category.label}</h2>
            <p>{category.description}</p>
            <div className="category-tile-examples">
              {loading ? (
                <Skeleton active title={false} paragraph={{ rows: 1 }} />
              ) : (
                category.entries
                  .slice(0, 3)
                  .map(({ definition }) => (
                    <span key={definition.key}>{definition.name}</span>
                  ))
              )}
            </div>
            <div className="category-tile-bottom">
              <span>
                {loading
                  ? "Loading catalog…"
                  : `${category.entries.length} ingredients`}
              </span>
              <span>
                {loading ? "" : `${category.priced.length} with price data`}
              </span>
            </div>
          </Link>
        ))}
      </div>
      {!categories.length && (
        <div className="state-message">
          <h2>No categories found</h2>
          <p>Try an ingredient such as tomato, rice, or chicken.</p>
          <button className="button" onClick={() => setSearch("")}>
            Clear search
          </button>
        </div>
      )}
      <section className="category-recipe-banner">
        <span aria-hidden="true">🍽️</span>
        <div>
          <h2>Have the ingredients. Need the inspiration?</h2>
          <p>Explore Filipino favorites and see what they’ll cost to cook.</p>
        </div>
        <Link className="button button-dark" to="/recipes">
          Find a recipe <ArrowRightOutlined />
        </Link>
      </section>
    </main>
  );
}
