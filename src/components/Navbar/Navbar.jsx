import { NavLink, Link } from "react-router-dom";
import { EnvironmentOutlined, ArrowRightOutlined } from "@ant-design/icons";
import logo from "../../assets/logo.svg";
import "./Navbar.css";
export default function Navbar() {
  return (
    <header className="navbar">
      <nav className="navbar-container" aria-label="Main navigation">
        <Link to="/" className="logo">
          <img src={logo} alt="" />
          <span>
            Ma-Ano-Mura<span className="logo-dot">.</span>
          </span>
        </Link>
        <div className="navigation">
          {[
            ["/", "Home"],
            ["/recipes", "Recipes"],
            ["/prices", "Prices"],
            ["/categories", "Categories"],
          ].map(([path, label]) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              className={({ isActive }) =>
                `nav-link${isActive ? " nav-active" : ""}`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
        <Link to="/prices" className="nav-location">
          <EnvironmentOutlined /> NCR, Philippines <ArrowRightOutlined />
        </Link>
      </nav>
    </header>
  );
}
