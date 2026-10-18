import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRightOutlined,
  CheckOutlined,
  CloseOutlined,
  HeartOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useKitchen } from "../context/KitchenContext";
import { useMarket } from "../context/MarketContext";
import preferences from "../domain/preferences.js";
import catalogDomain from "../domain/ingredientCatalog.js";
import { formatMoney } from "../utils/format";
import "./MyKitchen.css";
const { DIETS, PROTEINS, DEFAULT_PROFILE, cleanProfile, preferenceMatch } =
  preferences;
export default function MyKitchen() {
  const kitchen = useKitchen();
  const { recipes, recipesLoading, recipeError } = useMarket();
  const [draft, setDraft] = useState(kitchen.profile);
  const [ingredient, setIngredient] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setDraft(kitchen.profile);
    setIngredient("");
  }, [kitchen.profile]);
  const normalized = useMemo(() => cleanProfile(draft), [draft]);
  const matches = useMemo(
    () =>
      recipes.filter(
        (recipe) =>
          recipe.ingredients?.length &&
          preferenceMatch(recipe, normalized).eligible,
      ).length,
    [recipes, normalized],
  );
  const dirty =
    JSON.stringify(normalized) !== JSON.stringify(kitchen.profile) ||
    !!ingredient.trim();
  const set = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
  };
  function addIngredient() {
    if (!ingredient.trim()) return draft.avoid;
    const avoid = cleanProfile({ avoid: [...draft.avoid, ingredient] }).avoid;
    if (
      draft.avoid.length >= 20 &&
      !draft.avoid.includes(cleanProfile({ avoid: [ingredient] }).avoid[0])
    ) {
      setError("You can save up to 20 ingredients to avoid.");
      return null;
    }
    set("avoid", avoid);
    setIngredient("");
    return avoid;
  }
  return (
    <main className="page-shell kitchen-page">
      <section className="page-intro kitchen-intro">
        <div>
          <span className="eyebrow">
            <HeartOutlined aria-hidden="true" /> A KITCHEN THAT KNOWS YOU
          </span>
          <h1>
            Your table.
            <br />
            <em>Your way.</em>
          </h1>
          <p>
            A few little details help us find meals that fit your household,
            your tastes, and the way you like to cook.
          </p>
        </div>
        <div className="kitchen-illustration" aria-hidden="true">
          <span>🥬</span>
          <span>🍲</span>
          <span>🥕</span>
          <small>MADE FOR YOUR EVERYDAY</small>
        </div>
      </section>
      <div className="kitchen-layout">
        <form
          className="kitchen-form"
          onSubmit={(event) => {
            event.preventDefault();
            const avoid = ingredient.trim() ? addIngredient() : draft.avoid;
            if (!avoid) return;
            kitchen.saveProfile({ ...draft, avoid });
          }}
        >
          <section className="kitchen-panel">
            <div className="kitchen-panel-title">
              <span>01</span>
              <div>
                <h2>Who’s coming to dinner?</h2>
                <p>
                  Use these defaults when opening a recipe or finding a meal.
                </p>
              </div>
            </div>
            <div className="kitchen-fields">
              <label>
                Household size
                <input
                  type="number"
                  aria-label="Household size"
                  min="1"
                  max="100"
                  step="1"
                  value={draft.householdSize ?? ""}
                  onChange={(e) => set("householdSize", e.target.value)}
                  placeholder="Use recipe servings"
                  aria-describedby="household-help"
                />
                <small id="household-help">
                  People to feed. You can adjust each meal.
                </small>
              </label>
              <label>
                Usual meal budget (₱)
                <input
                  type="number"
                  aria-label="Usual meal budget (₱)"
                  min="1"
                  max="1000000"
                  step="0.01"
                  value={draft.mealBudget ?? ""}
                  onChange={(e) => set("mealBudget", e.target.value)}
                  placeholder="No budget preference"
                  aria-describedby="meal-budget-help"
                />
                <small id="meal-budget-help">
                  For the household, after pantry ingredients.
                </small>
              </label>
            </div>
          </section>
          <section className="kitchen-panel">
            <div className="kitchen-panel-title">
              <span>02</span>
              <div>
                <h2>What feels like your kind of food?</h2>
                <p>
                  Dietary choices and ingredients to avoid filter your
                  suggestions.
                </p>
              </div>
            </div>
            <label>
              Dietary preference
              <select
                aria-label="Dietary preference"
                value={draft.diet}
                onChange={(e) => set("diet", e.target.value)}
              >
                {DIETS.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="kitchen-options">
              <legend>
                Proteins you enjoy <span>Optional · pick a few</span>
              </legend>
              <div className="kitchen-chips">
                {PROTEINS.map(([key, label]) => (
                  <button
                    type="button"
                    key={key}
                    aria-pressed={draft.preferredProteins.includes(key)}
                    onClick={() =>
                      set(
                        "preferredProteins",
                        draft.preferredProteins.includes(key)
                          ? draft.preferredProteins.filter((x) => x !== key)
                          : [...draft.preferredProteins, key],
                      )
                    }
                  >
                    {draft.preferredProteins.includes(key) && (
                      <CheckOutlined aria-hidden="true" />
                    )}
                    {label}
                  </button>
                ))}
              </div>
              <p className="kitchen-hint">
                These move matching meals higher in your recommendations.
              </p>
            </fieldset>
            <label htmlFor="avoid-ingredient">Ingredients to avoid</label>
            <div className="kitchen-add-ingredient">
              <input
                id="avoid-ingredient"
                list="kitchen-ingredients"
                value={ingredient}
                maxLength="80"
                placeholder="Try pork, shrimp, or peanuts…"
                onChange={(e) => {
                  setIngredient(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addIngredient();
                  }
                }}
              />
              <button type="button" className="button" onClick={addIngredient}>
                Add ingredient
              </button>
            </div>
            <datalist id="kitchen-ingredients">
              {catalogDomain.catalog.map((item) => (
                <option key={item.key} value={item.name} />
              ))}
            </datalist>
            <div className="kitchen-chips kitchen-avoid-list">
              {draft.avoid.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-label={`Remove ${item} from ingredients to avoid`}
                  onClick={() =>
                    set(
                      "avoid",
                      draft.avoid.filter((x) => x !== item),
                    )
                  }
                >
                  {catalogDomain.resolveIngredient(item)?.name || item}
                  <CloseOutlined aria-hidden="true" />
                </button>
              ))}
            </div>
            <p className="kitchen-hint">
              We check listed ingredients and known aliases, including optional
              ingredients. Product recipes and substitutions can vary; check the
              ingredient list before cooking.
            </p>
          </section>
          <section className="kitchen-panel">
            <div className="kitchen-panel-title">
              <span>03</span>
              <div>
                <h2>Make it work for your day.</h2>
                <p>
                  A little less prep, a few fewer ingredients, or extra heat.
                </p>
              </div>
            </div>
            <div className="kitchen-fields">
              <label>
                Time in the kitchen
                <select
                  aria-label="Time in the kitchen"
                  aria-describedby="cooking-time-help"
                  value={draft.maxMinutes ?? ""}
                  onChange={(e) => set("maxMinutes", e.target.value)}
                >
                  <option value="">Any cooking time</option>
                  {[15, 30, 45, 60, 90, 120].map((x) => (
                    <option key={x} value={x}>
                      {x} minutes or less
                    </option>
                  ))}
                </select>
                <small id="cooking-time-help">
                  Uses listed total time, including prep.
                </small>
              </label>
              <label>
                Recipe simplicity
                <select
                  aria-label="Recipe simplicity"
                  aria-describedby="simplicity-help"
                  value={draft.maxIngredients ?? ""}
                  onChange={(e) => set("maxIngredients", e.target.value)}
                >
                  <option value="">Any number of ingredients</option>
                  {[5, 8, 12].map((x) => (
                    <option key={x} value={x}>
                      {x} ingredients or fewer
                    </option>
                  ))}
                </select>
                <small id="simplicity-help">
                  Counts listed ingredients, excluding water.
                </small>
              </label>
            </div>
            <label>
              Chili preference
              <select
                aria-label="Chili preference"
                value={draft.chili}
                onChange={(e) => set("chili", e.target.value)}
              >
                <option value="any">A little of everything</option>
                <option value="skip">Skip recipes with listed chili</option>
                <option value="prefer">Bring on the chili</option>
              </select>
            </label>
            <p className="kitchen-hint">
              Chili preferences use the ingredient list, rather than a measured
              heat rating.
            </p>
          </section>
          {error && (
            <p className="kitchen-form-error" role="alert">
              {error}
            </p>
          )}
          <div className="kitchen-save-bar">
            <div>
              <strong>
                {dirty ? "Make these preferences yours." : "You’re all set."}
              </strong>
              <small>
                {dirty
                  ? "Save to update recommendations and defaults."
                  : kitchen.storageError
                    ? "Preferences are available for this visit only."
                    : "Preferences are saved in this browser."}
              </small>
            </div>
            <button
              type="submit"
              className="button button-dark"
              disabled={!dirty}
            >
              Save preferences <CheckOutlined aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            className="text-link kitchen-reset"
            onClick={() => {
              setDraft(cleanProfile(DEFAULT_PROFILE));
              setIngredient("");
              setError("");
            }}
          >
            Reset preferences
          </button>
        </form>
        <aside className="kitchen-summary">
          <span className="eyebrow">YOUR KITCHEN AT A GLANCE</span>
          <h2>
            A little more <em>you.</em>
          </h2>
          <div className="kitchen-summary-row">
            <TeamOutlined aria-hidden="true" />
            <div>
              <strong>
                {normalized.householdSize
                  ? `${normalized.householdSize} at the table`
                  : "Every table is welcome"}
              </strong>
              <span>
                {normalized.householdSize
                  ? "Default portions for new meals"
                  : "Use each recipe’s original portions"}
              </span>
            </div>
          </div>
          <div className="kitchen-summary-row">
            <span aria-hidden="true">₱</span>
            <div>
              <strong>
                {normalized.mealBudget
                  ? `${formatMoney(normalized.mealBudget)} per meal`
                  : "Room for every budget"}
              </strong>
              <span>
                {normalized.mealBudget
                  ? "Known shopping costs after your pantry"
                  : "Set a budget whenever you plan"}
              </span>
            </div>
          </div>
          <div className="kitchen-match-count" aria-live="polite">
            <strong>
              {recipesLoading || recipeError ? "—" : matches.toLocaleString()}
            </strong>
            <span>recipes match these ingredient and cooking preferences</span>
          </div>
          <p>
            {normalized.diet !== "any"
              ? "Recipes with unclear dietary ingredients stay out of your suggestions."
              : "Your pantry and saved recipes help us find familiar favorites."}{" "}
            Budget fit is confirmed only when all required shopping costs are
            available.
          </p>
          <Link className="button button-dark" to="/">
            See my recommendations <ArrowRightOutlined aria-hidden="true" />
          </Link>
          {dirty && (
            <small className="kitchen-hint">
              Save your changes before exploring.
            </small>
          )}
          <Link className="text-link" to="/planner">
            Manage pantry & meal plan →
          </Link>
          <small className="kitchen-local-note">
            No account needed. Your profile, pantry, and saved meals stay in
            this browser. Existing planned portions stay as you set them.
          </small>
        </aside>
      </div>
    </main>
  );
}
