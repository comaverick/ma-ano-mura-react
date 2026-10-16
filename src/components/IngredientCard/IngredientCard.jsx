import { useState, useMemo } from "react";
import { Modal } from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import { formatMoney, formatDate, isStale } from "../../utils/format";
import "./IngredientCard.css";
function chartPoints(history) {
  const values = history.map((item) => Number(item.avg_price));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return history.map((item, index) => ({
    ...item,
    x: 3 + (index / Math.max(history.length - 1, 1)) * 94,
    y: 75 - ((Number(item.avg_price) - min) / range) * 60,
  }));
}
function PriceChart({ history, large = false }) {
  const points = chartPoints(history);
  if (points.length < 2)
    return (
      <div className="chart-empty">
        {points.length ? "One price observation" : "No recent history"}
      </div>
    );
  return (
    <svg
      className={large ? "price-chart price-chart-large" : "price-chart"}
      viewBox="0 0 100 90"
      preserveAspectRatio="none"
      role="img"
      aria-label="Recorded price trend"
    >
      <polygon
        points={`3,87 ${points.map((p) => `${p.x},${p.y}`).join(" ")} 97,87`}
        fill="currentColor"
        opacity=".07"
      />
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        stroke="currentColor"
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {large &&
        points.map((point, i) => (
          <circle key={i} cx={point.x} cy={point.y} r="1" fill="currentColor">
            <title>
              {formatDate(point.date)}: {formatMoney(point.avg_price)}
            </title>
          </circle>
        ))}
    </svg>
  );
}
export default function IngredientCard({
  name,
  category,
  price,
  averagePrice,
  unit,
  priceHistory,
  source,
  reference,
  rateReference = false,
  date,
}) {
  const [open, setOpen] = useState(false);
  const history = useMemo(() => {
    const byDate = new Map();
    for (const item of priceHistory || []) {
      const existing = byDate.get(item.date);
      if (!existing || +item.avg_price < +existing.avg_price)
        byDate.set(item.date, item);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [priceHistory]);
  const cutoff = Date.now() - 30 * 86400000;
  const recent = history.filter((p) => Date.parse(p.date) >= cutoff);
  const diff =
    averagePrice > 0 ? ((price - averagePrice) / averagePrice) * 100 : null;
  return (
    <>
      <button
        type="button"
        className="ingredient-card"
        onClick={() => setOpen(true)}
        aria-label={`View price details for ${name}`}
      >
        <div className="ingredient-card-top">
          <span>{category}</span>
          <span
            className={`price-change ${diff < 0 ? "price-change-down" : ""}`}
          >
            {diff === null ? (
              "—"
            ) : Math.abs(diff) < 0.05 ? (
              "Steady"
            ) : (
              <>
                {diff > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                {Math.abs(diff).toFixed(1)}%
              </>
            )}
          </span>
        </div>
        <h3>{name}</h3>
        <div className="ingredient-price">
          {formatMoney(price)}
          <small> / {unit}</small>
        </div>
        {rateReference && (
          <span className="ingredient-reference">Reference: {reference}</span>
        )}
        <PriceChart history={recent} />
        <div className="ingredient-card-average">
          <span>30-day average</span>
          <strong>
            {averagePrice == null ? "—" : formatMoney(averagePrice)}
          </strong>
        </div>
        <div className="ingredient-card-source">
          <span>
            {source === "DA Pricewatch" ? "DA Pricewatch" : "SM Supermarket"}
          </span>
          <ArrowRightOutlined />
        </div>
        <span
          className={`ingredient-card-date${isStale(date) ? " stale-date" : ""}`}
        >
          {isStale(date) ? "Older quote · " : ""}
          {formatDate(date)}
        </span>
      </button>
      <Modal
        title={
          <div className="ingredient-modal-title">
            <span className="eyebrow">INGREDIENT PRICE DETAILS</span>
            <h2>{name}</h2>
          </div>
        }
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        centered
        width={620}
      >
        <div className="ingredient-modal-stats">
          <div>
            <small>Latest source quote</small>
            <strong>
              {formatMoney(price)}
              <span> / {unit}</span>
            </strong>
          </div>
          <div>
            <small>30-day average</small>
            <strong>
              {averagePrice == null ? "—" : formatMoney(averagePrice)}
            </strong>
          </div>
        </div>
        <p className="ingredient-modal-source">
          {source} · {reference} · {formatDate(date)}
        </p>
        {isStale(date) && (
          <p className="stale-note">
            This quote is more than 7 days old. The current store or market
            price may differ.
          </p>
        )}
        <h3 className="ingredient-modal-heading">Price history</h3>
        <PriceChart history={recent.length ? recent : history} large />
        <div className="ingredient-history-range">
          <span>{formatDate(history[0]?.date)}</span>
          <span>{formatDate(history.at(-1)?.date)}</span>
        </div>
        <h3 className="ingredient-modal-heading">Recent observations</h3>
        <div className="ingredient-history-table">
          {[...history]
            .reverse()
            .slice(0, 10)
            .map((item) => (
              <div key={item.date}>
                <span>{formatDate(item.date)}</span>
                <strong>{formatMoney(item.avg_price)}</strong>
              </div>
            ))}
        </div>
        <p className="ingredient-modal-disclaimer">
          DA quotes are averages of available NCR market observations. SM quotes
          represent the lowest matched, in-stock product per catalog unit.
          Ingredient variants and stores can differ.
        </p>
      </Modal>
    </>
  );
}
