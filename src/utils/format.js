const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});
export const formatMoney = (value) => money.format(Number(value) || 0);
export const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "Asia/Manila",
      }).format(new Date(value))
    : "No observations yet";
export const isStale = (value) =>
  !value || Date.now() - new Date(value).getTime() > 7 * 86400000;
export const formatTime = (recipe) =>
  recipe.total_time ||
  [recipe.prep_time, recipe.cook_time].filter(Boolean).join(" + ") ||
  "Time varies";
export const formatQuantity = (quantity, unit) =>
  quantity == null
    ? "As listed"
    : `${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(quantity)} ${unit || ""}`;
