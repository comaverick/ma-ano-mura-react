import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import App from "./App";
import costing from "./domain/costing";
const mockMarket = {};
jest.mock("./services/marketData", () => ({ loadLinkedRecipe: jest.fn() }));
jest.mock("./context/MarketContext", () => ({
  MarketProvider: ({ children }) => children,
  useMarket: () => mockMarket,
}));
beforeEach(() => {
  window.history.replaceState({}, "", "/");
  window.scrollTo = jest.fn();
  const ingredients = [
    {
      id: "tomato",
      name: "Tomato",
      unit: "KG",
      category: "Vegetables",
      prices: [
        {
          id: "price-1",
          avg_price: 100,
          date: "2026-10-16",
          source: "DA Pricewatch",
        },
      ],
    },
  ];
  Object.assign(mockMarket, {
    ingredients,
    recipes: [
      {
        id: "adobo",
        name: "Chicken Adobo",
        key: "chicken adobo",
        local: true,
        servings: 2,
        total_time: "30 minutes",
        ingredients: ["500 g tomato", "2 cups water", "Salt to taste"],
        instructions: ["Prepare the ingredients.", "Simmer until cooked."],
      },
      {
        id: "sinigang",
        name: "Pork Sinigang",
        key: "pork sinigang",
        local: true,
        servings: 4,
        ingredients: ["1 kg tomato"],
        instructions: ["Simmer the vegetables."],
      },
    ],
    priceIndex: costing.createPriceIndex(ingredients),
    loading: false,
    recipesLoading: false,
    error: "",
    recipeError: "",
    refresh: jest.fn(),
  });
});
test("home search opens real filtered recipe results", async () => {
  render(<App />);
  fireEvent.change(screen.getByRole("textbox", { name: "Search recipes" }), {
    target: { value: "Sinigang" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: "Pork Sinigang" }),
    ).toBeInTheDocument(),
  );
  expect(window.location.search).toContain("q=Sinigang");
  expect(
    screen.queryByRole("button", { name: /Chicken Adobo 2 servings/ }),
  ).not.toBeInTheDocument();
});
test("ingredient search opens prices and categories link to the correct filter", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Check an ingredient" }));
  fireEvent.change(
    screen.getByRole("textbox", { name: "Search ingredient prices" }),
    { target: { value: "tomato" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  expect(
    await screen.findByRole("button", {
      name: "View price details for Tomato",
    }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Categories" }));
  const category = screen.getByRole("link", {
    name: /Vegetables Fresh greens/,
  });
  expect(category.getAttribute("href")).toBe("/prices?category=Vegetables");
  fireEvent.click(category);
  expect(screen.getByRole("button", { name: /Vegetables/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
test("servings change costs and known subtotals remain transparent", async () => {
  window.history.replaceState({}, "", "/recipes?recipe=adobo");
  render(<App />);
  const summary = screen.getByText("ESTIMATED INGREDIENT COST").parentElement;
  expect(within(summary).getByText("₱50.00")).toBeInTheDocument();
  fireEvent.change(
    screen.getByRole("spinbutton", { name: "Number of servings" }),
    { target: { value: "4" } },
  );
  expect(within(summary).getByText("₱100.00")).toBeInTheDocument();
  expect(screen.getByText("For 4 servings")).toBeInTheDocument();
  expect(
    screen.getByText(/Water and seasonings without quantities are excluded/),
  ).toBeInTheDocument();
});
test("source selection does not substitute another source for a missing quote", async () => {
  window.history.replaceState({}, "", "/recipes?recipe=adobo");
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "SM Supermarket" }));
  expect(screen.getByText("KNOWN INGREDIENT SUBTOTAL")).toBeInTheDocument();
  expect(
    screen.getByText("1 ingredient has no verified price."),
  ).toBeInTheDocument();
});
