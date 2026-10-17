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
export default function RecipeCard({ recipe, index = 0 }) {
  const { priceIndex, loading } = useMarket();
  const { measurements } = useKitchen();
  const cost = priceRecipe(
    measurementsDomain.withMeasurements(recipe, measurements),
    priceIndex,
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
            <TeamOutlined /> {recipe.servings || "—"} servings
          </span>
        </div>
        <h3>{recipe.name}</h3>
        <div className="recipe-card-bottom">
          <div>
            <strong>
              {loading
                ? "Loading prices…"
                : cost.pricedCount
                  ? formatMoney(cost.total)
                  : "Explore recipe"}
            </strong>
            <small>
              {cost.pricedCount
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
