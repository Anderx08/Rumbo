import type { NextConfig } from "next";

/**
 * Rumbo es una app de cliente: los datos viven en el navegador y las páginas
 * se pintan después de leerlos. Por eso no se activan Cache Components ni
 * Partial Prefetching, que validan contenido renderizado en el servidor.
 */
const nextConfig: NextConfig = {
  devIndicators: false,
  env: {
    // Cambia en cada compilación: versiona las cachés del service worker.
    NEXT_PUBLIC_BUILD: Date.now().toString(36),
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
