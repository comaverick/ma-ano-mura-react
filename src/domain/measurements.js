import { normalizeName } from "./ingredientCatalog.js";
import { normalizeUnit } from "./recipeParser.js";
function validMeasurement(value) {
  return (
    value &&
    typeof value.rawName === "string" &&
    value.rawName.length <= 1000 &&
    Number.isFinite(Number(value.quantity)) &&
    Number(value.quantity) > 0 &&
    Number(value.quantity) <= 1000000 &&
    !!normalizeUnit(value.unit)
  );
}
function cleanMeasurements(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key.length <= 200)
      .slice(0, 2000)
      .map(([key, rows]) => [
        key,
        Object.fromEntries(
          Object.entries(rows && typeof rows === "object" ? rows : {})
            .filter(
              ([id, item]) =>
                /^ingredient-\d+$/.test(id) && validMeasurement(item),
            )
            .slice(0, 100)
            .map(([id, item]) => [
              id,
              {
                rawName: item.rawName,
                quantity: Number(item.quantity),
                unit: normalizeUnit(item.unit),
              },
            ]),
        ),
      ]),
  );
}
function withMeasurements(recipe, all = {}) {
  return {
    ...recipe,
    measurements:
      all[normalizeName(recipe.key || recipe.name)] ||
      recipe.measurements ||
      {},
  };
}
function measurementFor(recipe, index, line) {
  const value = recipe.measurements?.[`ingredient-${index}`];
  return validMeasurement(value) && value.rawName === line ? value : null;
}
const api = { cleanMeasurements, withMeasurements, measurementFor };
export { cleanMeasurements, withMeasurements, measurementFor };
export default api;
