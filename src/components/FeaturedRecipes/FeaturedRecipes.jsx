import React from 'react'
import './FeaturedRecipes.css'
import RecipeCard from '../RecipeCard/RecipeCard'
import adobo from '../../assets/adobo.png'

const FeaturedRecipes = () => {
  return (
    <section className='featured-recipes'>
      <div className="featured-recipes-container">
        <div className="featured-header">
            <span className="featured-badge">
                FEATURED RECIPES
            </span>

            <h2>Cook Delicious Meals on Any Budget</h2>

            <p>
                Discover affordable Filipino recipes using today's NCR ingredient prices.
            </p>
            <div className="recipe-grid">
                <RecipeCard image={adobo} />
                <RecipeCard image={adobo} />
                <RecipeCard image={adobo} />
            </div>  
        </div>

      </div>
    </section>
  )
}

export default FeaturedRecipes
