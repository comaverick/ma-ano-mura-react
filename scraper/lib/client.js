const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
  quiet: true,
});
// Node's fetch does not automatically honor HTTP_PROXY. Use the managed
// environment's proxy when provided, including its inherited certificate trust.
if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
  const { EnvHttpProxyAgent, setGlobalDispatcher } = require("undici");
  setGlobalDispatcher(new EnvHttpProxyAgent());
}
const { createClient } = require("@supabase/supabase-js");
function getClient() {
  const url = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.REACT_APP_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error(
      "Configure SUPABASE_URL and a Supabase key before running the pipeline.",
    );
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, options) => {
        const response = await fetch(input, {
          ...options,
          signal: options?.signal || AbortSignal.timeout(45000),
        });
        return response;
      },
    },
  });
}
async function fetchAll(client, table, columns = "*") {
  const result = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    result.push(...data);
    if (data.length < 1000) return result;
  }
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function withRetry(fn, { attempts = 3, delayMs = 800 } = {}) {
  let last;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (attempt < attempts - 1) await delay(delayMs * 2 ** attempt);
    }
  }
  throw last;
}
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        results[i] = await fn(items[i], i);
      }
    }),
  );
  return results;
}
module.exports = { getClient, fetchAll, withRetry, mapLimit, delay };
