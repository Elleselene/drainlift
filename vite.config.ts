// Vite config ng DrainLift.
// Dito nakalagay lahat ng plugins na kailangan para tumakbo ang TanStack Start + React + Tailwind.
import path from "node:path";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";
import { VitePWA } from "vite-plugin-pwa";


export default defineConfig(({ command }) => ({
  plugins: [
    // Tailwind CSS v4 (walang tailwind.config.js, nasa styles.css lahat ng setup)
    tailwindcss(),

    // Para gumana yung "@/..." imports base sa "paths" ng tsconfig.json
    tsConfigPaths({ projects: ["./tsconfig.json"] }),

    // TanStack Start = file-based routing + SSR
    tanstackStart({
      // Bawal mag-import ng server-only code sa client side
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
      // Gamitin natin yung src/server.ts bilang server entry (may error page siya)
      server: { entry: "server" },
    }),

    // Nitro = pang-build ng server output.
    // Default: "node-server" (plain Node.js server) — ito ang gamit ng Render at halos lahat
    // ng ibang Node hosting (Railway, Fly.io, sariling VPS, atbp).
    // Pwede itong palitan sa ibang preset (hal. "cloudflare-module" kung Cloudflare Workers
    // ang gagamitin) sa pamamagitan ng NITRO_PRESET environment variable, walang kailangang
    // baguhin dito sa code.
    ...(command === "build"
      ? [nitro({ defaultPreset: process.env["NITRO_PRESET"] || "node-server" })]
      : []),

    // React plugin (JSX + fast refresh)

    VitePWA({
      registerType: "autoUpdate",

      manifest: {
        name: "DrainLift",
        short_name: "DrainLift",
        description: "Smart Drain Waste Monitoring System",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "/",
        scope: "/",

          icons: [
            {
              src: "/pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
          ],
      },

      workbox: {
        navigateFallback: null,
      },
    }),

    viteReact(),
  ],

  // Same CSS transformer na gamit dati para hindi magbago ang lumalabas na styles
  css: { transformer: "lightningcss" },

  resolve: {
    // "@" = src folder, kaya "@/lib/utils" ang import imbes na "../../lib/utils"
    alias: { "@": path.resolve(process.cwd(), "src") },
    // Iwas duplicate copies ng React / React Query (nagka-cause ng "invalid hook call")
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },

  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },

  // Dev server: http://localhost:8080
  server: { host: "::", port: 8080 },
}));
