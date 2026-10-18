import { useState } from "react";
import DishArt from "./DishArt";
import { getRecipePhoto, photoUrl } from "../domain/recipePhotos";
import "./RecipePhoto.css";

export default function RecipePhoto({
  recipe,
  className = "",
  priority = false,
  detail = false,
  sizes = "(max-width: 540px) 100vw, (max-width: 1100px) 50vw, 400px",
}) {
  const photo = getRecipePhoto(recipe);
  const [failedId, setFailedId] = useState(null);
  const visible = photo && failedId !== photo.id;
  return (
    <div className={`recipe-photo ${className}`}>
      {visible ? (
        <>
          <img
            src={photoUrl(photo, detail ? 960 : 480)}
            srcSet={`${photoUrl(photo, 480)} 480w, ${photoUrl(photo, 960)} 960w`}
            sizes={sizes}
            alt={`${photo.alt} — serving suggestion`}
            width="960"
            height="640"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            style={{ objectPosition: photo.position }}
            onError={() => setFailedId(photo.id)}
          />
          <span className="recipe-photo-note">Serving suggestion</span>
        </>
      ) : (
        <DishArt recipe={recipe} />
      )}
    </div>
  );
}
