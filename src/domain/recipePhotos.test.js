import { getRecipePhoto, photoUrl } from "./recipePhotos";
import catalog from "../data/recipePhotos.json";

const recipe = (name, ingredients) => ({ name, ingredients });

test("serving photos follow dish identity and the listed protein", () => {
  expect(
    getRecipePhoto(recipe("Chicken Adobo Recipe", ["1 kg chicken"]))?.id,
  ).toBe("chicken-adobo");
  expect(getRecipePhoto(recipe("Adobong Baboy", ["1 kg pork belly"]))?.id).toBe(
    "pork-adobo",
  );
  expect(
    getRecipePhoto(recipe("Chicken Sinigang", ["1 kg chicken"])),
  ).toBeNull();
  expect(
    getRecipePhoto(
      recipe("Vegetarian Adobo", ["500 g tofu", "1 cup soy sauce"]),
    ),
  ).toBeNull();
  expect(getRecipePhoto(recipe("Tofu Sisig", ["500 g tofu"]))?.id).toBe(
    "tofu-sisig",
  );
});

test("transformed dishes and unknown recipes retain the illustrated fallback", () => {
  for (const name of [
    "Adobo Fried Rice",
    "Adobo Pasta",
    "Adobo Meatballs",
    "Chicken adobo sandwich",
  ]) {
    expect(getRecipePhoto(recipe(name, ["1 kg chicken"]))).toBeNull();
  }
  expect(getRecipePhoto(recipe("Unlisted dinner", ["500 g pork"]))).toBeNull();
  expect(getRecipePhoto(null)).toBeNull();
  expect(getRecipePhoto(recipe("Chicken Adobo", []))).toBeNull();
  expect(
    getRecipePhoto(
      recipe("Adobong Atay ng Manok (Chicken Liver Adobo)", [
        "500 g chicken liver",
      ]),
    ),
  ).toBeNull();
  expect(
    getRecipePhoto(recipe("Beef Liver Bistek", ["500 g beef liver"])),
  ).toBeNull();
});

test("every bundled photo has an original source, author and reuse license", () => {
  expect(Object.keys(catalog).length).toBeGreaterThan(30);
  for (const [id, photo] of Object.entries(catalog)) {
    expect(photo.author).toBeTruthy();
    expect(photo.source).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
    expect(photo.license).toMatch(/^(CC BY|CC0|Public domain)/);
    expect(photo.licenseUrl).toMatch(/^https:\/\//);
    expect(photoUrl({ id })).toContain(`/food-photos/${id}-480.webp`);
  }
});
