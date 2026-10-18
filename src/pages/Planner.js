import { useDeferredValue, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert, Skeleton } from "antd";
import {
  ArrowRightOutlined,
  HeartOutlined,
  HeartFilled,
  ShoppingOutlined,
  CalendarOutlined,
  SearchOutlined,
  CheckOutlined,
  LeftOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { useMarket } from "../context/MarketContext";
import { useKitchen } from "../context/KitchenContext";
import planning from "../domain/planning.js";
import catalogDomain from "../domain/ingredientCatalog.js";
import costing from "../domain/costing.js";
import measurementsDomain from "../domain/measurements.js";
import preferences from "../domain/preferences.js";
import {
  formatMoney,
  formatShoppingQuantity,
  formatDate,
} from "../utils/format";
import "./Planner.css";
import PackageEstimate from "../components/PackageEstimate";
const {
  recipeKey,
  recipeForPlan,
  localDate,
  validDate,
  MEAL_SLOTS,
  weekStart,
  shiftDate,
  assessRecipe,
  buildShoppingList,
} = planning;
const { catalog } = catalogDomain;
const { PRICE_SOURCES, priceRecipe } = costing;
const tabs = [
  ["discover", "Find a meal"],
  ["saved", "Saved recipes"],
  ["week", "Weekly plan"],
  ["list", "Shopping list"],
];
const dayLabel = (date, short = false) =>
  new Intl.DateTimeFormat("en-PH", {
    weekday: short ? "short" : "long",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
function pantryStatus(cost) {
  if (cost.shoppingMissing.length)
    return `${cost.shoppingMissing.length} ingredient cost${cost.shoppingMissing.length === 1 ? "" : "s"} missing`;
  if (cost.stale.length) return "Older quotes · check prices";
  return "Serving details need review";
}
export default function Planner() {
  const {
    recipes,
    priceIndex,
    loading,
    recipesLoading,
    error,
    recipeError,
    refresh,
  } = useMarket();
  const kitchen = useKitchen();
  const [params, setParams] = useSearchParams();
  const tab = tabs.some(([key]) => key === params.get("tab"))
    ? params.get("tab")
    : "discover";
  const planDate = validDate(params.get("date"))
    ? params.get("date")
    : localDate();
  const planSlot = MEAL_SLOTS.includes(params.get("slot"))
    ? params.get("slot")
    : "Dinner";
  const targetOccupied = kitchen.plans.some(
    (item) => item.date === planDate && item.slot === planSlot,
  );
  function updateTarget(key, value) {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  }
  const [budgetOverride, setBudget] = useState(null);
  const [servingsOverride, setServings] = useState(null);
  const budget = budgetOverride ?? String(kitchen.profile.mealBudget || 150);
  const servings =
    servingsOverride ?? String(kitchen.profile.householdSize || 3);
  const [preferenceOverride, setPreferenceOverride] = useState(null);
  const usePreferences =
    preferenceOverride ?? preferences.hasFoodRules(kitchen.profile);
  const preferenceMatches = useMemo(
    () =>
      new Map(
        recipes.map((recipe) => [
          recipeKey(recipe),
          preferences.preferenceMatch(recipe, kitchen.profile),
        ]),
      ),
    [recipes, kitchen.profile],
  );
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query);
  const [source, setSource] = useState("best");
  const [sort, setSort] = useState("cost");
  const [pantrySearch, setPantrySearch] = useState("");
  const [week, setWeek] = useState(weekStart());
  const [limit, setLimit] = useState(18);
  const [copyStatus, setCopyStatus] = useState("");
  const baseCosts = useMemo(
    () =>
      recipes.map((raw) => {
        const recipe = measurementsDomain.withMeasurements(
          raw,
          kitchen.measurements,
        );
        return {
          recipe,
          baseCost: priceRecipe(recipe, priceIndex, source),
        };
      }),
    [recipes, priceIndex, source, kitchen.measurements],
  );
  const assessed = useMemo(
    () =>
      baseCosts.map(({ recipe, baseCost }) => ({
        recipe,
        cost: assessRecipe(recipe, priceIndex, {
          servings: Number(servings),
          source,
          pantry: kitchen.pantry,
          baseCost,
        }),
      })),
    [baseCosts, priceIndex, servings, source, kitchen.pantry],
  );
  const validInputs =
    Number(budget) > 0 &&
    Number(budget) <= 1000000 &&
    Number(servings) >= 1 &&
    Number(servings) <= 100 &&
    Number.isInteger(Number(servings));
  const filtered = assessed.filter(
    ({ recipe }) =>
      recipe.name.toLowerCase().includes(search.toLowerCase().trim()) &&
      (!usePreferences || preferenceMatches.get(recipeKey(recipe)).eligible) &&
      (tab !== "saved" || kitchen.favorites.includes(recipeKey(recipe))),
  );
  const matches = filtered
    .filter(
      ({ cost }) =>
        validInputs && cost.ready && cost.subtotal <= Number(budget) + 0.00001,
    )
    .sort(
      (a, b) =>
        (sort === "pantry"
          ? a.cost.additionalIngredients - b.cost.additionalIngredients
          : 0) ||
        a.cost.subtotal - b.cost.subtotal ||
        a.recipe.name.localeCompare(b.recipe.name),
    );
  const partial = filtered
    .filter(({ cost }) => !cost.ready)
    .sort(
      (a, b) =>
        b.cost.pantryCount - a.cost.pantryCount ||
        b.cost.coverage - a.cost.coverage,
    );
  const saved = filtered.filter(({ recipe }) =>
    kitchen.favorites.includes(recipeKey(recipe)),
  );
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => shiftDate(week, i)),
    [week],
  );
  const weekPlans = useMemo(
    () => kitchen.plans.filter((plan) => days.includes(plan.date)),
    [kitchen.plans, days],
  );
  const list = useMemo(
    () =>
      buildShoppingList(weekPlans, recipes, priceIndex, {
        pantry: kitchen.pantry,
        source,
        measurements: kitchen.measurements,
      }),
    [
      weekPlans,
      recipes,
      priceIndex,
      kitchen.pantry,
      source,
      kitchen.measurements,
    ],
  );
  const recipeLookup = new Map(
    recipes.map((recipe) => [recipeKey(recipe), recipe]),
  );
  const pantryOptions = catalog.filter(
    (item) =>
      item.aliases.some((alias) =>
        alias.includes(pantrySearch.toLowerCase().trim()),
      ) || item.name.toLowerCase().includes(pantrySearch.toLowerCase().trim()),
  );
  const checked = list.items.filter((item) =>
    kitchen.checked.includes(`${week}:${item.checkKey}`),
  ).length;
  const setTab = (value) => {
    setParams({ tab: value });
    setLimit(18);
  };
  async function copyList() {
    const text = [
      `Ma-Ano-Mura shopping list · ${dayLabel(week)} to ${dayLabel(days[6])}`,
      ...list.items.map(
        (item) =>
          `${kitchen.checked.includes(`${week}:${item.checkKey}`) ? "[x]" : "[ ]"} ${item.name}: ${item.unknownQuantity ? "check quantity; " : ""}${item.amount ? formatShoppingQuantity(item.amount, item.unit) : "as listed"}${item.missing ? " (cost incomplete)" : ""}`,
      ),
      `${list.complete ? "Estimated ingredient cost" : "Known subtotal"}: ${formatMoney(list.subtotal)}`,
      "Amounts needed, not whole-pack checkout prices. Water and unmeasured seasonings excluded.",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("Shopping list copied.");
    } catch {
      setCopyStatus(
        "Copy is unavailable in this browser. Use Print list to save a PDF.",
      );
    }
  }
  function renderMeals(items, partialList = false) {
    return (
      <>
        <div className="planner-results-grid">
          {items.slice(0, limit).map(({ recipe, cost }) => {
            const favorite = kitchen.favorites.includes(recipeKey(recipe));
            return (
              <article className="planner-recipe" key={recipeKey(recipe)}>
                <div className="planner-recipe-top">
                  <span className={`pill ${cost.ready ? "" : "pill-review"}`}>
                    {cost.ready
                      ? "All shopping costs available"
                      : "Estimate needs review"}
                  </span>
                  <button
                    className="favorite-button"
                    aria-pressed={favorite}
                    aria-label={`${favorite ? "Unsave" : "Save"} ${recipe.name}`}
                    onClick={() => kitchen.toggleFavorite(recipe)}
                  >
                    {favorite ? <HeartFilled /> : <HeartOutlined />}
                  </button>
                </div>
                <Link to={`/recipes?recipe=${encodeURIComponent(recipe.id)}`}>
                  <h3>{recipe.name}</h3>
                </Link>
                <div className="planner-recipe-price">
                  <strong>
                    {cost.toBuy.some((row) => row.cost !== null) || cost.ready
                      ? formatMoney(cost.subtotal)
                      : "Price unavailable"}
                  </strong>
                  <span>
                    {cost.ready
                      ? "estimated to buy"
                      : "known shopping subtotal"}{" "}
                    · {servings || "—"} servings
                  </span>
                </div>
                {validInputs && (cost.ready || cost.subtotal > 0) && (
                  <p>
                    {formatMoney(cost.subtotal / Number(servings))}{" "}
                    {cost.ready ? "estimated to buy" : "subtotal"} per person
                  </p>
                )}
                <p>
                  {cost.pantryCount
                    ? `${cost.pantryCount} ingredient${cost.pantryCount === 1 ? "" : "s"} from your pantry · `
                    : ""}
                  {cost.additionalIngredients} ingredient
                  {cost.additionalIngredients === 1 ? "" : "s"} to buy
                </p>
                {!cost.ready && (
                  <p className="planner-review">
                    {pantryStatus(cost)}
                    {partialList ? " · budget fit unconfirmed" : ""}
                  </p>
                )}
                <p className="planner-hint">
                  {cost.estimated ? "Includes cooking conversions. " : ""}Water
                  & unmeasured seasonings excluded.
                </p>
                <div className="planner-card-links">
                  <Link
                    className="text-link"
                    to={`/recipes?recipe=${encodeURIComponent(recipe.id)}`}
                  >
                    Recipe & meal planning <ArrowRightOutlined />
                  </Link>
                  <button
                    className="text-link"
                    onClick={() => {
                      kitchen.addMeal(
                        recipe,
                        planDate,
                        planSlot,
                        Number(servings),
                      );
                    }}
                    disabled={
                      !validInputs ||
                      loading ||
                      !recipe.ingredients?.length ||
                      !(Number(recipe.servings) > 0)
                    }
                  >
                    {targetOccupied ? "Replace planned meal" : "Plan meal"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        {items.length > limit && (
          <button
            className="button planner-load-more"
            onClick={() => setLimit(limit + 18)}
          >
            Show more meals ({items.length - limit} remaining)
          </button>
        )}
      </>
    );
  }
  return (
    <main className="page-shell planner-page">
      <section className="page-intro planner-intro">
        <div>
          <span className="eyebrow">
            A LITTLE PLANNING. MORE ROOM FOR SARAP.
          </span>
          <h1>
            Your week.
            <br />
            <em>Within reach.</em>
          </h1>
          <p>
            Find meals for your budget, use what’s at home, and turn your week
            into one thoughtful shopping list.
          </p>
        </div>
        <div className="planner-intro-card">
          <CalendarOutlined />
          <strong>{weekPlans.length} meals this week</strong>
          <span>
            {kitchen.favorites.length} saved recipes · {kitchen.pantry.length}{" "}
            pantry ingredients
          </span>
          <small>Saved in this browser. No account needed.</small>
        </div>
      </section>
      <div className="planner-tabs" aria-label="Planner sections">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
            {key === "saved" && kitchen.favorites.length > 0
              ? ` (${kitchen.favorites.length})`
              : ""}
          </button>
        ))}
      </div>
      {(error || recipeError) && (
        <Alert
          className="data-warning"
          type="warning"
          showIcon
          title={error || recipeError}
          action={
            error ? <button onClick={refresh}>Retry prices</button> : undefined
          }
        />
      )}
      <div
        className={`planner-layout ${tab === "week" || tab === "list" ? "planner-layout-summary" : ""}`}
      >
        <aside className="planner-sidebar no-print">
          <section className="planner-controls">
            <span className="eyebrow">MAKE IT YOURS</span>
            <h2>
              {tab === "week" || tab === "list"
                ? "Your kitchen settings"
                : "What’s the budget?"}
            </h2>
            <Link className="text-link" to="/my-kitchen">
              My Kitchen preferences →
            </Link>
            {(tab === "discover" || tab === "saved") && (
              <>
                {preferences.hasFoodRules(kitchen.profile) && (
                  <label className="preference-filter">
                    <input
                      type="checkbox"
                      checked={usePreferences}
                      onChange={(e) => setPreferenceOverride(e.target.checked)}
                    />
                    Use My Kitchen preferences
                  </label>
                )}
                <label>
                  Meal budget (₱)
                  <input
                    type="number"
                    min="1"
                    max="1000000"
                    step="1"
                    value={budget}
                    onChange={(event) => {
                      setBudget(event.target.value);
                      setLimit(18);
                    }}
                  />
                </label>
                <label>
                  People to feed
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={servings}
                    onChange={(event) => {
                      setServings(event.target.value);
                      setLimit(18);
                    }}
                  />
                </label>
                {!validInputs && (
                  <p className="planner-review">
                    Enter a positive budget and 1–100 whole servings.
                  </p>
                )}
              </>
            )}
            <label>
              Price source
              <select
                value={source}
                onChange={(event) => setSource(event.target.value)}
              >
                {PRICE_SOURCES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            {(tab === "discover" || tab === "saved") && (
              <>
                <label>
                  Plan for date
                  <input
                    type="date"
                    value={planDate}
                    onChange={(event) =>
                      updateTarget("date", event.target.value)
                    }
                  />
                </label>
                <label>
                  Meal slot
                  <select
                    value={planSlot}
                    onChange={(event) =>
                      updateTarget("slot", event.target.value)
                    }
                  >
                    {MEAL_SLOTS.map((slot) => (
                      <option key={slot}>{slot}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <p className="planner-hint">
              {targetOccupied
                ? "Adding a recipe replaces the existing meal in this slot. "
                : ""}
              Ingredient amounts, not whole-pack checkout costs. Quotes older
              than 7 days need review.{" "}
              <Link to="/coverage">See price coverage →</Link>
            </p>
          </section>
          <section className="planner-controls pantry-controls">
            <span className="eyebrow">USE WHAT YOU HAVE</span>
            <h2>Your pantry</h2>
            <p className="planner-hint">
              Select ingredients you have enough of for your chosen meals. We’ll
              remove them from shopping costs and your list.
            </p>
            <label className="search-field">
              <SearchOutlined />
              <input
                aria-label="Find pantry ingredients"
                placeholder="Try bawang, rice, toyo…"
                value={pantrySearch}
                onChange={(event) => setPantrySearch(event.target.value)}
              />
            </label>
            {kitchen.pantry.length > 0 && (
              <div className="pantry-selected">
                {kitchen.pantry.map((key) => (
                  <button
                    key={key}
                    onClick={() => kitchen.togglePantry(key)}
                    aria-label={`Remove ${catalog.find((item) => item.key === key)?.name} from pantry`}
                  >
                    {catalog.find((item) => item.key === key)?.name} ×
                  </button>
                ))}
              </div>
            )}
            <div className="pantry-options">
              {pantryOptions.map((item) => (
                <label key={item.key}>
                  <input
                    type="checkbox"
                    checked={kitchen.pantry.includes(item.key)}
                    onChange={() => kitchen.togglePantry(item.key)}
                  />
                  <span>{item.name}</span>
                </label>
              ))}
              {!pantryOptions.length && (
                <p className="planner-hint">
                  No matching ingredient. Try another name.
                </p>
              )}
            </div>
          </section>
        </aside>
        <section className="planner-content">
          {tab === "discover" || tab === "saved" ? (
            <>
              <div className="planner-result-heading">
                <div>
                  <span className="eyebrow">
                    {tab === "saved"
                      ? "YOUR LITTLE COLLECTION"
                      : "TODAY’S POSSIBILITIES"}
                  </span>
                  <h2>
                    {tab === "saved"
                      ? "Keep your favorites close."
                      : "Good meals. Sensible spending."}
                  </h2>
                </div>
                <span className="planner-count">
                  {loading || recipesLoading
                    ? "Loading…"
                    : `${tab === "saved" ? saved.length : matches.length} meals`}
                </span>
              </div>
              <div className="planner-result-tools">
                <label className="search-field">
                  <SearchOutlined />
                  <input
                    aria-label="Search planner recipes"
                    placeholder="Search recipes…"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setLimit(18);
                    }}
                  />
                </label>
                {tab === "discover" && (
                  <label>
                    Sort by
                    <select
                      aria-label="Sort meal suggestions"
                      value={sort}
                      onChange={(event) => setSort(event.target.value)}
                    >
                      <option value="cost">Lowest shopping cost</option>
                      <option value="pantry">Fewest ingredients to buy</option>
                    </select>
                  </label>
                )}
              </div>
              {loading || recipesLoading ? (
                <Skeleton active paragraph={{ rows: 10 }} />
              ) : tab === "saved" ? (
                saved.length ? (
                  renderMeals(saved)
                ) : (
                  <div className="planner-empty">
                    <HeartOutlined />
                    <h3>
                      {kitchen.favorites.length
                        ? "No saved meals match these filters."
                        : "Make room for your favorites."}
                    </h3>
                    <p>
                      {kitchen.favorites.length
                        ? "Try another search or turn off My Kitchen preferences to see all your saved meals."
                        : "Tap the heart on a meal or save a recipe from its detail page."}
                    </p>
                    <button
                      className="button button-dark"
                      onClick={() => setTab("discover")}
                    >
                      Find a meal
                    </button>
                  </div>
                )
              ) : (
                <>
                  <p className="planner-result-note">
                    {validInputs
                      ? `Up to ${formatMoney(budget)} for ${servings} people, after pantry ingredients. `
                      : "Enter your budget and servings to find meals. "}
                    Complete shopping estimates use recent available quotes;
                    actual store prices vary.
                  </p>
                  {matches.length ? (
                    renderMeals(matches)
                  ) : (
                    <div className="planner-empty">
                      <SearchOutlined />
                      <h3>No confirmed budget matches yet.</h3>
                      <p>
                        Try a larger budget, fewer servings, another price
                        source, or add ingredients you already have.
                        {usePreferences &&
                          " You can also adjust My Kitchen preferences."}
                      </p>
                    </div>
                  )}
                  {partial.length > 0 && validInputs && (
                    <details className="planner-partial">
                      <summary>
                        {partial.length} more recipes need price or quantity
                        review
                      </summary>
                      <p className="planner-result-note">
                        These subtotals don’t confirm that the recipe fits your
                        budget. Open the recipe to review missing costs.
                      </p>
                      {renderMeals(partial, true)}
                    </details>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <div className="planner-result-heading">
                <div>
                  <span className="eyebrow">
                    {tab === "list"
                      ? "ONE LIST. LESS GUESSWORK."
                      : "A WEEK TO LOOK FORWARD TO"}
                  </span>
                  <h2>
                    {tab === "list"
                      ? "Your shopping list."
                      : "Make a little meal plan."}
                  </h2>
                </div>
                {tab === "list" ? <ShoppingOutlined /> : <CalendarOutlined />}
              </div>
              <div className="planner-week-selector">
                <button
                  className="button"
                  aria-label="Previous week"
                  onClick={() => setWeek(shiftDate(week, -7))}
                >
                  <LeftOutlined />
                </button>
                <strong>
                  {dayLabel(week, true)} – {dayLabel(days[6], true)}
                </strong>
                <button
                  className="button"
                  aria-label="Next week"
                  onClick={() => setWeek(shiftDate(week, 7))}
                >
                  <RightOutlined />
                </button>
                <button
                  className="text-link"
                  onClick={() => setWeek(weekStart())}
                >
                  This week
                </button>
              </div>
              {loading || recipesLoading ? (
                <Skeleton active paragraph={{ rows: 10 }} />
              ) : (
                <>
                  <div className="planner-week-summary">
                    <div>
                      <span>
                        {list.complete
                          ? "ESTIMATED TO BUY"
                          : "KNOWN SHOPPING SUBTOTAL"}
                      </span>
                      <strong>
                        {weekPlans.length ? formatMoney(list.subtotal) : "—"}
                      </strong>
                      <small>
                        {weekPlans.length} planned meals · {list.items.length}{" "}
                        ingredients to buy
                        {kitchen.pantry.length ? " · pantry excluded" : ""}
                      </small>
                    </div>
                    <label>
                      Weekly grocery budget (₱)
                      <input
                        type="number"
                        min="1"
                        max="1000000"
                        placeholder="Set your budget"
                        value={kitchen.budgets[week] || ""}
                        onChange={(event) =>
                          kitchen.setBudget(week, event.target.value)
                        }
                      />
                    </label>
                  </div>
                  {kitchen.budgets[week] > 0 && weekPlans.length > 0 && (
                    <p
                      className={
                        list.subtotal > kitchen.budgets[week]
                          ? "planner-review"
                          : "planner-result-note"
                      }
                    >
                      {list.subtotal > kitchen.budgets[week]
                        ? `${formatMoney(list.subtotal - kitchen.budgets[week])} over your weekly budget${list.complete ? "" : " already, before missing costs"}.`
                        : list.complete
                          ? `${formatMoney(kitchen.budgets[week] - list.subtotal)} left in your ingredient budget. Check pack sizes before checkout.`
                          : "Budget fit is unconfirmed until missing costs and older quotes are reviewed."}
                    </p>
                  )}
                  {!list.complete && weekPlans.length > 0 && (
                    <p className="planner-review">
                      {list.missing} shopping ingredient
                      {list.missing === 1 ? "" : "s"} with incomplete costs.
                      {list.stale ? " Some quotes are older than 7 days." : ""}
                      {list.unresolvedMeals
                        ? ` ${list.unresolvedMeals} meal details could not be found.`
                        : ""}
                    </p>
                  )}
                  <p className="planner-hint">
                    Costs cover the amounts needed. Whole packs, water and
                    unmeasured seasonings may add to your checkout total.
                  </p>
                  {tab === "list" && (
                    <PackageEstimate
                      list={list}
                      source={source}
                      budget={kitchen.budgets[week]}
                    />
                  )}
                  {tab === "week" ? (
                    <>
                      <div className="planner-days">
                        {days.map((date) => (
                          <section
                            className={`planner-day ${date === localDate() ? "planner-today" : ""}`}
                            key={date}
                          >
                            <h3>
                              {dayLabel(date)}
                              {date === localDate() && (
                                <span className="pill">Today</span>
                              )}
                            </h3>
                            {["Breakfast", "Lunch", "Dinner"].map((slot) => {
                              const plan = weekPlans.find(
                                (item) =>
                                  item.date === date && item.slot === slot,
                              );
                              const rawRecipe =
                                plan && recipeForPlan(plan, recipeLookup);
                              const recipe =
                                rawRecipe &&
                                measurementsDomain.withMeasurements(
                                  rawRecipe,
                                  kitchen.measurements,
                                );
                              const cost = recipe
                                ? assessRecipe(recipe, priceIndex, {
                                    servings: plan.servings,
                                    source,
                                    pantry: kitchen.pantry,
                                  })
                                : null;
                              return (
                                <div className="planner-slot" key={slot}>
                                  <span>{slot}</span>
                                  {plan ? (
                                    <>
                                      <div>
                                        {recipe?.id ? (
                                          <Link
                                            to={`/recipes?recipe=${encodeURIComponent(recipe.id)}`}
                                          >
                                            {recipe.name}
                                          </Link>
                                        ) : (
                                          <strong>
                                            {recipe?.name ||
                                              "Recipe unavailable"}
                                          </strong>
                                        )}
                                        <small>
                                          {plan.servings} servings ·{" "}
                                          {cost
                                            ? `${formatMoney(cost.subtotal)} ${cost.ready ? "estimate" : "subtotal · review costs"}`
                                            : "details need review"}
                                        </small>
                                      </div>
                                      <button
                                        className="text-link"
                                        aria-label={`Remove ${slot.toLowerCase()} on ${date}`}
                                        onClick={() =>
                                          kitchen.removeMeal(date, slot)
                                        }
                                      >
                                        Remove
                                      </button>
                                    </>
                                  ) : (
                                    <Link
                                      className="planner-add-slot"
                                      to={`/planner?tab=discover&date=${date}&slot=${slot}`}
                                    >
                                      + Choose a recipe
                                    </Link>
                                  )}
                                </div>
                              );
                            })}
                          </section>
                        ))}
                      </div>
                      <button
                        className="button button-dark planner-load-more"
                        onClick={() => setTab("list")}
                      >
                        Build my shopping list <ArrowRightOutlined />
                      </button>
                    </>
                  ) : (
                    <>
                      {weekPlans.length ? (
                        list.items.length ? (
                          <>
                            <div className="shopping-toolbar no-print">
                              <span>
                                {checked}/{list.items.length} checked off
                              </span>
                              <button className="button" onClick={copyList}>
                                Copy list
                              </button>
                              <button
                                className="button button-dark"
                                onClick={() => window.print()}
                              >
                                Print list
                              </button>
                            </div>
                            <p role="status" className="planner-hint">
                              {copyStatus}
                            </p>
                            <div className="shopping-items">
                              {list.items.map((item) => (
                                <article
                                  className={`shopping-item ${kitchen.checked.includes(`${week}:${item.checkKey}`) ? "shopping-checked" : ""}`}
                                  key={item.key}
                                >
                                  <label>
                                    <input
                                      type="checkbox"
                                      checked={kitchen.checked.includes(
                                        `${week}:${item.checkKey}`,
                                      )}
                                      onChange={() =>
                                        kitchen.toggleChecked(
                                          `${week}:${item.checkKey}`,
                                        )
                                      }
                                    />
                                    <div>
                                      <strong>{item.name}</strong>
                                      <span>
                                        {item.amount
                                          ? formatShoppingQuantity(
                                              item.amount,
                                              item.unit,
                                            )
                                          : "Quantity not specified"}
                                        {item.unknownQuantity && item.amount > 0
                                          ? " + an unspecified amount"
                                          : ""}
                                        {item.estimated
                                          ? " · approximate conversion"
                                          : ""}
                                      </span>
                                      <small>
                                        For {item.recipes.join(", ")}
                                      </small>
                                      <details>
                                        <summary>
                                          Recipe quantities & price dates
                                        </summary>
                                        {item.raw.map((raw) => (
                                          <p key={raw}>{raw}</p>
                                        ))}
                                        {item.quotes.map((quote) => (
                                          <p
                                            key={`${quote.source}:${quote.date}`}
                                          >
                                            {quote.source} ·{" "}
                                            {formatDate(quote.date)}
                                          </p>
                                        ))}
                                      </details>
                                    </div>
                                  </label>
                                  <div className="shopping-item-price">
                                    <strong>
                                      {item.missing && !item.subtotal
                                        ? "—"
                                        : formatMoney(item.subtotal)}
                                    </strong>
                                    <small>
                                      {item.missing
                                        ? "Incomplete cost"
                                        : item.stale
                                          ? "Older quote"
                                          : "Ingredient estimate"}
                                    </small>
                                  </div>
                                </article>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="planner-empty">
                            <CheckOutlined />
                            <h3>
                              {list.unresolvedMeals
                                ? "Meal details need review."
                                : "Your pantry has you covered."}
                            </h3>
                            <p>
                              {list.unresolvedMeals
                                ? "Remove unavailable meals and choose recipes with ingredient details."
                                : "All required ingredients are marked as available at home. Check you have enough for the full plan."}
                            </p>
                          </div>
                        )
                      ) : (
                        <div className="planner-empty">
                          <ShoppingOutlined />
                          <h3>A good list starts with a meal.</h3>
                          <p>
                            Add recipes to your weekly plan. Shared ingredients
                            and quantities will be combined here.
                          </p>
                          <button
                            className="button button-dark"
                            onClick={() => setTab("discover")}
                          >
                            Find a meal
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
