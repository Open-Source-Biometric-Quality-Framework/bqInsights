const { spawnSync } = require("node:child_process");

const isGitLabCI = process.env.GITLAB_CI === "true";

if (isGitLabCI) {
  console.warn(
    "Skipping bx-report Electron tests (running in GitLab CI; Electron runtime dependencies unavailable)."
  );
  process.exit(0);
}

const result = spawnSync("electron", ["--no-sandbox", "test/test.js"], {
  stdio: "inherit"
});

process.exit(result.status ?? 1);
