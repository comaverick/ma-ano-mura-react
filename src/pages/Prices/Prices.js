import React from 'react'
import PriceHero from '../../components/PriceHero/PriceHero';
import PriceToolbar from '../../components/PriceToolbar/PriceToolbar';
import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import IngredientCard from '../../components/IngredientCard/IngredientCard';
import './Prices.css'

const Prices = () => {

  const [ingredients, setIngredients] = useState([]);

  useEffect(() => {
    getIngredients();
  }, []);

  const getIngredients = async () => {
    const { data, error } = await supabase
      .from("ingredients")
      .select(`
        id,
        name,
        unit,
        category,
        prices (
          id,
          avg_price,
          date,
          created_at,
          location_id
        )
      `);

    if (error) {
      console.error("Error fetching ingredients:", error);
      return;
    }

    console.log(data);
    setIngredients(data);
  };


  return (
    <div>
      <PriceHero></PriceHero>
      <PriceToolbar></PriceToolbar>
      <div className="ingredient-grid">
        {ingredients.map((ingredient) => {

          const prices = [...(ingredient.prices || [])].sort(
            (a, b) => new Date(b.date) - new Date(a.date)
          );

          const latestPrice = prices[0];
          const previousPrice = prices[1];

          return (
            <IngredientCard
              key={ingredient.id}
              name={ingredient.name}
              category={ingredient.category}
              unit={ingredient.unit}
              price={latestPrice?.avg_price}
              previousPrice={previousPrice?.avg_price}
            />
          );
        })}
      </div>
    </div>
  )
}

export default Prices
