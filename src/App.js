import './App.css';
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Recipes from "./pages/Recipes";
import Prices from "./pages/Prices/Prices";
import Categories from "./pages/Categories";
import Navbar from './components/Navbar/Navbar';

function App() {
  return (
    <BrowserRouter>
      <Navbar />
    
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/prices" element={<Prices />} />
          <Route path="/categories" element={<Categories />} />
        </Routes>
    </BrowserRouter>
  );
  
}

export default App;