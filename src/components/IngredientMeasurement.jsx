import { useState } from "react";
import { useKitchen } from "../context/KitchenContext";
import costing from "../domain/costing.js";
import { formatQuantity } from "../utils/format";
export default function IngredientMeasurement({ recipe, row }) {
  const { setMeasurement } = useKitchen();
  const [open, setOpen] = useState(false);
  const units = [
    "kg",
    "g",
    "l",
    "ml",
    "cup",
    "tbsp",
    "tsp",
    "piece",
    "clove",
    "head",
    "stalk",
    "bunch",
    "thumb",
  ].filter(
    (unit) => costing.convertQuantity(1, unit, row.definition).amount !== null,
  );
  const [quantity, setQuantity] = useState(row.parsed.quantity || "");
  const [unit, setUnit] = useState(
    units.includes(row.parsed.unit)
      ? row.parsed.unit
      : units.includes("tbsp")
        ? "tbsp"
        : units[0] || "g",
  );
  if (!row.definition || row.status === "water") return null;
  return (
    <div className="ingredient-measurement">
      {row.userMeasured && (
        <small>
          Your measurement:{" "}
          {formatQuantity(row.parsed.quantity, row.parsed.unit)} for{" "}
          {recipe.servings || "the original"} servings.
        </small>
      )}
      <button
        className="text-link"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {row.userMeasured ? "Edit your measurement" : "Set my quantity"}
      </button>
      {row.userMeasured && (
        <button
          className="text-link"
          onClick={() => {
            setMeasurement(recipe, row, null);
            setOpen(false);
          }}
        >
          Use original
        </button>
      )}
      {open && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setMeasurement(recipe, row, Number(quantity), unit);
            setOpen(false);
          }}
        >
          <label>
            Amount for original {recipe.servings || "recipe"} servings
            <input
              aria-label={`Your quantity for ${row.definition.name}`}
              required
              type="number"
              min="0.000001"
              max="1000000"
              step="any"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
          <label>
            Unit
            <select
              aria-label={`Your unit for ${row.definition.name}`}
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
            >
              {units.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <button className="button button-dark" type="submit">
            Save quantity
          </button>
          <p>
            Use the amount you actually cook with, including frying oil you need
            to buy. Saved only in this browser; shared recipe quantities stay as
            written.
          </p>
        </form>
      )}
    </div>
  );
}
