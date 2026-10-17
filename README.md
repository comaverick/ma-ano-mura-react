# Ma-Ano-Mura

A Filipino meal budget planner using NCR ingredient prices from DA Pricewatch and SM Supermarkets. The React app includes recipe search and cost estimates, ingredient price histories, and category browsing.

## Plan meals and shopping

Open **Planner** from the navigation:

- **Find a meal:** enter a total meal budget and 1–100 servings, choose a price source, and sort by shopping cost or fewest additional ingredients. Only recipes with complete remaining shopping costs and quotes no older than seven days appear as confirmed budget matches. Recipes needing price or quantity review appear separately.
- **Your pantry:** select ingredients you have enough of for all selected meals. English and Filipino aliases are searchable. Selected pantry ingredients are removed from shopping costs and lists; this is an explicit availability assumption, not an inventory quantity tracker.
- **Saved recipes:** save favorites from meal suggestions or recipe details.
- **Weekly plan:** choose any date and breakfast/lunch/dinner slot from the finder or recipe detail page, with scaled servings. One recipe occupies each slot; replacement is explicitly labelled. Navigate between weeks, remove meals, and set a grocery budget per week.
- **Shopping list:** combines ingredient amounts across that week's meals in compatible units, excludes pantry items, and shows missing costs and older quotes. Check items off, copy the list, or print/save it as a PDF. Changing an ingredient's total amount resets its check-off state.

Favorites, pantry selections, plans, weekly budgets and check-offs are saved in this browser under `ma-ano-mura:kitchen:v1`. They are not synced across devices or sent to Supabase. Browser storage failures show a warning; the planner remains usable for the current visit. Clearing site data clears saved kitchen data. Recipe keys use normalized names so database ID changes do not lose saved meals.

Imported recipes without bundled ingredient details keep a small ingredient snapshot when added to the plan, so their shopping quantities survive a reload. Check-offs belong to the selected week and ingredient amount.

Estimates cover ingredient amounts needed, not purchases rounded up to whole packs. Water and unmeasured seasonings remain excluded; actual grocery totals can be higher. Incomplete estimates never claim to fit a budget. Pantry ingredients marked as available can make the remaining shopping estimate complete even when their own source prices are missing.

The **Price coverage & gaps** page, linked from the footer and planner, ranks missing ingredient matches, source prices and quantity conversions by the number of recipes affected. It displays source observation dates and separates missing prices from recipe measurement issues.

## Run locally

Use Node **22.12 or newer**. The frontend uses Create React App; the Node scripts share its ingredient vocabulary and quantity parser through `src/domain/`.

```sh
npm ci
npm ci --prefix scraper --ignore-scripts
npm start
```

Configure these variables in an ignored `.env` file or the execution environment:

- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`

The browser uses only the public Supabase key. Never put a service-role key in a `REACT_APP_` variable. Server scripts also accept `SUPABASE_URL` and `SUPABASE_KEY`, and prefer `SUPABASE_SERVICE_ROLE_KEY` when supplied.

The existing database tables are `ingredients`, `prices`, `recipes`, and `recipe_ingredients`. No schema migration is required. Server credentials must have permission to insert catalog/recipe rows and insert/update prices and recipe links; database policies remain responsible for enforcing access.

## What the app calculates

- Recipes from the bundled CSV are merged with the complete Supabase recipe collection. Duplicate names are consolidated. Original ingredient lines remain visible, including lines that cannot yet be matched.
- DA names, English/Filipino recipe aliases, and SM product names use `src/domain/ingredientCatalog.js`. Generic pork and beef can use a clearly labelled available cut as a price reference; a specifically named cut never inherits a different cut’s price. Similar but distinct foods stay separate: coconut cream is not coconut milk, and sitaw is not Baguio beans.
- Recipe quantities support fractions, mixed numbers, metric/imperial weights, tablespoons, teaspoons, cups, explicit package weights, and parenthetical weight ranges.
- Cups, pieces, density conversions, and range midpoints are cooking estimates. The recipe UI marks approximate conversions. Unsupported units and missing quantities are excluded rather than assigned an invented amount.
- Source-specific views never silently substitute the other source. “Lowest available” compares the latest quote from each source, ignoring quotes more than seven days older than the newest available quote for that ingredient. Only quotes from the latest collected SM batch are eligible for current estimates; older SM records remain in history rather than being carried forward as current availability. Quote dates and older-data warnings remain visible.
- A recipe with missing costs shows a **known ingredient subtotal**, not a complete meal price. Water and seasonings without quantities are excluded. Changing servings scales ingredient quantities and costs.

## Daily GitHub collection

### Price reliability and whole packs

- When Bantay Presyo is unavailable, the scraper discovers official DA **NCR Daily Price Index PDFs** through DA's public WordPress API. It checks the report title, region, internal date and published link date before extracting values with `pdftotext`. It tries the three most recent published reports within two Manila calendar days. Earlier reports keep their actual dates, and older existing rows are preserved even when they belong to the other source.
- SM variable-weight labels use the **minimum stated weight** for a conservative upper unit-price estimate. Both bounds, product URL and package price remain in the audit and public evidence. The UI labels these conversions; no midpoint is treated as an exact quote.
- SM quotes use the **SM Markets Online — NCR** location, separate from DA's regional market location. This respects the existing `(ingredient_id, location_id, date)` uniqueness constraint and permits both sources on the same date without a database migration. The scraper creates the location idempotently when permitted.
- Personal ingredient measurements can be saved in recipe details. They are amounts for the original serving count, scale with servings, and apply to planner and shopping costs. They are tied to the original ingredient text so a changed recipe cannot silently inherit an unrelated measurement. Unspecified frying oil stays missing until the user supplies an amount or marks it available in the pantry.
- The shopping list shows an additional **SM whole-pack estimate**, rounds combined quantities up to complete packages, and considers actual pack prices rather than only the lowest unit price. Missing packages remain excluded and explicitly prevent a confirmed checkout total. Variable-weight packs use their guaranteed minimum weight; final weighed checkout prices can differ.
- The daily workflow publishes public package offers, normalized-price evidence and source collection status to `market.json` on the **price-data** branch. The browser reads this public snapshot independently of the main app deployment. Offers are included only when their associated normalized price was verified as saved for that observation date. Snapshot failure does not block ordinary ingredient estimates. The daily workflow needs `contents: write` for this data-only branch; no server key or new database table is needed.
- Reviewed price anomalies are limited to exact ingredient/source/date/value transitions with a source evidence URL. They remain visible in reports as reviewed; any different observation is checked normally. See [the October 17 review](docs/pricing-review.md).

For a human usability session, use [the grocery-planning test guide](docs/usability-test.md). Automated browser checks do not count as participant research.

`.github/workflows/scraper.yml` runs automatically at **00:00 Asia/Manila** (`0 16 * * *` UTC), and also supports **Run workflow** in GitHub Actions. Scheduled workflows run from the repository's default branch, so the updated workflow must be on that branch to take effect. GitHub may delay scheduled execution.

Use the existing repository secrets:

- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`
- Optionally `SUPABASE_SERVICE_ROLE_KEY` when RLS prevents writes with the existing key. Keep this secret server-only.

