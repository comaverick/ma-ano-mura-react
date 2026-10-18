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
import DishArt from "../DishArt";
import discovery from "../../domain/discovery.js";
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
  return (
    <Link
      className={`recipe-card recipe-card-${index % 3}`}
      to={`/recipes?recipe=${encodeURIComponent(recipe.id)}`}
    >
      <div className="recipe-card-art">
        <DishArt recipe={recipe} />
        <span className="recipe-card-label">
          {discovery.discoveryMetadata(recipe).label}
        </span>
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
