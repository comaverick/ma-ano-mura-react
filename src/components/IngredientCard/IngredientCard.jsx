import "./IngredientCard.css";
import { Card, Button, Tag } from "antd";
import { ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  YAxis,
  Tooltip
} from "recharts";

const IngredientCard = ({
  name,
  category,
  price,
  averagePrice,
  unit,
  priceHistory,
}) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const last30Days = priceHistory.filter(
    (item) => new Date(item.date) >= thirtyDaysAgo
  );

  const priceDifference = price - averagePrice;

const pricePercentage =
  averagePrice > 0
    ? ((price - averagePrice) / averagePrice) * 100
    : 0;

  return (
    <Card className="ingredient-card">

      <div className="ingredient-content">

        <Tag color="green">
          {category}
        </Tag>

        <h3>{name}</h3>

        <h2>
          ₱{price}
          <span className="price-unit"> / {unit}</span>
        </h2>

        <div className="ingredient-history">
          <span>30-day average</span>

          <span>
            ₱{Number(averagePrice).toFixed(2)}
          </span>
        </div>

        {averagePrice != null && (
          <div
            className={
              priceDifference > 0
                ? "price-up"
                : priceDifference < 0
                ? "price-down"
                : "price-same"
            }
          >
            {priceDifference > 0 ? (
              <>
                <ArrowUpOutlined />
                {" ₱" + Number(priceDifference).toFixed(2)}
                {" (+" + pricePercentage.toFixed(1) + "%)"}
              </>
            ) : priceDifference < 0 ? (
              <>
                <ArrowDownOutlined />
                {" ₱" + Math.abs(Number(priceDifference)).toFixed(2)}
                {" (" + pricePercentage.toFixed(1) + "%)"}
              </>
            ) : (
              "No change"
            )}
          </div>
        )}

        <div className="ingredient-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={[...last30Days].reverse()}
            >
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip
                formatter={(value) => `₱${Number(value).toFixed(2)}`}
                contentStyle={{
                  padding: "4px 8px",
                  borderRadius: "6px",
                  border: "1px solid #e5e7eb",
                  fontSize: "11px",
                }}
                labelStyle={{
                  display: "none",
                }}
                cursor={{
                  stroke: "#d1d5db",
                  strokeWidth: 1,
                }}
              />
              <Line
                type="monotone"
                dataKey="avg_price"
                stroke="#15803d"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>

    </Card>
  );
};

export default IngredientCard;
