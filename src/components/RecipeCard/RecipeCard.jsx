import { Link } from "react-router-dom";
import {
  ArrowRightOutlined,
  ClockCircleOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useMarket } from "../../context/MarketContext";
import domainCosting from "../../domain/costing.js";
import { formatMoney, formatTime } from "../../utils/format";
import "./RecipeCard.css";
import { useKitchen } from "../../context/KitchenContext";
import measurementsDomain from "../../domain/measurements.js";
const { priceRecipe } = domainCosting;
export default function RecipeCard({
  recipe,
  index = 0,
  recommendation = null,
}) {
  const { priceIndex, loading } = useMarket();
  const { measurements, profile } = useKitchen();
  const cost =
    recommendation?.cost ||
    priceRecipe(
      measurementsDomain.withMeasurements(recipe, measurements),
      priceIndex,
      "best",
      profile.householdSize,
    );
  const emoji = /chicken|manok/i.test(recipe.name)
    ? "🍗"
    : /pork|baboy/i.test(recipe.name)
      ? "🍖"
      : /fish|bangus|tilapia/i.test(recipe.name)
        ? "🐟"
        : /sinigang|soup/i.test(recipe.name)
          ? "🥣"
          : "🍲";
  return (
    <Link
      className={`recipe-card recipe-card-${index % 3}`}
      to={`/recipes?recipe=${encodeURIComponent(recipe.id)}`}
    >
      <div className="recipe-card-art">
        <span>{emoji}</span>
        <span className="recipe-card-label">THE ULAM COLLECTION</span>
        <span className="recipe-card-number">0{index + 1}</span>
      </div>
      <div className="recipe-card-body">
        <div className="recipe-card-meta">
          <span>
            <ClockCircleOutlined /> {formatTime(recipe)}
          </span>
          <span>
            <TeamOutlined /> {cost.servings || recipe.servings || "—"} servings
          </span>
        </div>
        <h3>{recipe.name}</h3>
        {recommendation && (
          <div className="recipe-reasons" aria-label="Why this recipe">
            {recommendation.reasons.slice(0, 2).map((reason) => (
              <span key={reason}>{reason}</span>
            ))}
          </div>
        )}
        <div className="recipe-card-bottom">
          <div>
            <strong>
              {loading
                ? "Loading prices…"
                : cost.pricedCount || recommendation?.cost.ready
                  ? formatMoney(recommendation ? cost.subtotal : cost.total)
                  : "Explore recipe"}
            </strong>
            <small>
              {recommendation
                ? cost.ready
                  ? "Estimated to buy · after pantry"
                  : "Partial costs · budget fit unconfirmed"
                : cost.pricedCount
                  ? cost.missing.length
                    ? `${cost.pricedCount}/${cost.requiredCount} ingredients priced · subtotal`
                    : "Estimated recipe cost"
                  : "Ingredients & cooking steps"}
            </small>
          </div>
          <span className="recipe-card-arrow">
            <ArrowRightOutlined />
          </span>
        </div>
      </div>
    </Link>
  );
}
