import React from 'react'
import { Flex, Button } from "antd";
import "./Navbar.css";
import logo from "../../assets/logo.svg"
import { NavLink, Link, useLocation  } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

const Navbar = () => {
  const location = useLocation();

  const homeRef = useRef(null);
  const recipesRef = useRef(null);
  const pricesRef = useRef(null);
  const categoriesRef = useRef(null);

  const [indicatorStyle, setIndicatorStyle] = useState({});

  useEffect(() => {
    let current;

    switch (location.pathname) {
        case "/":
            current = homeRef.current;
            break;
        case "/recipes":
            current = recipesRef.current;
            break;
        case "/prices":
            current = pricesRef.current;
            break;
        case "/categories":
            current = categoriesRef.current;
            break;
        default:
            current = homeRef.current;
    }

    if (current) {
        setIndicatorStyle({
          width: current.offsetWidth,
          height: current.offsetHeight,
          left: current.offsetLeft,
          top: current.offsetTop,
      });
    }
  }, [location]);
  const getNavClass = ({ isActive }) =>
  isActive ? "nav-link active" : "nav-link";

  return (
    <nav className='navbar'>
      <Flex className='navbar-container' justify="space-between" align="center" >

        <Link to="/" className="logo">
          <img src={logo} alt="Logo" className='logo-image'/>
          <span className='logo-text'>Ma-Ano-Mura</span>
        </Link>

        <Flex className='navigation' gap="small">
          <div ref={homeRef}>
            <NavLink to="/" className={getNavClass}>
                Home
            </NavLink>
          </div>
          
          <div ref={recipesRef}>
            <NavLink ref={recipesRef} to="/recipes" className={getNavClass}>
                Recipes
            </NavLink>
          </div>


          <div ref={pricesRef}>
            <NavLink ref={pricesRef} to="/prices" className={getNavClass}>
                Prices
            </NavLink>
          
          </div>

          <div ref={categoriesRef}>
            <NavLink ref={categoriesRef} to="/categories" className={getNavClass}>
                Categories
            </NavLink>
          </div>
          <div className="nav-indicator" style={indicatorStyle}></div>
        </Flex>

        <div>
          <Button className='button' variant='outlined' shape='round' icon='📍' 
          style={{
            borderColor: "#15803d"
          }}>NCR Prices</Button>
        </div>
        
      </Flex>
    </nav>
  )
}

export default Navbar
