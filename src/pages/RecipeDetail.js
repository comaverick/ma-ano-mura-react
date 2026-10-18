import { useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams, useLocation, Link } from "react-router-dom";
import { Alert, Skeleton } from "antd";
import {
  ArrowLeftOutlined,
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
import RecipePhoto from "../components/RecipePhoto";
import { getRecipePhoto } from "../domain/recipePhotos";
const { priceRecipe, PRICE_SOURCES } = domainCosting;
const statusLabels = {
  unmatched: "Ingredient not matched",
  "no-price": "No source quote",
  quantity: "Quantity needs review",
  "to-taste": "To taste · excluded",
  water: "Water · excluded",
  priced: "Included",
};
export default function RecipeDetail({ onBack }) {
  const heading = useRef(null);
  const location = useLocation();
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
  const ingredientRef = useRef(ingredients);
  ingredientRef.current = ingredients;
  const [params, setParams] = useSearchParams();
  const source = PRICE_SOURCES.some((s) => s.value === params.get("source"))
    ? params.get("source")
    : "best";
  const [servings, setServings] = useState(null);
  const [detailOverride, setDetailOverride] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const selected = recipes.find((recipe) => recipe.id === params.get("recipe"));
  const selectedId = selected?.id;
  useEffect(() => {
    setServings(null);
    setDetailOverride(null);
    setDetailError("");
    setDetailLoading(false);
    heading.current?.focus({ preventScroll: true });
    if (!selectedId || selected?.local) return;
    let active = true;
    setDetailLoading(true);
    loadLinkedRecipe(selectedId)
      .then((links) => {
        if (!active) return;
        const names = new Map(ingredientRef.current.map((i) => [i.id, i.name]));
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
  }, [selectedId, selected?.local]);
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
  const fromBrowse = Number(params.get("servings"));
  const browseServings =
    Number.isInteger(fromBrowse) && fromBrowse >= 1 && fromBrowse <= 100
      ? fromBrowse
      : null;
  const requestedServings =
    servings ??
    (Number(recipe?.servings) > 0
      ? browseServings || profile.householdSize
      : null);
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
    setParams(next, { replace: true, state: location.state });
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
  const photo = getRecipePhoto(recipe);
  return (
    <main className="page-shell recipe-detail-page">
      <div className="recipe-breadcrumb">
        <button type="button" className="text-link" onClick={onBack}>
          <ArrowLeftOutlined aria-hidden="true" /> Back to recipes
        </button>
        <span>YOUR NEXT GOOD MEAL</span>
      </div>
      <article
        className="recipe-detail-panel"
        aria-busy={detailLoading || loading}
      >
        {recipeError && <Alert type="error" title={recipeError} showIcon />}
        {recipesLoading ? (
          <Skeleton active paragraph={{ rows: 12 }} />
        ) : recipe && cost ? (
          <>
            {photo && (
              <figure className="recipe-detail-photo">
                <RecipePhoto
                  recipe={recipe}
                  priority
                  detail
                  sizes="(max-width: 800px) 100vw, 1100px"
                />
                <figcaption>
                  {photo.label} · Serving suggestion; your recipe may look
                  different. Photo by{" "}
                  <a href={photo.source} target="_blank" rel="noreferrer">
                    {photo.author}
                  </a>
                  {" · "}
                  <a href={photo.licenseUrl} target="_blank" rel="noreferrer">
                    {photo.license}
                  </a>
                </figcaption>
              </figure>
            )}
            <header className="recipe-detail-header">
              <span className="eyebrow">THE ULAM COLLECTION</span>
              <h1 ref={heading} tabIndex={-1}>
                {recipe.name}
              </h1>
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
                        ? Math.max(1, Math.min(100, Number(event.target.value)))
                        : null,
                    )
                  }
                />
              </label>
            </div>
            {(browseServings || profile.householdSize) &&
              servings === null &&
              Number(recipe.servings) > 0 && (
                <p className="kitchen-hint">
                  Using your{" "}
                  {browseServings ? "browse setting" : "household default"} of{" "}
                  {requestedServings} servings. Change it above for this meal.
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
                      The recipe doesn’t provide enough information to calculate
                      these costs.
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
            <h1>That recipe isn’t available.</h1>
            <p>Head back to the collection to choose another meal.</p>
            <button className="button button-dark" onClick={onBack}>
              Browse recipes
            </button>
          </div>
        )}
      </article>
    </main>
  );
}
