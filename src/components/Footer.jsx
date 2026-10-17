import { Link } from "react-router-dom";
import { ArrowRightOutlined } from "@ant-design/icons";
export default function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <Link className="footer-brand" to="/">
          Ma-Ano-Mura.
        </Link>
        <p>Good food. Thoughtful spending.</p>
      </div>
      <div className="footer-links">
        <Link to="/planner">
          Plan meals & shopping <ArrowRightOutlined />
        </Link>
        <Link to="/coverage">
          Price coverage & gaps <ArrowRightOutlined />
        </Link>
        <Link to="/recipes">
          Find your next ulam <ArrowRightOutlined />
        </Link>
        <Link to="/prices">
          Explore market prices <ArrowRightOutlined />
        </Link>
      </div>
      <p className="footer-note">
        NCR price estimates from DA Pricewatch & SM Supermarkets.
        <br />
        Prices vary by market and store. Check each quote’s date.
      </p>
    </footer>
  );
}
