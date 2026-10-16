import "./App.css";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Link,
} from "react-router-dom";
import { ConfigProvider } from "antd";
import { useEffect } from "react";
import Home from "./pages/Home";
import Recipes from "./pages/Recipes";
import Prices from "./pages/Prices/Prices";
import Categories from "./pages/Categories";
import Navbar from "./components/Navbar/Navbar";
import Footer from "./components/Footer";
import { MarketProvider } from "./context/MarketContext";
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#265b3d",
          borderRadius: 12,
          fontFamily: '"DM Sans", "Segoe UI", sans-serif',
          colorText: "#20372b",
        },
      }}
    >
      <BrowserRouter>
        <MarketProvider>
          <ScrollToTop />
          <a className="skip-link" href="#main-content">
            Skip to content
          </a>
          <Navbar />
          <div id="main-content" tabIndex={-1}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/recipes" element={<Recipes />} />
              <Route path="/prices" element={<Prices />} />
              <Route path="/categories" element={<Categories />} />
              <Route
                path="*"
                element={
                  <main className="page-shell empty-page">
                    <h1>That page isn’t on the menu.</h1>
                    <Link className="button button-dark" to="/">
                      Back to home
                    </Link>
                  </main>
                }
              />
            </Routes>
          </div>
          <Footer />
        </MarketProvider>
      </BrowserRouter>
    </ConfigProvider>
  );
}
export default App;
