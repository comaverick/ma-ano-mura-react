import { render, screen, fireEvent } from "@testing-library/react";
import RecipePhoto from "./RecipePhoto";

jest.mock("../domain/recipePhotos", () => ({
  getRecipePhoto: (recipe) => recipe.photo || null,
  photoUrl: (photo, width) => `/food-photos/${photo.id}-${width}.webp`,
}));
const chicken = {
  name: "Chicken Adobo",
  ingredients: ["1 kg chicken"],
  photo: { id: "chicken-adobo", alt: "Chicken adobo", position: "center" },
};

test("a failed photo falls back without breaking navigation or the next recipe", () => {
  const view = render(<RecipePhoto recipe={chicken} />);
  const image = screen.getByRole("img", {
    name: /Chicken adobo.*serving suggestion/,
  });
  expect(image).toHaveAttribute("loading", "lazy");
  expect(image).toHaveAttribute("srcSet", expect.stringContaining("960w"));
  fireEvent.error(image);
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(view.container.querySelector(".dish-art svg")).toBeInTheDocument();
  expect(screen.queryByText("Serving suggestion")).not.toBeInTheDocument();
  view.rerender(
    <RecipePhoto
      recipe={{
        ...chicken,
        photo: { ...chicken.photo, id: "pork-adobo", alt: "Pork adobo" },
      }}
      priority
    />,
  );
  expect(screen.getByRole("img", { name: /Pork adobo/ })).toHaveAttribute(
    "loading",
    "eager",
  );
});

test("recipes without a verified photo keep a stable illustration", () => {
  const view = render(
    <RecipePhoto
      recipe={{ name: "Vegetable dinner", ingredients: ["500 g tofu"] }}
    />,
  );
  expect(view.container.querySelector(".dish-art svg")).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
