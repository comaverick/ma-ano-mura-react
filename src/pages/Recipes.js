import { useMemo, useState, useEffect, useDeferredValue } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Alert, Skeleton } from "antd";
import {
  SearchOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { useMarket } from "../context/MarketContext";
import { loadLinkedRecipe } from "../services/marketData";
import domainCosting from "../domain/costing.js";
import {
  formatMoney,
  formatTime,
  formatDate,
  formatQuantity,
  isStale,
  formatSource,
} from "../utils/format";
import "./Recipes.css";
import RecipeActions from "../components/RecipeActions";
import IngredientMeasurement from "../components/IngredientMeasurement";
import { useKitchen } from "../context/KitchenContext";
import measurementsDomain from "../domain/measurements.js";
import preferences from "../domain/preferences.js";
const { priceRecipe, PRICE_SOURCES } = domainCosting;
const statusLabels = {
  unmatched: "Ingredient not matched",
  "no-price": "No source quote",
  quantity: "Quantity needs review",
  "to-taste": "To taste · excluded",
  water: "Water · excluded",
  priced: "Included",
};
export default function Recipes() {
  const { measurements, profile } = useKitchen();
  const {
    recipes,
    recipesLoading,
    priceIndex,
    ingredients,
    loading,
    error,
    recipeError,
    refresh,
  } = useMarket();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "";
  const source = PRICE_SOURCES.some((s) => s.value === params.get("source"))
    ? params.get("source")
    : "best";
  const deferred = useDeferredValue(query);
  const [servings, setServings] = useState(null);
  const [preferenceOverride, setPreferenceOverride] = useState(null);
  const usePreferences =
    preferenceOverride ?? preferences.hasFoodRules(profile);
  const [detailOverride, setDetailOverride] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const filtered = useMemo(
    () =>
      recipes.filter(
        (recipe) =>
          recipe.name.toLowerCase().includes(deferred.trim().toLowerCase()) &&
          (!usePreferences ||
            preferences.preferenceMatch(recipe, profile).eligible),
      ),
    [recipes, deferred, usePreferences, profile],
  );
  const selected =
    recipes.find((recipe) => recipe.id === params.get("recipe")) ||
    (query
      ? filtered[0]
      : filtered.find((recipe) => /^chicken adobo$/i.test(recipe.name))) ||
    filtered[0];
  const selectedId = selected?.id;
  useEffect(() => {
    setServings(null);
    setDetailOverride(null);
    setDetailError("");
    if (!selectedId || selected?.local) return;
    let active = true;
    setDetailLoading(true);
    loadLinkedRecipe(selectedId)
      .then((links) => {
        if (!active) return;
        const names = new Map(ingredients.map((i) => [i.id, i.name]));
        setDetailOverride(
          links.flatMap((link) => {
            if (link.quantity != null && link.unit)
              return [
                `${link.quantity} ${link.unit} ${names.get(link.ingredient_id) || link.original_name}`,
              ];
            return String(
              link.original_name || names.get(link.ingredient_id) || "",
            )
              .split("|")
              .filter(Boolean);
          }),
        );
      })
      .catch(() => {
        if (active)
          setDetailError(
            "Ingredient details could not be loaded. Choose another recipe or try again later.",
          );
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId, selected?.local, ingredients]);
  const recipe = useMemo(
    () =>
      selected
        ? measurementsDomain.withMeasurements(
            {
              ...selected,
              ingredients: detailOverride || selected.ingredients,
            },
            measurements,
          )
        : null,
    [selected, detailOverride, measurements],
  );
  const requestedServings =
    servings ?? (Number(recipe?.servings) > 0 ? profile.householdSize : null);
  const preferenceCheck = recipe
    ? preferences.preferenceMatch(recipe, profile)
    : null;
  const cost = useMemo(
    () =>
      recipe
        ? priceRecipe(recipe, priceIndex, source, requestedServings)
        : null,
    [recipe, priceIndex, source, requestedServings],
  );
  function update(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "q") next.delete("recipe");
    setParams(next, { replace: true });
  }
  const missingPrices =
    cost?.missing.filter((row) =>
      ["unmatched", "no-price"].includes(row.status),
    ) || [];
  const missingQuantity =
    cost?.missing.filter((row) => row.status === "quantity") || [];
  const stale =
    cost?.rows.filter((row) => row.cost !== null && isStale(row.price?.date)) ||
    [];
  return (
    <main className="page-shell recipes-page">
      <section className="page-intro recipes-intro">
        <div>
          <span className="eyebrow">YOUR NEXT ULAM, FIGURED OUT</span>
          <h1>
            From “anong ulam?”
            <br />
            to <em>kain na.</em>
          </h1>
          <p>
            Find a Filipino favorite, see the ingredients, and work out the
            cost. Simple planning for the food you love.
          </p>
        </div>
        <div className="recipe-intro-note">
          <span aria-hidden="true">🍽️</span>
          <strong>A recipe for every day.</strong>
          <span>
            {recipesLoading
              ? "Loading the collection…"
              : `${recipes.length.toLocaleString()} recipes, ready to explore`}
          </span>
        </div>
      </section>
      <section className="recipes-workspace" aria-label="Recipe collection">
        <aside className="recipe-library">
          <div className="recipe-library-heading">
            <h2>The collection</h2>
            <span>{filtered.length}</span>
          </div>
          <label className="search-field">
            <SearchOutlined />
            <input
              aria-label="Search recipes"
              value={query}
              onChange={(event) => update("q", event.target.value)}
              placeholder="Find your next favorite…"
            />
          </label>
          {preferences.hasFoodRules(profile) && (
            <label className="preference-filter">
              <input
                type="checkbox"
                checked={usePreferences}
                onChange={(event) =>
                  setPreferenceOverride(event.target.checked)
                }
              />
              Use My Kitchen preferences
            </label>
          )}
          <Link className="text-link" to="/my-kitchen">
            My Kitchen preferences →
          </Link>
          <div className="recipe-list" aria-label="Recipes">
            {recipesLoading ? (
              <Skeleton active paragraph={{ rows: 8 }} />
            ) : filtered.length ? (
              filtered.map((recipe) => (
                <button
                  type="button"
                  key={recipe.id}
                  onClick={() => update("recipe", recipe.id)}
                  aria-current={selectedId === recipe.id ? "true" : undefined}
                  className={
                    selectedId === recipe.id ? "recipe-list-active" : ""
                  }
                >
                  <strong>{recipe.name}</strong>
                  <span>
                    {recipe.servings
                      ? `${recipe.servings} servings`
                      : "Servings vary"}
                    <ArrowRightOutlined />
                  </span>
                </button>
              ))
            ) : (
              <p className="state-message">
                {usePreferences
                  ? "No recipes match your search and kitchen preferences."
                  : `No recipes match “${query}”.`}
                <br />
                <button className="text-link" onClick={() => update("q", "")}>
                  Clear search
                </button>
              </p>
            )}
          </div>
        </aside>
        <article
          className="recipe-detail-panel"
          aria-busy={detailLoading || loading}
        >
          {recipeError && <Alert type="error" title={recipeError} showIcon />}
          {recipesLoading ? (
            <Skeleton active paragraph={{ rows: 12 }} />
          ) : recipe && cost ? (
            <>
              <header className="recipe-detail-header">
                <span className="eyebrow">THE ULAM COLLECTION</span>
                <h2>{recipe.name}</h2>
                <div className="recipe-meta-row">
                  <span>
                    <ClockCircleOutlined />
                    {formatTime(recipe)}
                  </span>
                  <span>
                    <TeamOutlined />
                    {recipe.servings
                      ? `${recipe.servings} original servings`
                      : "Servings not listed"}
                  </span>
                </div>
              </header>
              <RecipeActions
                recipe={recipe}
                servings={requestedServings || recipe.servings}
              />
              {preferenceCheck && !preferenceCheck.eligible && (
                <p className="preference-note">
                  <strong>Outside your kitchen preferences.</strong>{" "}
                  {preferenceCheck.conflicts.join(". ")}.{" "}
                  <Link to="/my-kitchen">Edit preferences</Link>
                </p>
              )}
              <div className="recipe-settings">
                <div>
                  <label>Price source</label>
                  <div
                    className="source-tabs"
                    aria-label="Choose recipe price source"
                  >
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
                <label className="servings-control">
                  Servings
                  <input
                    type="number"
                    aria-label="Number of servings"
                    min="1"
                    max="100"
                    disabled={!recipe.servings}
                    value={requestedServings || recipe.servings || ""}
                    onChange={(event) =>
                      setServings(
                        event.target.value
                          ? Math.max(
                              1,
                              Math.min(100, Number(event.target.value)),
                            )
                          : null,
                      )
                    }
                  />
                </label>
              </div>
              {profile.householdSize &&
                servings === null &&
                Number(recipe.servings) > 0 && (
                  <p className="kitchen-hint">
                    Using your household default of {profile.householdSize}{" "}
                    servings. Change it above for this meal.
                  </p>
                )}
              {error && (
                <Alert
                  className="data-warning"
                  type="warning"
                  showIcon
                  title={error}
                  action={<button onClick={refresh}>Retry</button>}
                />
              )}
              {detailError && (
                <Alert
                  className="data-warning"
                  type="error"
                  title={detailError}
                  showIcon
                />
              )}
              <section className="recipe-cost-summary">
                <div>
                  <span>
                    {cost.missing.length
                      ? "KNOWN INGREDIENT SUBTOTAL"
                      : "ESTIMATED INGREDIENT COST"}
                  </span>
                  <strong>
                    {loading
                      ? "…"
                      : cost.pricedCount
                        ? formatMoney(cost.total)
                        : "—"}
                  </strong>
                  <small>
                    {cost.pricedCount && cost.servings
                      ? `${formatMoney(cost.total / cost.servings)} ${cost.missing.length ? "subtotal" : "estimate"} per serving`
                      : "Based on available source quotes"}
                  </small>
                </div>
                <div className="recipe-coverage">
                  <span>
                    {loading
                      ? "Loading prices…"
                      : `${cost.pricedCount} of ${cost.requiredCount} measured ingredients priced`}
                  </span>
                  <div
                    role="progressbar"
                    aria-label="Ingredient price coverage"
                    aria-valuenow={cost.coverage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span style={{ width: `${cost.coverage}%` }} />
                  </div>
                  <p>
                    {cost.missing.length
                      ? "The subtotal excludes unpriced ingredients."
                      : "All listed, measured ingredients are included."}
                  </p>
                </div>
              </section>
              {loading || detailLoading ? (
                <Skeleton active paragraph={{ rows: 8 }} />
              ) : (
                <>
                  {missingPrices.length > 0 && (
                    <div className="recipe-coverage-note">
                      <InfoCircleOutlined />
                      <p>
                        <strong>
                          {missingPrices.length} ingredient
                          {missingPrices.length === 1 ? " has" : "s have"} no
                          verified price.
                        </strong>{" "}
                        {missingPrices
                          .map(
                            (row) =>
                              row.definition?.name ||
                              row.parsed.name ||
                              row.rawName,
                          )
                          .join(", ")}
                        . These are excluded from the subtotal.
                      </p>
                    </div>
                  )}
                  {missingQuantity.length > 0 && (
                    <div className="recipe-coverage-note">
                      <InfoCircleOutlined />
                      <p>
                        <strong>
                          {missingQuantity.length} ingredient
                          {missingQuantity.length === 1 ? " needs" : "s need"} a
                          quantity or unit.
                        </strong>{" "}
                        The recipe doesn’t provide enough information to
                        calculate these costs.
                      </p>
                    </div>
                  )}
                  {stale.length > 0 && (
                    <p className="stale-note">
                      {stale.length} ingredient quote
                      {stale.length === 1 ? " is" : "s are"} older than 7 days.
                      Check the dates below.
                    </p>
                  )}
                  <section className="recipe-ingredients-section">
                    <div className="recipe-section-heading">
                      <h3>Your ingredient list</h3>
                      <span>
                        {cost.servings
                          ? `For ${cost.servings} servings`
                          : "As listed in the recipe"}
                      </span>
                    </div>
                    <div className="recipe-ingredients-table">
                      {cost.rows.map((row) => (
                        <div
                          className={`recipe-ingredient-row row-${row.status}`}
                          key={row.id}
                        >
                          <span className="ingredient-row-check">
                            {row.cost !== null ? <CheckOutlined /> : "—"}
                          </span>
                          <div className="recipe-ingredient-name">
                            <strong>{row.rawName}</strong>
                            <small>
                              {cost.servings &&
                              cost.servings !== Number(recipe.servings)
                                ? `Scaled: ${formatQuantity(row.quantity, row.parsed.unit)} · `
                                : ""}
                              {row.conversion.estimated && row.cost !== null
                                ? `${row.conversion.reason}. `
                                : ""}
                              {row.price
                                ? `${formatSource(row.price.source)} · ${row.price.ingredientName} · ${formatDate(row.price.date)}`
                                : statusLabels[row.status]}
                            </small>
                            <IngredientMeasurement
                              key={`${selectedId}:${row.id}`}
                              recipe={recipe}
                              row={row}
                            />
                          </div>
                          <div className="recipe-ingredient-price">
                            <strong>
                              {row.cost !== null ? formatMoney(row.cost) : "—"}
                            </strong>
                            <small>
                              {row.cost !== null
                                ? row.conversion.estimated
                                  ? "Estimate"
                                  : "Ingredient cost"
                                : row.price && row.status === "quantity"
                                  ? `${formatMoney(row.price.avg_price)} / ${row.definition.unit} · quantity needed`
                                  : statusLabels[row.status]}
                            </small>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="recipe-calculation-note">
                      Costs use the amount needed, rather than the price of a
                      whole pack. Cup, piece, and density conversions are
                      approximate where indicated. Water and seasonings without
                      quantities are excluded. Variable-weight SM packages use a
                      conservative unit estimate based on their minimum stated
                      weight. “Lowest available” uses the lowest recent quote
                      across the two sources.
                    </p>
                  </section>
                  {recipe.instructions?.length > 0 && (
                    <section className="recipe-instructions">
                      <div className="recipe-section-heading">
                        <h3>Let’s get cooking.</h3>
                        <span>{recipe.instructions.length} steps</span>
                      </div>
                      <ol>
                        {recipe.instructions.map((step, index) => (
                          <li key={index}>
                            <span>{String(index + 1).padStart(2, "0")}</span>
                            <p>{step}</p>
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}
                  {!recipe.ingredients.length && !detailLoading && (
                    <p className="state-message">
                      No ingredient details are available for this recipe yet.
                    </p>
                  )}
                  <Link className="text-link recipe-market-link" to="/prices">
                    Explore all ingredient prices <ArrowRightOutlined />
                  </Link>
                </>
              )}
            </>
          ) : (
            <div className="state-message">
              Choose a recipe from the collection to get started.
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
