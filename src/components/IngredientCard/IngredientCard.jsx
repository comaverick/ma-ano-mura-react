import "./IngredientCard.css";
import { useState } from "react";
import { Card, Modal } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined } from "@ant-design/icons";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const getChartData = (prices) => {
  const values = [...prices]
    .reverse()
    .map((item) => ({
      date: item.date,
      value: Number(item.avg_price),
    }))
    .filter((item) => Number.isFinite(item.value));

  const min = values.length > 0
    ? Math.min(...values.map((item) => item.value))
    : null;
  const max = values.length > 0
    ? Math.max(...values.map((item) => item.value))
    : null;

  if (values.length < 2) {
    return {
      points: [],
      pointsString: "",
      areaPoints: "",
      min,
      max,
      startDate: values[0]?.date,
      endDate: values[values.length - 1]?.date,
    };
  }

  const range = max - min || 1;
  const points = values.map((item, index) => {
    const x = 2 + (index / (values.length - 1)) * 96;
    const y = 90 - ((item.value - min) / range) * 80;

    return {
      ...item,
      x,
      y,
    };
  });

  const pointsString = points
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  return {
    points,
    pointsString,
    areaPoints: `2,90 ${pointsString} 98,90`,
    min,
    max,
    startDate: points[0].date,
    endDate: points[points.length - 1].date,
  };
};

