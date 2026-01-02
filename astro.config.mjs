// @ts-check
import { defineConfig } from "astro/config";
import { config } from "dotenv";
import { env } from "process";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

// Load environment variables based on NODE_ENV
if (env.NODE_ENV === "test") {
  config({ path: ".env.test" });
} else {
  config(); // loads .env by default
}

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [react(), sitemap()],
  server: { port: 3000 },
  experimental: {
    chromeDevtoolsWorkspace: true,
  },
  vite: {
    plugins: [tailwindcss()],
    envPrefix: ["SUPABASE_", "OPENROUTER_", "E2E_"],
  },
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
});
