import { fetchAllRows } from "./marketData";
import { supabase } from "../supabaseClient";
jest.mock("../supabaseClient", () => ({ supabase: { from: jest.fn() } }));
function installDataset(rows, { count = rows.length, failStart = null } = {}) {
  const calls = [];
  supabase.from.mockImplementation(() => {
    const query = {
      select: () => query,
      order: () => query,
      range: (start, end) => {
        calls.push([start, end]);
        return Promise.resolve(
          start === failStart
            ? { error: { message: "Page unavailable" } }
            : { data: rows.slice(start, end + 1), count },
        );
      },
    };
    return query;
  });
  return calls;
}
test("loads more than the Supabase 1,000-row default without losing records", async () => {
  const rows = Array.from({ length: 2505 }, (_, id) => ({ id }));
  const calls = installDataset(rows);
  const result = await fetchAllRows("recipes", "id");
  expect(result).toEqual(rows);
  expect(calls).toEqual([
    [0, 999],
    [1000, 1999],
    [2000, 2999],
  ]);
});
test("page failure is reported instead of silently returning a partial collection", async () => {
  installDataset(
    Array.from({ length: 1500 }, (_, id) => ({ id })),
    { failStart: 1000 },
  );
  await expect(fetchAllRows("recipes", "id")).rejects.toThrow(
    "Page unavailable",
  );
});
test("pagination also works when a server cannot return the count", async () => {
  const rows = Array.from({ length: 1003 }, (_, id) => ({ id }));
  installDataset(rows, { count: null });
  expect(await fetchAllRows("recipes", "id")).toEqual(rows);
});
