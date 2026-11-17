"use client";

import { create } from "zustand";

/** Evento de Chromium que permite ofrecer la instalación con un botón propio. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type OfflineStatus =
  | "unsupported" // el navegador no tiene service workers o la página no es segura (HTTPS)
  | "development" // en npm run dev no se activa para no servir código viejo
  | "installing"
  | "ready"
  | "error";

interface OfflineState {
  status: OfflineStatus;
  installed: boolean;
  canInstall: boolean;
  /** null mientras no se sabe. */
  persisted: boolean | null;
  install: () => Promise<void>;
  protect: () => Promise<void>;
}

let promptEvent: InstallPromptEvent | null = null;

export const useOffline = create<OfflineState>((set) => ({
  status: "installing",
  installed: false,
  canInstall: false,
  persisted: null,
  install: async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    promptEvent = null;
    set({ canInstall: false, installed: outcome === "accepted" });
  },
  protect: async () => {
    if (!navigator.storage?.persist) return;
    set({ persisted: await navigator.storage.persist() });
  },
}));

/**
 * Registra el service worker y escucha la oferta de instalación.
 * Se llama una vez al montar la app. Devuelve la función de limpieza.
 */
export function setupOffline() {
  const set = useOffline.setState;

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  set({ installed: standalone });

  navigator.storage?.persisted?.().then((persisted) => set({ persisted }));

  const onPrompt = (e: Event) => {
    e.preventDefault();
    promptEvent = e as InstallPromptEvent;
    set({ canInstall: true });
  };
  const onInstalled = () => {
    promptEvent = null;
    set({ canInstall: false, installed: true });
  };
  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
  const cleanup = () => {
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  };

  if (!("serviceWorker" in navigator)) {
    set({ status: "unsupported" });
    return cleanup;
  }

  if (process.env.NODE_ENV !== "production") {
    // Un service worker de una compilación anterior serviría archivos viejos
    // durante el desarrollo: se retira junto con sus cachés.
    set({ status: "development" });
    void navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => void r.unregister()));
    if ("caches" in window) {
      void caches
        .keys()
        .then((keys) => keys.filter((k) => k.startsWith("rumbo-")).forEach((k) => void caches.delete(k)));
    }
    return cleanup;
  }

  navigator.serviceWorker
    .register(`/sw.js?v=${process.env.NEXT_PUBLIC_BUILD ?? "1"}`, { updateViaCache: "none" })
    .then(() => navigator.serviceWorker.ready)
    .then(() => set({ status: "ready" }))
    .catch(() => set({ status: "error" }));

  return cleanup;
}

export const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
