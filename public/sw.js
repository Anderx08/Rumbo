/* global self, caches, fetch, URL, setTimeout */

/*
 * Service worker de Rumbo: deja la app disponible sin conexión.
 *
 * - Al instalarse guarda el HTML de todas las pantallas y los archivos que
 *   referencian (JS, CSS, fuentes precargadas).
 * - Páginas: primero la red; si falla o tarda, la copia guardada.
 * - Archivos de /_next/static: primero la copia guardada (llevan hash en el nombre).
 * - Datos de navegación (RSC): primero la red, con copia de respaldo.
 *
 * La versión llega en la URL de registro (/sw.js?v=...), así cada compilación
 * estrena cachés y borra las anteriores. Los datos del usuario no pasan por
 * aquí: viven en localStorage.
 *
 * ROUTES debe coincidir con SECTIONS en src/lib/nav.ts (lo verifica una prueba).
 */

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const SHELL = `rumbo-shell-${VERSION}`;
const RUNTIME = `rumbo-runtime-${VERSION}`;

const ROUTES = [
  "/",
  "/movimientos",
  "/presupuesto",
  "/metas",
  "/cuentas",
  "/deudas",
  "/recurrentes",
  "/plan",
  "/reportes",
  "/ajustes",
];

const EXTRAS = [
  "/manifest.webmanifest",
  "/icon.svg",
  "/apple-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
];

const ASSET = /(?:\/_next\/)?static\/[A-Za-z0-9_\-./~%[\]@]+\.(?:js|css|woff2)/g;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      const assets = new Set(EXTRAS);
      await Promise.all(
        ROUTES.map(async (route) => {
          const res = await fetch(route, { cache: "reload" });
          if (!res.ok) throw new Error(`No se pudo guardar ${route}`);
          const html = await res.clone().text();
          for (const match of html.matchAll(ASSET)) {
            assets.add(match[0].startsWith("/") ? match[0] : `/_next/${match[0]}`);
          }
          await cache.put(route, res);
        }),
      );
      // Un archivo que falle no debe impedir la instalación.
      await Promise.all(
        [...assets].map(async (url) => {
          try {
            const res = await fetch(url);
            if (res.ok) await cache.put(url, res);
          } catch {
            /* se guardará la primera vez que se pida con conexión */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("rumbo-") && key !== SHELL && key !== RUNTIME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

async function page(request, url) {
  const cache = await caches.open(SHELL);
  const cached = (await cache.match(url.pathname)) || (await cache.match("/"));
  const network = fetch(request).then((res) => {
    if (res.ok && !res.redirected && res.type === "basic") {
      cache.put(url.pathname, res.clone()).catch(() => {});
    }
    return res;
  });
  if (!cached) return network;
  network.catch(() => {});
  try {
    return await Promise.race([
      network,
      wait(3500).then(() => {
        throw new Error("red lenta");
      }),
    ]);
  } catch {
    return cached;
  }
}

async function asset(request) {
  const cached = await caches.match(request, { ignoreSearch: true, ignoreVary: true });
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) {
    const cache = await caches.open(RUNTIME);
    cache.put(request, res.clone()).catch(() => {});
  }
  return res;
}

async function data(request) {
  const cache = await caches.open(RUNTIME);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request.url, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const cached = await cache.match(request.url, { ignoreVary: true });
    if (cached) return cached;
    // Sin copia: el enrutador de Next recurre a una navegación completa,
    // que sí se atiende con el HTML guardado.
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(page(request, url));
  } else if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    EXTRAS.includes(url.pathname)
  ) {
    event.respondWith(asset(request));
  } else if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) {
    event.respondWith(data(request));
  }
});
