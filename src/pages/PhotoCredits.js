import { Link } from "react-router-dom";
import catalog from "../data/recipePhotos.json";
import "./PhotoCredits.css";

export default function PhotoCredits() {
  return (
    <main className="page-shell photo-credits-page">
      <span className="eyebrow">BEHIND THE FOOD</span>
      <h1>Photos worth sharing.</h1>
      <p className="photo-credits-intro">
        Food photos show serving suggestions for a dish, rather than the exact
        result of every recipe variation. Each photograph below is shared under
        its original license. We resized and compressed the images for faster
        browsing; cards may crop them to fit.
      </p>
      <Link className="text-link" to="/recipes">
        Back to the ulam collection →
      </Link>
      <ul className="photo-credit-list">
        {Object.entries(catalog)
          .sort(([, a], [, b]) => a.label.localeCompare(b.label))
          .map(([id, photo]) => (
            <li key={id}>
              <strong>{photo.label}</strong>
              <span>Photo by {photo.author}</span>
              <span>
                <a href={photo.source} target="_blank" rel="noreferrer">
                  Original photo & credit
                </a>
                {" · "}
                <a href={photo.licenseUrl} target="_blank" rel="noreferrer">
                  {photo.license}
                </a>
              </span>
            </li>
          ))}
      </ul>
    </main>
  );
}