const IngredientCard = ({
  name,
  category,
  price,
  averagePrice,
  unit,
  priceHistory,
}) => {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const safePriceHistory = priceHistory || [];
  const sortedHistory = [...safePriceHistory]
    .filter((item) => {
      const itemDate = new Date(item.date);
      return Number.isFinite(Number(item.avg_price)) && !Number.isNaN(itemDate.getTime());
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const last30Days = sortedHistory.filter(
    (item) => new Date(item.date) >= thirtyDaysAgo
  );

  const numericPrice = Number(price || 0);
  const numericAverage = averagePrice == null ? null : Number(averagePrice);
  const priceDifference = numericAverage == null
    ? 0
    : numericPrice - numericAverage;
  const pricePercentage = numericAverage > 0
    ? (priceDifference / numericAverage) * 100
    : 0;
  const latestDate = sortedHistory[0]?.date;
  const detailHistory = last30Days.length > 0 ? last30Days : sortedHistory;
  const cardChartData = getChartData(last30Days);
  const detailChartData = getChartData(detailHistory);
  const detailLow = detailChartData.min;
  const detailHigh = detailChartData.max;
  const recentHistory = sortedHistory.slice(0, 8);

  const handleCardKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsDetailOpen(true);
    }
  };

  return (
    <>
    <Card
      className="ingredient-card"
      role="button"
      tabIndex={0}
      aria-label={`View price details for ${name}`}
      onClick={() => setIsDetailOpen(true)}
      onKeyDown={handleCardKeyDown}
    >
      <div className="ingredient-content">
        <span className="ingredient-tag">{category}</span>

        <h3>{name}</h3>

        <h2>
          {currencyFormatter.format(numericPrice)}
          <span className="price-unit"> / {unit}</span>
        </h2>

        <div className="ingredient-history">
          <span>30-day average</span>
          <span>
            {numericAverage == null
              ? "No recent data"
              : currencyFormatter.format(numericAverage)}
          </span>
        </div>

        {numericAverage != null && (
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
                <ArrowUpOutlined aria-hidden="true" />
                {` ${currencyFormatter.format(priceDifference)} (+${pricePercentage.toFixed(1)}%)`}
              </>
            ) : priceDifference < 0 ? (
              <>
                <ArrowDownOutlined aria-hidden="true" />
                {` ${currencyFormatter.format(Math.abs(priceDifference))} (${pricePercentage.toFixed(1)}%)`}
              </>
            ) : (
              "No change"
            )}
          </div>
        )}

        <div className="ingredient-chart" aria-label="30-day price trend">
          {cardChartData.points.length > 1 ? (
            <svg
              className="ingredient-sparkline"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              role="img"
              aria-label="Price trend over the last 30 days"
            >
              <title>Price trend over the last 30 days</title>
              <polygon
                points={cardChartData.areaPoints}
                fill="currentColor"
                opacity="0.1"
              />
              <polyline
                points={cardChartData.pointsString}
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          ) : (
            <span className="chart-empty">
              {last30Days.length === 1 ? "Limited history" : "No recent history"}
            </span>
          )}
        </div>

        {latestDate && (
          <span className="ingredient-updated">
            Updated {dateFormatter.format(new Date(latestDate))}
          </span>
        )}

        <span className="ingredient-card-action">View price details</span>
      </div>
    </Card>
    <Modal
      className="ingredient-detail-modal"
      title={
        <div className="ingredient-detail-title">
          <span>{name}</span>
          <small>{category}</small>
        </div>
      }
      open={isDetailOpen}
      onCancel={() => setIsDetailOpen(false)}
      footer={null}
      centered
    >
      <div className="ingredient-detail-summary">
        <div>
          <span>Current price</span>
          <strong>{currencyFormatter.format(numericPrice)}</strong>
          <small>per {unit}</small>
        </div>
        <div>
          <span>30-day average</span>
          <strong>
            {numericAverage == null
              ? "No recent data"
              : currencyFormatter.format(numericAverage)}
          </strong>
        </div>
      </div>

      <div className="ingredient-detail-metrics">
        <div>
          <span>30-day low</span>
          <strong>
            {detailLow == null ? "-" : currencyFormatter.format(detailLow)}
          </strong>
        </div>
        <div>
          <span>30-day high</span>
          <strong>
            {detailHigh == null ? "-" : currencyFormatter.format(detailHigh)}
          </strong>
        </div>
        <div>
          <span>Price records</span>
          <strong>{sortedHistory.length}</strong>
        </div>
      </div>

      <div className="ingredient-detail-chart-heading">
        <div>
          <h3>30-day price trend</h3>
          <span>Hover a point to see the exact price.</span>
        </div>
        {detailLow != null && detailHigh != null && (
          <strong>
            {currencyFormatter.format(detailLow)} - {currencyFormatter.format(detailHigh)}
          </strong>
        )}
      </div>

      {detailChartData.points.length > 1 ? (
        <>
          <div className="ingredient-detail-chart">
            <div className="chart-y-axis" aria-hidden="true">
              <span>{currencyFormatter.format(detailHigh)}</span>
              <span>
                {currencyFormatter.format((detailHigh + detailLow) / 2)}
              </span>
              <span>{currencyFormatter.format(detailLow)}</span>
            </div>

            <div className="ingredient-detail-plot">
              <svg
                className="ingredient-detail-sparkline"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                role="img"
                aria-label={`${name} price trend over the last 30 days`}
              >
                <title>{name} price trend over the last 30 days</title>
                {[10, 50, 90].map((y) => (
                  <line
                    key={y}
                    x1="2"
                    x2="98"
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity="0.14"
                    strokeWidth="0.8"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                <polygon
                  points={detailChartData.areaPoints}
                  fill="currentColor"
                  opacity="0.1"
                />
                <polyline
                  points={detailChartData.pointsString}
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
                {detailChartData.points.map((point, index) => (
                  <circle
                    key={`${point.date}-${point.value}-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r="1.4"
                    fill="currentColor"
                    stroke="#ffffff"
                    strokeWidth="0.8"
                    vectorEffect="non-scaling-stroke"
                  >
                    <title>
                      {dateFormatter.format(new Date(point.date))}: {currencyFormatter.format(point.value)}
                    </title>
                  </circle>
                ))}
              </svg>
            </div>
          </div>

          <div className="ingredient-chart-range">
            <span>{dateFormatter.format(new Date(detailChartData.startDate))}</span>
            <span>Oldest to latest</span>
            <span>{dateFormatter.format(new Date(detailChartData.endDate))}</span>
          </div>
        </>
      ) : (
        <div className="ingredient-detail-chart">
          <span className="chart-empty">Not enough history for a trend line</span>
        </div>
      )}

      {numericAverage != null && (
        <p
          className={`ingredient-detail-trend ${
            priceDifference > 0
              ? "trend-up"
              : priceDifference < 0
              ? "trend-down"
              : "trend-same"
          }`}
        >
          {priceDifference > 0 ? (
            <ArrowUpOutlined aria-hidden="true" />
          ) : priceDifference < 0 ? (
            <ArrowDownOutlined aria-hidden="true" />
          ) : null}
          {priceDifference > 0
            ? `Currently ${currencyFormatter.format(priceDifference)} above the 30-day average (${pricePercentage.toFixed(1)}%).`
            : priceDifference < 0
            ? `Currently ${currencyFormatter.format(Math.abs(priceDifference))} below the 30-day average (${Math.abs(pricePercentage).toFixed(1)}%).`
            : "Currently equal to the 30-day average."}
        </p>
      )}

      <div className="ingredient-detail-divider" />

      <div className="ingredient-history-heading">
        <h3>Recent price records</h3>
        <span>{recentHistory.length} shown</span>
      </div>

      {recentHistory.length > 0 ? (
        <div className="ingredient-history-list">
          {recentHistory.map((item) => (
            <div className="ingredient-history-row" key={item.id || `${item.date}-${item.avg_price}`}>
              <span>{dateFormatter.format(new Date(item.date))}</span>
              <strong>{currencyFormatter.format(Number(item.avg_price))}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="ingredient-history-empty">No price records are available.</p>
      )}
    </Modal>
    </>
  );
};

export default IngredientCard;
