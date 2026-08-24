import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Empty,
  Input,
  Skeleton,
} from "antd";
import {
  ArrowLeftOutlined,
  CalculatorOutlined,
  ClockCircleOutlined,
  SearchOutlined,
  ShopOutlined,
  TeamOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { supabase } from "../supabaseClient";
import {
  PRICE_SOURCES,
  calculateRecipeCost,
} from "../utils/recipeCost";
import "./Recipes.css";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 2,
});

const formatCurrency = (value) => currencyFormatter.format(Number(value || 0));

const formatQuantity = (quantity, unit) => {
  if (quantity === null || quantity === undefined || !unit) {
    return "Amount unavailable";
  }

  return `${numberFormatter.format(Number(quantity))} ${unit}`;
};

const formatRecipeTime = (recipe) => {
  if (recipe?.total_time) {
    return recipe.total_time;
  }

  const parts = [recipe?.prep_time, recipe?.cook_time].filter(Boolean);
  return parts.length ? parts.join(" + ") : "Time not listed";
};

const Recipes = () => {
  const [recipes, setRecipes] = useState([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState(null);
  const [recipeDetail, setRecipeDetail] = useState(null);
  const [recipeLinks, setRecipeLinks] = useState([]);
  const [source, setSource] = useState(PRICE_SOURCES[0].value);
  const [search, setSearch] = useState("");
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");

  const loadRecipes = useCallback(async () => {
    setLoadingRecipes(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("recipes")
      .select("id, name, prep_time, cook_time, total_time, servings")
      .order("name", { ascending: true });

    if (fetchError) {
      console.error("Error loading recipes:", fetchError);
      setError("We could not load the recipe collection.");
      setRecipes([]);
    } else {
      const nextRecipes = data || [];
      setRecipes(nextRecipes);
      setSelectedRecipeId((currentId) => currentId || nextRecipes[0]?.id || null);
    }

    setLoadingRecipes(false);
  }, []);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  useEffect(() => {
    if (!selectedRecipeId) {
      return undefined;
    }

    let cancelled = false;

    const loadRecipeDetail = async () => {
      setLoadingDetail(true);
      setDetailError("");

      const [recipeResult, linksResult] = await Promise.all([
        supabase
          .from("recipes")
          .select("id, name, prep_time, cook_time, total_time, servings, instructions")
          .eq("id", selectedRecipeId)
          .maybeSingle(),
        supabase
          .from("recipe_ingredients")
          .select("id, ingredient_id, original_name, quantity, unit")
          .eq("recipe_id", selectedRecipeId)
          .order("id", { ascending: true }),
      ]);

      if (cancelled) {
        return;
      }

      if (recipeResult.error || linksResult.error) {
        console.error("Error loading recipe detail:", recipeResult.error || linksResult.error);
        setDetailError("We could not load the ingredients for this recipe.");
        setRecipeDetail(null);
        setRecipeLinks([]);
        setLoadingDetail(false);
        return;
      }

      const links = linksResult.data || [];
      const ingredientIds = [...new Set(links.map((link) => link.ingredient_id).filter(Boolean))];
      let ingredientRows = [];

      if (ingredientIds.length > 0) {
        const { data, error: ingredientsError } = await supabase
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
              source
            )
          `)
          .in("id", ingredientIds);

        if (ingredientsError) {
          console.error("Error loading recipe ingredient prices:", ingredientsError);
          setDetailError("We could not load current ingredient prices for this recipe.");
          setRecipeDetail(recipeResult.data || null);
          setRecipeLinks([]);
          setLoadingDetail(false);
          return;
        }

        ingredientRows = data || [];
      }

      const ingredientsById = new Map(
        ingredientRows.map((ingredient) => [ingredient.id, ingredient])
      );

      setRecipeDetail(recipeResult.data || null);
      setRecipeLinks(
        links.map((link) => ({
          ...link,
          ingredient: ingredientsById.get(link.ingredient_id) || {
            id: link.ingredient_id,
            name: link.original_name || "Unknown ingredient",
            unit: null,
            prices: [],
          },
        }))
      );
      setLoadingDetail(false);
    };

    loadRecipeDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedRecipeId]);

  const filteredRecipes = useMemo(() => {
    const query = search.trim().toLowerCase();

    return recipes.filter((recipe) =>
      !query || String(recipe.name || "").toLowerCase().includes(query)
    );
  }, [recipes, search]);

  const costData = useMemo(
    () => calculateRecipeCost(recipeLinks, source),
    [recipeLinks, source]
  );

  const selectedRecipe = recipeDetail || recipes.find(
    (recipe) => recipe.id === selectedRecipeId
  );
  const selectedSourceLabel = PRICE_SOURCES.find(
    (item) => item.value === source
  )?.label || source;
  const instructions = String(selectedRecipe?.instructions || "")
    .split(/\s*\|\s*/)
    .map((step) => step.trim())
    .filter(Boolean);
  const pricedPercentage = costData.ingredients.length > 0
    ? Math.round((costData.pricedIngredients.length / costData.ingredients.length) * 100)
    : 0;

  return (
    <main className="recipes-page">
      <section className="recipes-hero">
        <div className="recipes-hero-copy">
          <span className="recipes-eyebrow">
            <CalculatorOutlined /> Recipe cost calculator
          </span>
          <h1>Know what your next ulam will cost.</h1>
          <p>
            Pick a Filipino recipe and see an estimate using the latest ingredient prices.
            Amounts are converted to each ingredient&apos;s catalog unit automatically.
          </p>
        </div>

        <div className="recipe-source-control" aria-label="Choose recipe price source">
          <span>Price source</span>
          <div className="recipe-source-switch" role="group">
            {PRICE_SOURCES.map((item) => (
              <button
                type="button"
                key={item.value}
                className={source === item.value ? "source-active" : ""}
                aria-pressed={source === item.value}
                onClick={() => setSource(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="recipes-workspace" aria-label="Recipe collection">
        <aside className="recipe-library">
          <div className="recipe-library-heading">
            <div>
              <span className="section-kicker">Collection</span>
              <h2>Filipino recipes</h2>
            </div>
            <span className="recipe-count">{recipes.length}</span>
          </div>

          <Input
            className="recipe-search"
            aria-label="Search recipes"
            placeholder="Search recipes"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            allowClear
          />

          {loadingRecipes && (
            <div className="recipe-list-skeleton">
              {Array.from({ length: 7 }).map((_, index) => (
                <Skeleton active title={{ width: "80%" }} paragraph={false} key={index} />
              ))}
            </div>
          )}

          {!loadingRecipes && filteredRecipes.length === 0 && (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No recipes match your search."
            />
          )}

          {!loadingRecipes && filteredRecipes.length > 0 && (
            <div className="recipe-list" role="listbox" aria-label="Recipes">
              {filteredRecipes.map((recipe) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedRecipeId === recipe.id}
                  className={`recipe-list-item ${selectedRecipeId === recipe.id ? "recipe-list-item-active" : ""}`}
                  key={recipe.id}
                  onClick={() => setSelectedRecipeId(recipe.id)}
                >
                  <span className="recipe-list-item-name">{recipe.name}</span>
                  <span className="recipe-list-item-meta">
                    {recipe.servings ? `${recipe.servings} servings` : "Servings not listed"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <article className="recipe-detail-panel">
          {error && <Alert type="error" showIcon message={error} />}

          {!error && loadingRecipes && (
            <div className="recipe-detail-loading">
              <Skeleton active paragraph={{ rows: 8 }} />
            </div>
          )}

          {!error && !loadingRecipes && !selectedRecipe && (
            <div className="recipe-empty-state">
              <Empty description="Choose a recipe to see its cost." />
            </div>
          )}

          {!error && !loadingRecipes && selectedRecipe && (
            <>
              <header className="recipe-detail-header">
                <div>
                  <span className="section-kicker">Recipe estimate</span>
                  <h2>{selectedRecipe.name}</h2>
                  <div className="recipe-meta-row">
                    <span><ClockCircleOutlined /> {formatRecipeTime(selectedRecipe)}</span>
                    <span><TeamOutlined /> {selectedRecipe.servings || "—"} servings</span>
                    <span><ShopOutlined /> {selectedSourceLabel}</span>
                  </div>
                </div>

                <div className="recipe-total-card">
                  <span>Estimated total</span>
                  <strong>{formatCurrency(costData.total)}</strong>
                  <small>
                    {selectedRecipe.servings && costData.total > 0
                      ? `${formatCurrency(costData.total / Number(selectedRecipe.servings))} per serving`
                      : "Based on available prices"}
                  </small>
                </div>
              </header>

              {detailError && (
                <Alert
                  type="error"
                  showIcon
                  message="Recipe details unavailable"
                  description={detailError}
                />
              )}

              {loadingDetail && (
                <div className="recipe-detail-loading">
                  <Skeleton active paragraph={{ rows: 8 }} />
                </div>
              )}

              {!loadingDetail && !detailError && (
                <>
                  <div className="recipe-coverage-card">
                    <div>
                      <strong>{pricedPercentage}%</strong>
                      <span>of linked ingredients priced</span>
                    </div>
                    <span>
                      {costData.pricedIngredients.length} of {costData.ingredients.length} ingredients included
                    </span>
                  </div>

                  {costData.missingIngredients.length > 0 && (
                    <Alert
                      className="recipe-warning"
                      type="warning"
                      showIcon
                      icon={<WarningOutlined />}
                      message={`${costData.missingIngredients.length} ingredient${costData.missingIngredients.length === 1 ? "" : "s"} not included in the total`}
                      description={costData.missingIngredients
                        .map((item) => item.ingredient.name)
                        .filter(Boolean)
                        .join(", ")}
                    />
                  )}

                  <section className="recipe-section">
                    <div className="recipe-section-heading">
                      <div>
                        <span className="section-kicker">Shopping list</span>
                        <h3>Ingredients and prices</h3>
                      </div>
                      <span className="recipe-section-note">Latest {selectedSourceLabel} price</span>
                    </div>

                    <div className="recipe-ingredients-table">
                      {costData.ingredients.map((item) => {
                        const conversionNote = item.conversion.estimated
                          ? "Approximate conversion"
                          : item.conversion.reason;

                        return (
                          <div className="recipe-ingredient-row" key={item.id}>
                            <span className="recipe-ingredient-quantity">
                              {formatQuantity(item.quantity, item.unit)}
                            </span>
                            <div className="recipe-ingredient-name">
                              <strong>{item.ingredient.name}</strong>
                              {item.original_name && item.original_name !== item.ingredient.name && (
                                <small>{item.original_name}</small>
                              )}
                            </div>
                            <div className="recipe-ingredient-price">
                              {item.cost !== null ? (
                                <>
                                  <strong>{formatCurrency(item.cost)}</strong>
                                  {conversionNote && <small>{conversionNote}</small>}
                                </>
                              ) : (
                                <>
                                  <strong className="recipe-price-missing">Not priced</strong>
                                  <small>{item.price ? conversionNote : `No ${selectedSourceLabel} price`}</small>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {instructions.length > 0 && (
                    <section className="recipe-section recipe-instructions">
                      <div className="recipe-section-heading">
                        <div>
                          <span className="section-kicker">How to cook it</span>
                          <h3>Instructions</h3>
                        </div>
                      </div>
                      <ol>
                        {instructions.map((step, index) => (
                          <li key={`${index}-${step.slice(0, 20)}`}>
                            <span>{index + 1}</span>
                            <p>{step}</p>
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </article>
      </section>

      <div className="recipes-mobile-note">
        <ArrowLeftOutlined /> Select a recipe from the collection to compare its cost.
      </div>
    </main>
  );
};

export default Recipes;
