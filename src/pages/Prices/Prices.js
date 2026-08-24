import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { Alert, Button, Empty, Input, Skeleton } from "antd";
import {
  AppstoreOutlined,
  CoffeeOutlined,
  FireOutlined,
  GiftOutlined,
  InboxOutlined,
  SearchOutlined,
  ShopOutlined,
  ShoppingOutlined,
  TagOutlined,
} from "@ant-design/icons";
import { supabase } from "../../supabaseClient";
import IngredientCard from "../../components/IngredientCard/IngredientCard";
import PriceHero from "../../components/PriceHero/PriceHero";
import "./Prices.css";

const categories = [
  { name: "All", icon: <AppstoreOutlined /> },
  { name: "Vegetables", icon: <ShoppingOutlined /> },
  { name: "Meat and Poultry", icon: <FireOutlined /> },
  { name: "Fish", icon: <ShopOutlined /> },
  { name: "Spices", icon: <CoffeeOutlined /> },
  { name: "Fruits", icon: <GiftOutlined /> },
  { name: "Rice", icon: <InboxOutlined /> },
  { name: "Pantry", icon: <TagOutlined /> },
  { name: "Other Commodities", icon: <ShoppingOutlined /> },
];

const sortOptions = [
  { value: "name", label: "Name" },
  { value: "price-low", label: "Lowest price" },
  { value: "price-high", label: "Highest price" },
  { value: "best", label: "Best value" },
  { value: "worst", label: "Highest change" },
];

const getPriceSummary = (ingredient) => {
  const prices = [...(ingredient.prices || [])]
    .filter((price) =>
      Number.isFinite(Number(price.avg_price)) &&
      Number.isFinite(new Date(price.date).getTime())
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const latestPrice = prices[0];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const last30Days = prices.filter(
    (price) => new Date(price.date) >= thirtyDaysAgo
  );

  const averagePrice = last30Days.length > 0
    ? last30Days.reduce(
        (sum, price) => sum + Number(price.avg_price),
        0
      ) / last30Days.length
    : null;

  const latestPriceValue = Number(latestPrice?.avg_price || 0);
  const pricePercentage = averagePrice > 0
    ? ((latestPriceValue - averagePrice) / averagePrice) * 100
    : 0;

  return {
    prices,
    latestPrice,
    latestPriceValue,
    averagePrice,
    pricePercentage,
  };
};

const formatDate = (date) => {
  if (!date) return "";

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
};

const Prices = () => {
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [loading, setLoading] = useState(true);
  const [ingredients, setIngredients] = useState([]);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isPending, startTransition] = useTransition();
  const deferredSearch = useDeferredValue(search);

  const getIngredients = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: fetchError } = await supabase
        .from("ingredients")
        .select(`
          id,
          name,
          unit,
          category,
          prices (
            id,
            avg_price,
            date,
            created_at,
            location_id
          )
        `);

      if (fetchError) {
        throw fetchError;
      }

      const nextIngredients = data || [];
      const timestamps = nextIngredients.flatMap((ingredient) =>
        (ingredient.prices || [])
          .map((price) => new Date(price.date).getTime())
          .filter((timestamp) => Number.isFinite(timestamp))
      );

      setIngredients(nextIngredients);
      setLastUpdated(
        timestamps.length ? new Date(Math.max(...timestamps)) : null
      );
    } catch (fetchError) {
      console.error("Error fetching ingredients:", fetchError);
      setIngredients([]);
      setLastUpdated(null);
      setError("We could not load the latest ingredient prices. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getIngredients();
  }, [getIngredients]);

  const preparedIngredients = useMemo(() => {
    return ingredients.map((ingredient) => ({
      ingredient,
      summary: getPriceSummary(ingredient),
    }));
  }, [ingredients]);

  const filteredIngredients = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return preparedIngredients
      .filter(({ ingredient, summary }) =>
        summary.latestPrice &&
        (ingredient.name || "").toLowerCase().includes(query) &&
        (category === "All" || ingredient.category === category)
      )
      .sort((a, b) => {
        if (sortBy === "price-low") {
          return a.summary.latestPriceValue - b.summary.latestPriceValue;
        }

        if (sortBy === "price-high") {
          return b.summary.latestPriceValue - a.summary.latestPriceValue;
        }

        if (sortBy === "best") {
          return a.summary.pricePercentage - b.summary.pricePercentage;
        }

        if (sortBy === "worst") {
          return b.summary.pricePercentage - a.summary.pricePercentage;
        }

        return (a.ingredient.name || "").localeCompare(b.ingredient.name || "");
      });
  }, [category, deferredSearch, preparedIngredients, sortBy]);

  const hasFilters = Boolean(search.trim()) || category !== "All" || sortBy !== "name";

  const clearFilters = () => {
    setSearch("");
    setCategory("All");
    setSortBy("name");
  };

  return (
    <main className="prices-page">
      <PriceHero />

      <section
        className="prices-content"
        aria-label="Ingredient prices"
        aria-busy={loading || isPending}
      >
        <div className="controls-container">
          <div className="price-controls">
            <Input
              className="price-search"
              aria-label="Search ingredients"
              placeholder="Search ingredients"
              prefix={<SearchOutlined />}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              allowClear
            />

            <div className="sort-filters" aria-label="Sort prices">
              <span className="sort-title">Sort by</span>
              {sortOptions.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={sortBy === item.value ? "sort-active" : ""}
                  aria-pressed={sortBy === item.value}
                  onClick={() => startTransition(() => setSortBy(item.value))}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="category-filters" aria-label="Filter by category">
            {categories.map((item) => (
              <button
                type="button"
                key={item.name}
                className={category === item.name ? "category-active" : ""}
                aria-pressed={category === item.name}
                onClick={() => startTransition(() => setCategory(item.name))}
              >
                {item.icon}
                <span>{item.name}</span>
              </button>
            ))}
          </div>

          <div className="results-summary" aria-live="polite">
            <span>
              {loading
                ? "Loading prices"
                : `${filteredIngredients.length} ingredient${filteredIngredients.length === 1 ? "" : "s"}`}
            </span>
            {lastUpdated && !loading && (
              <span>Latest data: {formatDate(lastUpdated)}</span>
            )}
          </div>
        </div>

        {error && (
          <div className="price-message">
            <Alert
              type="error"
              showIcon
              message="Prices are unavailable"
              description={error}
            />
            <Button type="primary" onClick={getIngredients}>
              Try again
            </Button>
          </div>
        )}

        {!error && loading && (
          <div className="ingredient-grid" aria-busy="true">
            {Array.from({ length: 8 }).map((_, index) => (
              <div className="ingredient-skeleton" key={index}>
                <Skeleton
                  active
                  title={{ width: "60%" }}
                  paragraph={{ rows: 4 }}
                />
              </div>
            ))}
          </div>
        )}

        {!error && !loading && filteredIngredients.length === 0 && (
          <div className="price-message empty-price-state">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={hasFilters
                ? "No ingredients match those filters."
                : "No price data is available yet."}
            />
            {hasFilters && (
              <Button onClick={clearFilters}>Clear filters</Button>
            )}
          </div>
        )}

        {!error && !loading && filteredIngredients.length > 0 && (
          <div className="ingredient-grid">
            {filteredIngredients.map(({ ingredient, summary }) => (
              <IngredientCard
                key={ingredient.id}
                name={ingredient.name}
                category={ingredient.category}
                unit={ingredient.unit}
                price={summary.latestPriceValue}
                averagePrice={summary.averagePrice}
                priceHistory={summary.prices}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default Prices;
