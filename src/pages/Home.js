import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, Skeleton } from "antd";
import {
  ArrowRightOutlined,
  SearchOutlined,
  CheckOutlined,
  LineChartOutlined,
  ShopOutlined,
} from "@ant-design/icons";
import { useMarket } from "../context/MarketContext";
import domainCosting from "../domain/costing.js";
import { CATEGORIES } from "../domain/categories";
import {
  formatMoney,
  formatDate,
  isStale,
  formatSource,
} from "../utils/format";
import RecipeCard from "../components/RecipeCard/RecipeCard";
import RecipePhoto from "../components/RecipePhoto";
import "./Home.css";
import { useKitchen } from "../context/KitchenContext";
import measurementsDomain from "../domain/measurements.js";
import preferences from "../domain/preferences.js";
const { getLatestPrice, priceRecipe } = domainCosting;
const heroDish = { name: "Chicken adobo", ingredients: ["1 kg chicken"] };
export default function Home() {
  const { measurements, profile, pantry, favorites } = useKitchen();
  const {
    recipes,
    priceIndex,
    loading,
    recipesLoading,
    error,
    recipeError,
    refresh,
  } = useMarket();
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState("recipes");
  const navigate = useNavigate();
  const personalized =
    preferences.hasProfile(profile) ||
    pantry.length > 0 ||
    favorites.length > 0;
  const recommendations = useMemo(
    () =>
      personalized
        ? preferences.recommendRecipes(recipes, priceIndex, {
            profile,
            pantry,
            favorites,
            measurements,
          })
        : [],
    [
      personalized,
      recipes,
      priceIndex,
      profile,
      pantry,
      favorites,
      measurements,
    ],
  );
  const featured = useMemo(() => {
    if (personalized) return recommendations.map((item) => item.recipe);
    const selected = [];
    for (const pattern of [
      /^chicken adobo$/i,
      /^Authentic Sinigang na Baboy$/i,
      /^ginataang kalabasa$/i,
    ]) {
      const recipe = recipes.find((r) => pattern.test(r.name));
      if (recipe) selected.push(recipe);
    }
    return [
      ...selected,
      ...recipes.filter(
        (r) => !selected.includes(r) && /adobo|sinigang|ginataan/i.test(r.name),
      ),
    ].slice(0, 3);
  }, [recipes, personalized, recommendations]);
  const watch = useMemo(
    () =>
      ["tomato", "chicken", "garlic", "rice"]
        .map((key) => priceIndex.get(key))
        .filter(Boolean)
        .map((entry) => ({ ...entry, price: getLatestPrice(entry) }))
        .filter((entry) => entry.price),
    [priceIndex],
  );
  const observed = [...priceIndex.values()]
    .map((entry) => getLatestPrice(entry))
    .filter(Boolean);
  const lastUpdated = observed
    .map((price) => price.date)
    .sort()
    .at(-1);
  const pricedCount = observed.length;
  const heroCost = featured[0]
    ? priceRecipe(
        measurementsDomain.withMeasurements(featured[0], measurements),
        priceIndex,
        "best",
        profile.householdSize,
      )
    : null;
  function search(event) {
    event.preventDefault();
    navigate(`/${searchType}?q=${encodeURIComponent(query.trim())}`);
  }
  return (
    <main className="home-page">
      <div className="page-shell">
        <section className="home-hero">
          <div className="home-hero-copy">
            <span className="eyebrow">
              <span className="status-dot" /> A LITTLE PLANNING. A LOT OF SARAP.
            </span>
            <h1>
              Good food.
              <br />
              Better <em>budget.</em>
            </h1>
            <p>
              Find your next ulam, explore NCR market prices, and know what’s
              going into your meal — and your budget.
            </p>
            <form className="home-search" onSubmit={search}>
              <div className="home-search-tabs" aria-label="Search for">
                <button
                  type="button"
                  aria-pressed={searchType === "recipes"}
                  onClick={() => setSearchType("recipes")}
                >
                  Find a recipe
                </button>
                <button
                  type="button"
                  aria-pressed={searchType === "prices"}
                  onClick={() => setSearchType("prices")}
                >
                  Check an ingredient
                </button>
              </div>
              <div className="home-search-input">
                <SearchOutlined />
                <input
                  aria-label={
                    searchType === "recipes"
                      ? "Search recipes"
                      : "Search ingredient prices"
                  }
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    searchType === "recipes"
                      ? "What are you craving? Try adobo…"
                      : "What’s on your list? Try tomatoes…"
                  }
                />
                <button type="submit" aria-label="Search">
                  <ArrowRightOutlined />
                </button>
              </div>
            </form>
            <div className="hero-quick-links">
              <span>On the menu:</span>
              {["Adobo", "Sinigang", "Ginataan"].map((name) => (
                <Link key={name} to={`/recipes?q=${name}`}>
                  {name}
                  <ArrowRightOutlined />
                </Link>
              ))}
            </div>
            <div className="hero-source-note">
              <CheckOutlined /> Real source prices <span>·</span> Daily
              collection schedule <span>·</span> Made for NCR
            </div>
          </div>
          <div className="home-hero-visual">
            <div className="hero-image-frame">
              <RecipePhoto
                recipe={featured[0] || heroDish}
                priority
                detail
                sizes="(max-width: 800px) 100vw, 600px"
              />
              <span className="hero-photo-label">A CLASSIC FOR A REASON</span>
            </div>
            <div className="hero-stamp">
              Kain tayo!<span>MEALS THAT MAKE SENSE</span>
            </div>
            <Link
              to={
                featured[0]
                  ? `/recipes?recipe=${encodeURIComponent(featured[0].id)}`
                  : "/recipes"
              }
              className="hero-meal-card"
            >
              <span className="hero-meal-icon">🍽️</span>
              <div>
                <small>YOUR NEXT FAMILY FAVORITE</small>
                <strong>{featured[0]?.name || "Find your next ulam"}</strong>
                <span>
                  {loading
                    ? "Fetching market prices…"
                    : heroCost?.pricedCount
                      ? `${formatMoney(heroCost.total)} ${heroCost.missing.length ? "priced subtotal" : "estimated cost"} · ${heroCost.pricedCount}/${heroCost.requiredCount} ingredients`
                      : "Explore recipes and ingredient costs"}
                </span>
              </div>
              <ArrowRightOutlined />
            </Link>
          </div>
        </section>
        <section className="home-stats" aria-label="At a glance">
          <div>
            <strong>
              {recipesLoading ? "—" : recipes.length.toLocaleString()}
            </strong>
            <span>recipes to explore</span>
          </div>
          <div>
            <strong>{loading ? "—" : pricedCount}</strong>
            <span>ingredients with price data</span>
          </div>
          <div>
            <strong>
              2<span> trusted sources</span>
            </strong>
            <span>DA market monitoring + SM Supermarkets</span>
          </div>
          <div className="home-stat-note">
            <LineChartOutlined />
            <span>
              Small choices.
              <br />
              <b>Smarter everyday meals.</b>
            </span>
          </div>
        </section>
        {(error || recipeError) && (
          <Alert
            className="data-warning"
            type="warning"
            showIcon
            title={error || recipeError}
            action={
              error && (
                <button className="text-link" onClick={refresh}>
                  Retry
                </button>
              )
            }
          />
        )}
        <section className="home-recipes">
          <div className="home-kitchen-banner">
            <span className="home-kitchen-icon" aria-hidden="true">
              🥬
            </span>
            <div>
              <strong>
                {personalized
                  ? "A little more your kind of cooking."
                  : "Make this kitchen feel like yours."}
              </strong>
              <p>
                {profile.householdSize
                  ? `Meals for ${profile.householdSize}. `
                  : ""}
                {personalized
                  ? "Your tastes, pantry, and saved recipes shape the suggestions below."
                  : "Set your household size, favorite foods, and cooking preferences."}
              </p>
            </div>
            <Link className="text-link" to="/my-kitchen">
              {personalized ? "Edit My Kitchen" : "Set up My Kitchen"}{" "}
              <ArrowRightOutlined />
            </Link>
          </div>
          <div className="home-planner-banner">
            <div>
              <span className="eyebrow">MEET YOUR EVERYDAY MEAL PLANNER</span>
              <h2>What can your budget cook?</h2>
              <p>
                Find meals within your budget, use your pantry, and make one
                shopping list for the week.
              </p>
            </div>
            <Link className="button button-dark" to="/planner">
              Plan my meals <ArrowRightOutlined />
            </Link>
          </div>
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {personalized
                  ? "BASED ON YOUR KITCHEN"
                  : "FROM OUR RECIPE COLLECTION"}
              </span>
              <h2>
                {personalized
                  ? "Picked for your kitchen."
                  : "A little inspiration for your table."}
              </h2>
              <p>
                {personalized
                  ? `${profile.householdSize ? `For ${profile.householdSize} people. ` : ""}${profile.mealBudget ? `Meal budget: ${formatMoney(profile.mealBudget)} after pantry ingredients. ` : ""}Only complete, recent shopping estimates confirm a budget fit.`
                  : "Familiar flavors, with ingredient costs you can actually check."}
              </p>
            </div>
            <Link className="text-link" to="/recipes">
              Explore all recipes <ArrowRightOutlined />
            </Link>
          </div>
          <div className="home-recipe-grid">
            {recipesLoading
              ? Array.from({ length: 3 }, (_, i) => (
                  <Skeleton.Node
                    key={i}
                    active
                    style={{ width: "100%", height: 300 }}
                  />
                ))
              : featured.map((recipe, index) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    index={index}
                    recommendation={
                      personalized ? recommendations[index] : null
                    }
                  />
                ))}
          </div>
          {!recipesLoading &&
            !recipeError &&
            personalized &&
            !featured.length && (
              <div className="home-recommendation-empty">
                <h3>No recipes fit these preferences yet.</h3>
                <p>
                  Try a longer cooking time, a higher meal budget, or fewer
                  exclusions.
                </p>
                <Link className="text-link" to="/my-kitchen">
                  Adjust my preferences <ArrowRightOutlined />
                </Link>
              </div>
            )}
        </section>
        <section className="home-market">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE MARKET, AT A GLANCE</span>
              <h2>A peek at your shopping list.</h2>
              <p>
                {loading
                  ? "Loading source observations…"
                  : lastUpdated
                    ? `Latest available observation: ${formatDate(lastUpdated)}${isStale(lastUpdated) ? " · Older data — check dates before shopping." : ""}`
                    : "Prices appear here when source data is available."}
              </p>
            </div>
            <Link className="text-link" to="/prices">
              All ingredient prices <ArrowRightOutlined />
            </Link>
          </div>
          <div className="market-watch-grid">
            {loading
              ? Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} active paragraph={{ rows: 2 }} />
                ))
              : watch.map(({ definition, price }) => (
                  <Link
                    className="market-watch-card"
                    key={definition.key}
                    to={`/prices?q=${encodeURIComponent(definition.name)}`}
                  >
                    <div>
                      <span>{definition.category}</span>
                      <ArrowRightOutlined />
                    </div>
                    <h3>{definition.name}</h3>
                    <strong>
                      {formatMoney(price.avg_price)}
                      <small> / {definition.unit}</small>
                    </strong>
                    <p>
                      {formatSource(price.source)} · {formatDate(price.date)}
                    </p>
                  </Link>
                ))}
          </div>
          {!loading && !watch.length && (
            <p className="state-message">
              No price observations are available yet.
            </p>
          )}
        </section>
        <section className="home-categories">
          <div className="section-heading">
            <div>
              <span className="eyebrow">START WITH AN INGREDIENT</span>
              <h2>What’s in your basket?</h2>
            </div>
            <Link to="/categories" className="text-link">
              Browse all categories <ArrowRightOutlined />
            </Link>
          </div>
          <div className="home-category-grid">
            {CATEGORIES.slice(0, 4).map((category) => (
              <Link
                key={category.name}
                to={`/prices?category=${encodeURIComponent(category.name)}`}
              >
                <span
                  className="category-emoji"
                  style={{ background: category.color }}
                  aria-hidden="true"
                >
                  {category.emoji}
                </span>
                <strong>{category.label}</strong>
                <small>
                  {loading
                    ? "Explore prices"
                    : `${[...priceIndex.values()].filter((item) => item.definition.category === category.name).length} catalog items`}
                </small>
                <ArrowRightOutlined />
              </Link>
            ))}
          </div>
        </section>
        <section className="home-bottom">
          <div>
            <span className="eyebrow">COOK WITH A LITTLE MORE CONFIDENCE</span>
            <h2>
              Less guesswork.
              <br />
              More room for <em>sarap.</em>
            </h2>
            <p>Choose a recipe. Check the costs. Make it yours.</p>
          </div>
          <Link className="button button-lime" to="/recipes">
            Let’s find your next meal <ArrowRightOutlined />
          </Link>
          <ShopOutlined className="bottom-illustration" />
        </section>
      </div>
    </main>
  );
}
