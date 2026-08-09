import "./IngredientCard.css";
import { Card, Button, Tag } from "antd";

const IngredientCard = ({
  name,
  category,
  price,
  previousPrice,
  unit,
}) => {

  const priceDifference = price - previousPrice;
  return (
    <Card className="ingredient-card" hoverable>

      <div className="ingredient-content">

        <Tag color="green">
          {category}
        </Tag>

        <h3>{name}</h3>

        <h2>
          ₱{price}
          <span> / {unit}</span>
        </h2>

        <div className="ingredient-history">
          <span>Previous Price</span>

          <span>
            ₱{previousPrice}
          </span>
        </div>

        {previousPrice && (
          <div
            className={
              priceDifference > 0
                ? "price-up"
                : priceDifference < 0
                ? "price-down"
                : "price-same"
            }
          >
            {priceDifference > 0
              ? `▲ ₱${priceDifference}`
              : priceDifference < 0
              ? `▼ ₱${Math.abs(priceDifference)}`
              : "No change"}
          </div>
        )}

        <div className="ingredient-chart">
          Price Trend
        </div>

        <Button
          className="ingredient-button"
          color="green"
          variant="solid"
          block
        >
          View Details
        </Button>

      </div>

    </Card>
  );
};

export default IngredientCard;
