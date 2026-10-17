const fs = require("fs");
const { spawnSync } = require("child_process");
const { cleanSnapshot } = require("../src/domain/packages.js");
function api(endpoint, method = "GET", body) {
  const result = spawnSync(
    "gh",
    ["api", endpoint, "--method", method, ...(body ? ["--input", "-"] : [])],
    { input: body ? JSON.stringify(body) : undefined, encoding: "utf8" },
  );
  if (result.status !== 0) {
    const error = new Error(
      `GitHub data publication request failed (${method} ${endpoint})`,
    );
    error.notFound = /404/.test(result.stderr);
    throw error;
  }
  return JSON.parse(result.stdout);
}
function publish(repository, file, { request = api } = {}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository))
    throw new Error("Invalid repository");
  const snapshot = cleanSnapshot(JSON.parse(fs.readFileSync(file, "utf8")));
  const root = `repos/${repository}/git`;
  let parent = null;
  try {
    parent = request(`${root}/ref/heads/price-data`).object.sha;
  } catch (error) {
    if (!error.notFound) throw error;
  }
  const tree = request(`${root}/trees`, "POST", {
    tree: [
      {
        path: "market.json",
        mode: "100644",
        type: "blob",
        content: JSON.stringify(snapshot),
      },
    ],
  });
  const commit = request(`${root}/commits`, "POST", {
    message: `Update public price evidence ${snapshot.date}`,
    tree: tree.sha,
    parents: parent ? [parent] : [],
  });
  if (parent)
    request(`${root}/refs/heads/price-data`, "PATCH", {
      sha: commit.sha,
      force: false,
    });
  else
    request(`${root}/refs`, "POST", {
      ref: "refs/heads/price-data",
      sha: commit.sha,
    });
  console.log(
    `Published package/source snapshot to ${repository} price-data at ${commit.sha}.`,
  );
  return commit.sha;
}
if (require.main === module) {
  try {
    publish(
      process.env.GITHUB_REPOSITORY || "comaverick/ma-ano-mura-react",
      process.argv[2],
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { publish };