The daily job:

1. Checks the pricing regression tests.
2. Adds missing recipe-focused catalog definitions and recipe records without deleting existing data.
3. When `SUPABASE_SERVICE_ROLE_KEY` is configured, backfills stored recipe links from the **full raw recipe list**, not only the old canonical-name column. Compatible measurements are converted to the catalog base unit before aggregation. Existing manually measured links are preserved when a new quantity is unavailable. With only the existing public key, this optional backfill is skipped so it cannot block daily price collection. Browser estimates always use the full raw recipe list and do not depend on this backfill.
4. Collects DA observations and SM observations independently. One source's failure does not stop collection from the other source.
5. Reads SM's own public catalog API, including beverages, and supplements category collection with recipe-driven searches prioritized by recipe usage. Only positive PHP prices on in-stock products are eligible. Supplemental searches scan at most three pages each, record truncated searches, and share a 15-minute collection budget; food categories are fully paginated or the source update fails.
6. Rejects unrelated prepared foods, pet products, ambiguous package weights, and unsupported conversions. It normalizes each candidate to the catalog unit before selecting a price.
7. Updates/inserts one quote per ingredient, source, NCR location, and Manila observation date. Reruns update existing same-day rows; they do not delete history. Workflow concurrency prevents overlapping scheduled/manual runs.
8. Audits coverage and uploads the raw observed SM catalog, source quotes, rejected candidates, and coverage reports as a GitHub Actions artifact for 14 days.
9. Checks price quality, writes a readable GitHub Actions summary and `quality.json`/`quality.md` reports, and marks the audit step as failed when coverage falls below 70%, drops by more than five percentage points from the previous healthy run, either source's latest usable quote is over two Manila calendar days old, recent price rows are invalid, or recent same-source prices double/halve with at least a ₱20 change in the catalog unit. Price comparisons require a previous observation within 14 days. Quote changes are flagged for review without deleting price history. Thresholds are centralized in `scraper/lib/quality.js`.
10. Caches a coverage baseline only after the full job succeeds. Failed runs do not replace the last healthy baseline. The first run reports that a baseline is unavailable and still checks absolute coverage, source freshness and price changes. Audit artifacts are uploaded even after collection or quality failures.

**Failure behavior:** responses are validated and retried with timeouts. A failed source leaves its previous quotes in place and makes the workflow fail visibly after the other source has had an opportunity to update. Historical SM JSON files without a current observation timestamp cannot be inserted as today's prices. Failed category collection does not overwrite a previously collected catalog. Individual search failures are recorded in the collection report.

SM quotes represent the lowest matched product per catalog unit, including packaged pantry products. Some product-label conversions use an ingredient-specific density; these approximations are recorded in the source audit. Prices are estimates for planning, not checkout offers or a guarantee of availability at every branch.

## Commands and checks

`.github/workflows/checks.yml` runs frontend interaction/domain tests, scraper tests and a production build on pushes to `main` and pull requests. The scheduled collection workflow remains separate.

```sh
# Frontend interaction and pagination regressions
CI=true npm test -- --watchAll=false --runInBand

# Source parsers, aliases, false-positive matches, units, freshness, costing
npm test --prefix scraper

# Production bundle
npm run build

# Rebuild bundled recipe details after changing the CSV
npm run data:recipes

# Read-only catalog / recipe-link previews
npm run ingredients:add:dry-run --prefix scraper
npm run recipes:link:dry-run --prefix scraper

# Full pipeline preview: reads both sites and the database; no database writes
npm run daily:dry-run --prefix scraper

# Apply a daily collection and create audit reports
npm run daily --prefix scraper

# Audit all bundled recipes against actual saved database prices
npm run coverage --prefix scraper
```

Set `SCRAPER_OUTPUT_DIR` to keep generated source files/reports outside the checkout. The default is `scraper/`; reports are ignored by Git. `npm run sm:all --prefix scraper` collects and inserts only SM prices. The older match/normalize/best entry points now run a shared read-only preview so their matching logic cannot diverge from the production pipeline.

Bundled recipe details are generated from `datasets/filipino_recipes.csv`. When duplicate recipe names exist, the version with the most ingredient lines is retained. Imported database recipes without bundled details continue to use their saved ingredient links.
