import packages from "../domain/packages.js";
const ENDPOINT =
  "https://raw.githubusercontent.com/comaverick/ma-ano-mura-react/price-data/market.json";
let pending;
export function loadMarketSnapshot({ refresh = false } = {}) {
  if (refresh) pending = null;
  if (!pending)
    pending = fetch(ENDPOINT, {
      cache: "no-cache",
      signal: AbortSignal.timeout(12000),
    })
      .then((response) => {
        if (!response.ok)
          throw new Error("Package/source evidence is unavailable");
        return response.json();
      })
      .then(packages.cleanSnapshot)
      .catch((error) => {
        pending = null;
        throw error;
      });
  return pending;
}
