import { defineConfig } from "astro/config";
import { config } from "dotenv";
import { env } from "process";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import node from "@astrojs/node";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

// Load environment variables based on NODE_ENV
if (env.NODE_ENV === "test") {
  config({ path: ".env.test" });
} else {
  config(); // loads .env by default
}

// https://astro.build/config
export default defineConfig({
  output: "server",

  integrations: [react({}), sitemap()],

  adapter: env.NODE_ENV === "production" ? cloudflare() : node({ mode: "standalone" }),

  server: {
    port: 3000,
  },

  vite: {
    plugins: [tailwindcss()],
    envPrefix: ["SUPABASE_", "OPENROUTER_", "E2E_"],
    resolve: {
      alias:
        env.NODE_ENV === "production"
          ? {
              "react-dom/server": "react-dom/server.edge",
            }
          : {},
    },
  },
});
