import { useState } from "react";
import { Link } from "react-router-dom";
import { HeartOutlined, HeartFilled, PlusOutlined } from "@ant-design/icons";
import { useKitchen } from "../context/KitchenContext";
import planning from "../domain/planning.js";
import "./RecipeActions.css";
const { recipeKey, localDate, MEAL_SLOTS } = planning;
export default function RecipeActions({ recipe, servings }) {
  const kitchen = useKitchen();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(localDate());
  const [slot, setSlot] = useState("Dinner");
  const saved = kitchen.favorites.includes(recipeKey(recipe));
  const canPlan = Number(recipe.servings) > 0 && recipe.ingredients?.length > 0;
  const replacing = kitchen.plans.some(
    (item) => item.date === date && item.slot === slot,
  );
  return (
    <div className="recipe-actions-wrap">
      <div className="recipe-actions">
        <button
          className="button"
          aria-label={`${saved ? "Unsave" : "Save"} ${recipe.name}`}
          aria-pressed={saved}
          onClick={() => kitchen.toggleFavorite(recipe)}
        >
          {saved ? <HeartFilled /> : <HeartOutlined />}
          {saved ? "Saved" : "Save recipe"}
        </button>
        <button
          className="button button-dark"
          aria-label="Plan this meal"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          disabled={!canPlan}
        >
          <PlusOutlined /> Plan this meal
        </button>
        <Link className="text-link" to="/planner?tab=week">
          View meal plan →
        </Link>
      </div>
      {!canPlan && (
        <p className="planner-hint">
          Planning needs a recipe with ingredient details and a serving count.
        </p>
      )}
      {open && (
        <form
          className="plan-meal-form"
          onSubmit={(event) => {
            event.preventDefault();
            kitchen.addMeal(recipe, date, slot, servings || recipe.servings);
            setOpen(false);
          }}
        >
          <label>
            Meal date
            <input
              required
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label>
            Meal
            <select
              value={slot}
              onChange={(event) => setSlot(event.target.value)}
            >
              {MEAL_SLOTS.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <button className="button button-dark" type="submit">
            {replacing ? "Replace this meal" : "Add to plan"}
          </button>
          <small>
            {servings || recipe.servings} servings
            {replacing
              ? " · Replaces the meal already in this slot."
              : " · Choose any date."}
          </small>
        </form>
      )}
    </div>
  );
}
