import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import App from "./App";
import costing from "./domain/costing";
import planning from "./domain/planning";
const mockMarket = {};
jest.mock("./services/marketData", () => ({ loadLinkedRecipe: jest.fn() }));
jest.mock("./context/MarketContext", () => ({
  MarketProvider: ({ children }) => children,
  useMarket: () => mockMarket,
}));
beforeEach(() => {
  window.localStorage.clear();
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
test("planner filters budgets and servings, saves favorites, and builds a persistent combined shopping list", async () => {
  window.history.replaceState({}, "", "/planner");
  const view = render(<App />);
  expect(
    screen.getByRole("heading", { name: "Chicken Adobo" }),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Meal budget (₱)"), {
    target: { value: "80" },
  });
  expect(
    screen.queryByRole("heading", { name: "Chicken Adobo" }),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("People to feed"), {
    target: { value: "4" },
  });
  expect(
    screen.queryByRole("heading", { name: "Chicken Adobo" }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Meal budget (₱)"), {
    target: { value: "150" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save Chicken Adobo" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Plan meal" })[0]);
  fireEvent.click(screen.getByRole("button", { name: "Shopping list" }));
  expect(screen.getByText("1 kg")).toBeInTheDocument();
  expect(screen.getAllByText("₱100.00")).toHaveLength(2);
  const check = screen.getByRole("checkbox", { name: /Tomato 1 kg/ });
  fireEvent.click(check);
  expect(check).toBeChecked();
  view.unmount();
  render(<App />);
  expect(screen.getByRole("checkbox", { name: /Tomato 1 kg/ })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Saved recipes (1)" }));
  expect(
    screen.getByRole("heading", { name: "Chicken Adobo" }),
  ).toBeInTheDocument();
});
test("pantry removes owned ingredients from budget suggestions and planned shopping", () => {
  window.history.replaceState({}, "", "/planner");
  render(<App />);
  fireEvent.change(screen.getByLabelText("Meal budget (₱)"), {
    target: { value: "1" },
  });
  expect(
    screen.getByText("No confirmed budget matches yet."),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "Tomato" }));
  expect(
    screen.getByRole("heading", { name: "Chicken Adobo" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Plan meal" })[0]);
  fireEvent.click(screen.getByRole("button", { name: "Shopping list" }));
  expect(screen.getByText("Your pantry has you covered.")).toBeInTheDocument();
});
test("favorites remain usable when browser storage is blocked", () => {
  const blocked = jest
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("Blocked");
    });
  try {
    window.history.replaceState({}, "", "/planner");
    render(<App />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your browser could not save",
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Chicken Adobo" }));
    fireEvent.click(screen.getByRole("button", { name: "Saved recipes (1)" }));
    expect(
      screen.getByRole("heading", { name: "Chicken Adobo" }),
    ).toBeInTheDocument();
  } finally {
    blocked.mockRestore();
  }
});
test("shopping check-offs are separate for different weeks with identical ingredients", () => {
  const current = planning.weekStart();
  const next = planning.shiftDate(current, 7);
  const key = "tomato:kg:0.500000:false";
  localStorage.setItem(
    planning.STORAGE_KEY,
    JSON.stringify({
      plans: [current, next].map((date) => ({
        date,
        slot: "Lunch",
        recipeKey: "chicken adobo",
        servings: 2,
      })),
      checked: [`${current}:${key}`],
    }),
  );
  window.history.replaceState({}, "", "/planner?tab=list");
  render(<App />);
  expect(screen.getByRole("checkbox", { name: /Tomato 500 g/ })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Next week" }));
  expect(
    screen.getByRole("checkbox", { name: /Tomato 500 g/ }),
  ).not.toBeChecked();
});
test("recipe favorites and dated meal selection appear in the weekly planner", () => {
  window.history.replaceState({}, "", "/recipes?recipe=adobo");
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Save Chicken Adobo" }));
  fireEvent.click(screen.getByRole("button", { name: "Plan this meal" }));
  fireEvent.click(screen.getByRole("button", { name: "Add to plan" }));
  fireEvent.click(screen.getByRole("link", { name: "View meal plan →" }));
  expect(
    screen.getByRole("link", { name: "Chicken Adobo" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Remove dinner on/ }));
  expect(
    screen.queryByRole("link", { name: "Chicken Adobo" }),
  ).not.toBeInTheDocument();
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
