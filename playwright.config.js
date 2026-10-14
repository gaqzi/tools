import { defineConfig, devices } from "@playwright/test";

const port = 8010;

export default defineConfig({
  testMatch: "**/*.browser.spec.js",
  fullyParallel: true,
  use: { baseURL: `http://localhost:${port}/` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node serve.js ${port}`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: !process.env.CI,
  },
});
