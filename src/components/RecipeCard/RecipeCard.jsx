import React from 'react'
import './RecipeCard.css'
import { Button } from 'antd'

const RecipeCard = ({image}) => {
  return (
    <div className='recipe-card'>
        <div className="recipe-image">
            <img src={image} ></img>
        </div>

        <div className="recipe-content">
            <h3>Chicken Adobo</h3>

            <span className="recipe-price">
                ₱180 • 4 Servings
            </span>

            <p>
                A classic Filipino dish cooked with soy sauce, vinegar, garlic, and spices.
            </p>

            <Button
                className="recipe-button"
                color="green"
                variant="solid"
                block
            >
                View Recipe
            </Button>
        </div>
    </div>
  )
}

export default RecipeCard
