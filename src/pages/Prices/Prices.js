import React from 'react'
import PriceHero from '../../components/PriceHero/PriceHero';
import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import IngredientCard from '../../components/IngredientCard/IngredientCard';
import { Skeleton, Input } from "antd";
import './Prices.css'
import { SearchOutlined, AppstoreOutlined,
  CoffeeOutlined,
  FireOutlined,
  GiftOutlined,
  InboxOutlined,
  ShopOutlined,
  ShoppingOutlined, } from "@ant-design/icons";

const Prices = () => {

  const categories = [
  { name: "All", icon: <AppstoreOutlined /> },
  { name: "Vegetables", icon: <ShoppingOutlined /> },
  { name: "Meat and Poultry", icon: <FireOutlined /> },
  { name: "Fish", icon: <ShopOutlined /> },
  { name: "Spices", icon: <CoffeeOutlined /> },
  { name: "Fruits", icon: <GiftOutlined /> },
  { name: "Rice", icon: <InboxOutlined /> },
  { name: "Other Commodities", icon: <ShoppingOutlined /> },
];

  const [category, setCategory] = useState("All");

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name"); 

  const [loading, setLoading] = useState(true);
  const [ingredients, setIngredients] = useState([]);

  useEffect(() => {
    getIngredients();
  }, []);

  const getIngredients = async () => {
  setLoading(true);

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
    setLoading(false);
    return;
  }

  setIngredients(data);
  setLoading(false);
};

const filteredIngredients = ingredients
  .filter((ingredient) =>
    ingredient.name.toLowerCase().includes(search.toLowerCase())
  )
  .filter((ingredient) =>
    category === "All" || ingredient.category === category
  )
  .filter((ingredient) => ingredient.prices?.length > 0)
  .sort((a, b) => {
    if (sortBy === "name") {
      return a.name.localeCompare(b.name);
    }

    if (sortBy === "price-low") {
      return Number(a.prices?.[0]?.avg_price || 0) -
             Number(b.prices?.[0]?.avg_price || 0);
    }

    if (sortBy === "price-high") {
      return Number(b.prices?.[0]?.avg_price || 0) -
             Number(a.prices?.[0]?.avg_price || 0);
    }
    if (sortBy === "best" || sortBy === "worst") {
  const getPercentage = (ingredient) => {
    const prices = [...(ingredient.prices || [])].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    const latestPrice = Number(prices[0]?.avg_price || 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const last30Days = prices.filter(
      (item) => new Date(item.date) >= thirtyDaysAgo
    );

    const average =
      last30Days.length > 0
        ? last30Days.reduce(
            (sum, item) => sum + Number(item.avg_price),
            0
          ) / last30Days.length
        : 0;

    return average > 0
      ? ((latestPrice - average) / average) * 100
      : 0;
  };

  const aPercentage = getPercentage(a);
  const bPercentage = getPercentage(b);

  return sortBy === "best"
    ? aPercentage - bPercentage
    : bPercentage - aPercentage;
}

    return 0;
  });

  return (
    <div>
      <PriceHero />
      {/* <PriceToolbar /> */}

    <div className='controls-container' >
      <div className="price-controls">
        <Input
          className='price-search'
          placeholder="Search ingredients..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
        />

        <div className="sort-filters">
          <span className="sort-title">Sort by</span>

          {[
            { value: "name", label: "Name" },
            { value: "price-low", label: "Lowest Price" },
            { value: "price-high", label: "Highest Price" },
            { value: "best", label: "Best Prices" },
            { value: "worst", label: "Worst Prices" },
          ].map((item) => (
            <button
              key={item.value}
              className={sortBy === item.value ? "sort-active" : ""}
              onClick={() => setSortBy(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="category-filters">
        {categories.map((item) => (
          <button
            key={item.name}
            className={category === item.name ? "category-active" : ""}
            onClick={() => setCategory(item.name)}
          >
            {item.icon}
            {item.name}
          </button>
        ))}
      </div>
    </div>
      <div className="ingredient-grid">
        {loading ? (
          Array.from({ length: 8 }).map((_, index) => (
            <div className="ingredient-skeleton" key={index}>
              <Skeleton
                active
                title={{ width: "60%" }}
                paragraph={{ rows: 4 }}
              />
            </div>
            
          ))
        ) : (
          filteredIngredients.map((ingredient) => {
            const prices = [...(ingredient.prices || [])].sort(
              (a, b) => new Date(b.date) - new Date(a.date)
            );

            const latestPrice = prices[0];
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const last30Days = prices.filter(
              (item) => new Date(item.date) >= thirtyDaysAgo
            );

            const monthlyAverage =
              last30Days.length > 0
                ? last30Days.reduce(
                    (sum, item) => sum + Number(item.avg_price),
                    0
                  ) / last30Days.length
                : 0;

            return (
              <IngredientCard
                key={ingredient.id}
                name={ingredient.name}
                category={ingredient.category}
                unit={ingredient.unit}
                price={latestPrice?.avg_price}
                averagePrice={monthlyAverage}
                priceHistory={prices}
              />
            );
          })
        )}
      </div>
      
    </div>
  );
}

export default Prices
