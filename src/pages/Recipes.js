import { useMemo, useEffect, useRef, useDeferredValue } from "react";
import {
  useSearchParams,
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { Alert, Skeleton } from "antd";
import {
  SearchOutlined,
  ArrowRightOutlined,
  ReloadOutlined,
  HeartOutlined,
  SlidersOutlined,
} from "@ant-design/icons";
import { useMarket } from "../context/MarketContext";
import { useKitchen } from "../context/KitchenContext";
import discovery from "../domain/discovery.js";
import preferences from "../domain/preferences.js";
import costing from "../domain/costing.js";
import DiscoveryCard from "../components/DiscoveryCard";
import RecipeDetail from "./RecipeDetail";
import "./Recipes.css";
const { RECIPE_GROUPS, assessDiscovery, filterDiscovery } = discovery;
const positive = (value, max = 1000000) =>
  value !== null &&
  value !== "" &&
  Number.isFinite(Number(value)) &&
  Number(value) > 0 &&
  Number(value) <= max
    ? Number(value)
    : null;
export default function Recipes() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate(),
    location = useLocation();
  const scroll = useRef(0);
  const selected = params.get("recipe");
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      window.scrollTo({
        top: selected ? 0 : scroll.current,
        behavior: "instant",
      }),
    );
    return () => cancelAnimationFrame(frame);
  }, [selected]);
  function back() {
    if (location.state?.recipeBrowser) navigate(-1);
    else {
      const next = new URLSearchParams(params);
      next.delete("recipe");
      setParams(next, { replace: true });
    }
  }
  return selected ? (
    <RecipeDetail key={selected} onBack={back} />
  ) : (
    <RecipeBrowser
      onOpen={() => {
        scroll.current = window.scrollY;
      }}
    />
  );
}
function RecipeBrowser({ onOpen }) {
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
  const query = params.get("q") || "",
    deferred = useDeferredValue(query);
  const group = RECIPE_GROUPS.some(([key]) => key === params.get("group"))
    ? params.get("group")
    : query.trim()
      ? "all"
      : "ulam";
  const sort = ["recommended", "time", "cost", "pantry", "name"].includes(
    params.get("sort"),
  )
    ? params.get("sort")
    : "recommended";
  const maxMinutes = [15, 30, 45, 60, 90, 120].includes(
    Number(params.get("time")),
  )
    ? Number(params.get("time"))
    : null;
  const servings = positive(params.get("servings"), 100);
  const defaultServings = kitchen.profile.householdSize || 4;
  const targetServings = servings || defaultServings;
  const budget = positive(params.get("budget"));
  const invalidInputs =
    (params.has("budget") && !budget) ||
    (params.has("servings") && (!servings || !Number.isInteger(servings)));
  const usePreferences =
    params.get("preferences") === "off"
      ? false
      : params.get("preferences") === "on" ||
        preferences.hasFoodRules(kitchen.profile);
  const priced = params.get("priced") === "1",
    saved = params.get("saved") === "1";
  const page = Math.max(
    1,
    Math.min(200, Math.floor(positive(params.get("page"), 200) || 1)),
  );
  const source = costing.PRICE_SOURCES.some(
    (item) => item.value === params.get("source"),
  )
    ? params.get("source")
    : "best";
  const entries = useMemo(
    () =>
      assessDiscovery(recipes, priceIndex, {
        profile: kitchen.profile,
        pantry: kitchen.pantry,
        measurements: kitchen.measurements,
        source,
        servings: targetServings,
      }),
    [
      recipes,
      priceIndex,
      kitchen.profile,
      kitchen.pantry,
      kitchen.measurements,
      source,
      targetServings,
    ],
  );
  const results = useMemo(
    () =>
      invalidInputs
        ? []
        : filterDiscovery(entries, {
            query: deferred,
            group,
            sort,
            maxMinutes,
            budget,
            usePreferences,
            priced,
            saved,
            favorites: kitchen.favorites,
          }),
    [
      entries,
      deferred,
      group,
      sort,
      maxMinutes,
      budget,
      usePreferences,
      priced,
      saved,
      kitchen.favorites,
      invalidInputs,
    ],
  );
  function update(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  }
  function clear() {
    const next = new URLSearchParams();
    if (params.has("preferences"))
      next.set("preferences", params.get("preferences"));
    setParams(next, { replace: true });
  }
  function href(recipe) {
    const next = new URLSearchParams(params);
    next.set("recipe", recipe.id);
    next.set("servings", String(targetServings));
    return `/recipes?${next}`;
  }
  const navigate = useNavigate();
  const priceFilterBusy = loading && (!!budget || priced || sort === "cost");
  const choices = results.filter(
    (item) =>
      item.recipe.ingredients?.length && Number(item.recipe.servings) > 0,
  );
  const completeChoices = choices.filter((item) => item.cost.ready);
  const candidates = (completeChoices.length ? completeChoices : choices).slice(
    0,
    12,
  );
  function choose() {
    if (!candidates.length) return;
    onOpen();
    navigate(
      href(candidates[Math.floor(Math.random() * candidates.length)].recipe),
      { state: { recipeBrowser: true } },
    );
  }
  const hasFilters =
    invalidInputs ||
    !!query ||
    group !== "ulam" ||
    !!maxMinutes ||
    !!budget ||
    priced ||
    saved ||
    !!servings ||
    sort !== "recommended";
  return (
    <main className="page-shell recipes-page recipe-discovery-page">
      <section className="discovery-hero">
        <div>
          <span className="eyebrow">THE EVERYDAY ULAM COLLECTION</span>
          <h1>
            Anong ulam? <em>Let’s choose.</em>
          </h1>
          <p>
            Find a familiar favorite, then make it fit your table.
            {!recipesLoading && (
              <span className="discovery-recipe-count">
                {" "}
                {recipes.length.toLocaleString()} recipes. Plenty of sarap.
              </span>
            )}
          </p>
        </div>
        <div className="discovery-hero-actions">
          <button
            type="button"
            className="button button-dark"
            onClick={choose}
            disabled={recipesLoading || !candidates.length || priceFilterBusy}
          >
            <ReloadOutlined aria-hidden="true" />
            Choose for me
          </button>
          <Link className="text-link" to="/planner">
            Plan the week <ArrowRightOutlined aria-hidden="true" />
          </Link>
        </div>
      </section>
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
      <section className="discovery-controls" aria-label="Find your ulam">
        <div className="discovery-search-row">
          <label className="search-field discovery-search">
            <SearchOutlined aria-hidden="true" />
            <input
              type="search"
              aria-label="Search recipes"
              value={query}
              placeholder="Search a dish or ingredient… adobo, chicken, kamatis"
              onChange={(e) => update("q", e.target.value)}
            />
          </label>
          <button
            className={`discovery-saved-toggle ${saved ? "is-selected" : ""}`}
            type="button"
            aria-pressed={saved}
            onClick={() => update("saved", saved ? "" : "1")}
          >
            <HeartOutlined aria-hidden="true" /> Saved
            <span>{kitchen.favorites.length}</span>
          </button>
        </div>
        <div className="discovery-groups" aria-label="Browse recipe groups">
          {RECIPE_GROUPS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={group === key}
              onClick={() => update("group", key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="discovery-filters">
          <label>
            Cooking time
            <select
              aria-label="Filter cooking time"
              value={maxMinutes || ""}
              onChange={(e) => update("time", e.target.value)}
            >
              <option value="">Any time</option>
              {[15, 30, 45, 60, 90, 120].map((x) => (
                <option key={x} value={x}>
                  Up to {x} min
                </option>
              ))}
            </select>
          </label>
          <label>
            Meal budget (₱)
            <input
              aria-label="Recipe meal budget (₱)"
              type="number"
              min="1"
              max="1000000"
              step="0.01"
              value={params.get("budget") || ""}
              onChange={(e) => update("budget", e.target.value)}
              placeholder="Any budget"
            />
          </label>
          <label>
            People to feed
            <input
              aria-label="Recipe servings"
              type="number"
              min="1"
              max="100"
              step="1"
              value={params.get("servings") || ""}
              onChange={(e) => update("servings", e.target.value)}
              placeholder={`${defaultServings} (default)`}
            />
          </label>
          <label>
            Sort recipes
            <select
              aria-label="Sort recipes"
              value={sort}
              onChange={(e) => update("sort", e.target.value)}
            >
              <option value="recommended">Recommended for you</option>
              <option value="time">Quickest first</option>
              <option value="cost">Lowest complete cost</option>
              <option value="pantry">Use my pantry first</option>
              <option value="name">A–Z</option>
            </select>
          </label>
        </div>
        {invalidInputs && (
          <p className="discovery-input-error" role="alert">
            Enter a positive meal budget and 1–100 whole servings to apply these
            filters.
          </p>
        )}
        <div className="discovery-filter-foot">
          <div>
            <label className="discovery-check">
              <input
                type="checkbox"
                checked={priced}
                onChange={(e) => update("priced", e.target.checked ? "1" : "")}
              />
              Complete prices only
            </label>
            {preferences.hasFoodRules(kitchen.profile) && (
              <label className="discovery-check">
                <input
                  type="checkbox"
                  checked={usePreferences}
                  onChange={(e) =>
                    update("preferences", e.target.checked ? "on" : "off")
                  }
                />
                Use My Kitchen preferences
              </label>
            )}
          </div>
          <Link className="text-link" to="/my-kitchen">
            <SlidersOutlined aria-hidden="true" /> My Kitchen preferences
          </Link>
        </div>
      </section>
      <section
        className="discovery-results"
        aria-label="Recipes"
        aria-busy={recipesLoading || priceFilterBusy || query !== deferred}
      >
        <div className="discovery-result-heading">
          <div>
            <span className="eyebrow">A LITTLE INSPIRATION FOR YOUR TABLE</span>
            <h2>
              {saved
                ? "Your saved favorites."
                : RECIPE_GROUPS.find(([key]) => key === group)?.[1] ===
                    "All ulam"
                  ? "Find a little sarap."
                  : `${RECIPE_GROUPS.find(([key]) => key === group)?.[1]}.`}
            </h2>
            <p role="status">
              {recipesLoading || priceFilterBusy
                ? "Finding meals for your table…"
                : `${results.length.toLocaleString()} recipes${budget ? " with complete shopping estimates within your budget" : " to choose from"} · for ${targetServings} people`}
            </p>
          </div>
          {hasFilters && (
            <button
              className="text-link discovery-clear"
              type="button"
              onClick={clear}
            >
              Clear filters
            </button>
          )}
        </div>
        <p className="discovery-cost-note">
          Prices show what you need to buy after pantry ingredients. Partial
          costs are labelled; budget filters use complete, recent estimates.
        </p>
        {recipesLoading || priceFilterBusy ? (
          <div className="discovery-grid">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="discovery-skeleton">
                <Skeleton active paragraph={{ rows: 4 }} />
              </div>
            ))}
          </div>
        ) : results.length ? (
          <>
            <div className="discovery-grid">
              {results.slice(0, page * 12).map((entry) => (
                <DiscoveryCard
                  key={entry.recipe.id}
                  entry={entry}
                  loading={loading}
                  href={href(entry.recipe)}
                  onOpen={onOpen}
                />
              ))}
            </div>
            <div className="discovery-load-more">
              <p>
                Showing {Math.min(page * 12, results.length)} of{" "}
                {results.length.toLocaleString()} recipes
              </p>
              {results.length > page * 12 && (
                <button
                  type="button"
                  className="button"
                  onClick={() => update("page", String(page + 1))}
                >
                  Show 12 more recipes <ArrowRightOutlined aria-hidden="true" />
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="discovery-empty">
            <SearchOutlined aria-hidden="true" />
            <h3>
              {saved && !kitchen.favorites.length
                ? "Your favorites start here."
                : "No meals match just yet."}
            </h3>
            <p>
              {saved && !kitchen.favorites.length
                ? "Tap the heart on any recipe to keep it here. Browse the collection and save a few you love."
                : "Try another ingredient, a little more cooking time, or a different budget."}
              {usePreferences
                ? " Your My Kitchen preferences are also applied."
                : ""}
            </p>
            <button
              type="button"
              className="button button-dark"
              onClick={clear}
            >
              Reset recipe filters
            </button>
            {usePreferences && (
              <button
                type="button"
                className="text-link"
                onClick={() => update("preferences", "off")}
              >
                Browse without My Kitchen preferences
              </button>
            )}
          </div>
        )}
      </section>
      <section className="discovery-bottom">
        <div>
          <span className="eyebrow">FOUND A FEW FAVORITES?</span>
          <h2>Good meals make a better week.</h2>
          <p>
            Save what you love, plan your meals, and bring one list to the
            market.
          </p>
        </div>
        <Link className="button button-dark" to="/planner">
          Build my meal plan <ArrowRightOutlined aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
