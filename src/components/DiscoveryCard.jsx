import { Link } from "react-router-dom";
import {
  HeartOutlined,
  HeartFilled,
  ClockCircleOutlined,
  ArrowUpOutlined,
} from "@ant-design/icons";
import { useKitchen } from "../context/KitchenContext";
import planning from "../domain/planning.js";
import { formatMoney } from "../utils/format";
import DishArt from "./DishArt";
export default function DiscoveryCard({ entry, href, onOpen, loading }) {
  const { recipe, metadata, cost } = entry;
  const kitchen = useKitchen();
  const saved = kitchen.favorites.includes(planning.recipeKey(recipe));
  const summary = loading
    ? "Checking prices…"
    : cost.ready
      ? "Complete shopping estimate"
      : cost.shoppingMissing.length
        ? `${cost.shoppingMissing.length} ingredient cost${cost.shoppingMissing.length === 1 ? "" : "s"} missing`
        : cost.stale.length
          ? "Older prices · check dates"
          : "Serving details need review";
  return (
    <article className="discovery-card">
      <Link
        className="discovery-card-main"
        to={href}
        state={{ recipeBrowser: true }}
        onClick={onOpen}
        aria-label={`View recipe: ${recipe.name}`}
      >
        <div className="discovery-card-visual">
          <DishArt recipe={recipe} />
          <span className="dish-category">{metadata.label}</span>
          {cost.ready && !loading && (
            <span className="dish-priced">Prices complete</span>
          )}
        </div>
        <div className="discovery-card-copy">
          <div className="discovery-card-meta">
            <span>
              <ClockCircleOutlined aria-hidden="true" />{" "}
              {metadata.minutes !== null
                ? `${metadata.minutes} min`
                : "Time varies"}
            </span>
            <span>{metadata.ingredientCount} ingredients</span>
          </div>
          <h3>{recipe.name}</h3>
          <p className="discovery-card-pantry">
            {cost.pantryCount
              ? `${cost.pantryCount} ingredients already in your pantry`
              : metadata.lines.length
                ? `${cost.additionalIngredients} ingredients to buy`
                : "Ingredient details not listed"}
          </p>
          <div className="discovery-card-price">
            <div>
              <strong>
                {loading
                  ? "…"
                  : cost.ready || cost.toBuy.some((row) => row.cost !== null)
                    ? formatMoney(cost.subtotal)
                    : "Price unavailable"}
              </strong>
              <span>
                {cost.ready ? "to buy" : "known subtotal"} ·{" "}
                {Number(recipe.servings) > 0 && cost.servings
                  ? `${cost.servings} servings`
                  : "servings need review"}
              </span>
            </div>
            <ArrowUpOutlined aria-hidden="true" />
          </div>
          <small className={cost.ready ? "cost-complete" : "cost-incomplete"}>
            {summary}
          </small>
        </div>
      </Link>
      <button
        className="dish-save"
        type="button"
        aria-label={`${saved ? "Unsave" : "Save"} ${recipe.name}`}
        aria-pressed={saved}
        onClick={() => kitchen.toggleFavorite(recipe)}
      >
        {saved ? (
          <HeartFilled aria-hidden="true" />
        ) : (
          <HeartOutlined aria-hidden="true" />
        )}
      </button>
    </article>
  );
}
