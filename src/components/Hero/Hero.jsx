import React from 'react'
import { Flex, Input, Button } from 'antd'
import "./Hero.css"
import SearchBar from '../SearchBar/SearchBar'

const Hero = () => {
  return (
    <section className='hero'>
        <div className="hero-container">
            <span className='hero-badge'>🔴LIVE NCR MARKET PRICES</span>
            <h1>Find the Cheapest Ingredients Near You</h1>
            <p>
                Track real-time ingredient prices from NCR markets and discover
                delicious recipes that fit your budget.
            </p>
            <SearchBar></SearchBar>
        </div>
    </section>
  )
}

export default Hero
