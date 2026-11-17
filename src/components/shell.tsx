"use client";

import { ArrowRight, Ellipsis, Monitor, Moon, Plus, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { SECTIONS, sectionFor } from "@/lib/nav";
import { setupOffline } from "@/lib/offline";
import { useSheets } from "@/lib/sheets";
import { applyUi, useStore } from "@/lib/store";
import type { Mode } from "@/lib/types";
import { TxSheet } from "./forms";
import { Onboarding } from "./onboarding";
import { Button, Icon, Logo, Sheet } from "./ui";

const MODES: { value: Mode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Modo claro", icon: Sun },
  { value: "dark", label: "Modo oscuro", icon: Moon },
  { value: "system", label: "Seguir al sistema", icon: Monitor },
];

function ModeToggle() {
  const mode = useStore((s) => s.ui.mode);
  const setMode = useStore((s) => s.setMode);
  const i = MODES.findIndex((m) => m.value === mode);
  const current = MODES[i] ?? MODES[2];
  const next = MODES[(i + 1) % MODES.length];
  const I = current.icon;
  return (
    <button
      type="button"
      className="nav-item w-full cursor-pointer border-0 bg-transparent text-left"
      onClick={() => setMode(next.value)}
      aria-label={`${current.label}. Cambiar a ${next.label.toLowerCase()}`}
    >
      <span className="nav-dot" />
      <span className="nav-pict">
        <I aria-hidden="true" />
      </span>
      {current.label}
    </button>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = sectionFor(pathname).href;
  return (
    <nav className="nav" aria-label="Secciones">
      {SECTIONS.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className="nav-item"
          aria-current={s.href === active ? "page" : undefined}
          onClick={onNavigate}
        >
          <span className="nav-dot" />
          <span className="nav-pict">
            <Icon name={s.icon} />
          </span>
          {s.label}
          <ArrowRight className="nav-arrow" aria-hidden="true" />
        </Link>
      ))}
    </nav>
  );
}

function Sidebar() {
  const openTx = useSheets((s) => s.openTx);
  return (
    <aside className="side">
      <Link href="/" className="brand">
        <Logo />
        Rumbo
      </Link>
      <div className="side-action">
        <Button variant="primary" className="w-full" onClick={() => openTx()}>
          <Plus aria-hidden="true" />
          Anotar movimiento
        </Button>
      </div>
      <NavLinks />
      <div className="mt-auto">
        <ModeToggle />
      </div>
    </aside>
  );
}

function TabBar() {
  const pathname = usePathname();
  const active = sectionFor(pathname).href;
  const openTx = useSheets((s) => s.openTx);
  const [more, setMore] = useState(false);
  const tab = (href: string) => {
    const s = SECTIONS.find((x) => x.href === href)!;
    return (
      <Link href={s.href} className="tab" aria-current={active === s.href ? "page" : undefined}>
        <Icon name={s.icon} />
        {s.label}
      </Link>
    );
  };
  const inMore = !["/", "/movimientos", "/metas"].includes(active);
  return (
    <>
      <nav className="tabbar" aria-label="Navegación principal">
        {tab("/")}
        {tab("/movimientos")}
        <button type="button" className="tab-add" onClick={() => openTx()} aria-label="Anotar movimiento">
          <Plus aria-hidden="true" />
        </button>
        {tab("/metas")}
        <button type="button" className="tab" aria-current={inMore ? "page" : undefined} onClick={() => setMore(true)}>
          <Ellipsis aria-hidden="true" />
          Más
        </button>
      </nav>
      <Sheet open={more} onClose={() => setMore(false)} title="Secciones">
        <div className="sheet-content">
          <div className="side side-inline">
            <NavLinks onNavigate={() => setMore(false)} />
            <ModeToggle />
          </div>
        </div>
      </Sheet>
    </>
  );
}

function DemoBanner() {
  const demo = useStore((s) => s.data.demo);
  const resetAll = useStore((s) => s.resetAll);
  const [armed, setArmed] = useState(false);
  if (!demo) return null;
  return (
    <div className="notice mb-5" role="status">
      <span className="font-semibold">Estás viendo datos de ejemplo.</span>
      <span className="muted-on-notice">Son ficticios: sirven para recorrer la app.</span>
      <span className="ml-auto flex flex-wrap gap-3">
        {armed ? (
          <button type="button" className="linkish" onClick={resetAll}>
            Sí, borrar el ejemplo
          </button>
        ) : (
          <button type="button" className="linkish" onClick={() => setArmed(true)}>
            Borrar y empezar con mis datos
          </button>
        )}
      </span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="app" aria-busy="true" aria-label="Cargando tus datos">
      <aside className="side">
        <div className="skeleton h-7 w-28" />
        <div className="skeleton h-10 w-full" />
        <div className="grid gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton h-5" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
          ))}
        </div>
      </aside>
      <main className="main">
        <div className="skeleton mb-6 h-9 w-64" />
        <div className="skeleton mb-4 h-44 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="skeleton h-56" />
          <div className="skeleton h-56" />
        </div>
      </main>
    </div>
  );
}

/** Contenedor de la app: espera a leer los datos locales antes de pintar las páginas. */
export function Shell({ children }: { children: ReactNode }) {
  const hydrated = useStore((s) => s.hydrated);
  const onboarded = useStore((s) => s.data.onboarded);

  useEffect(() => {
    useStore.getState().hydrate();
    const stopOffline = setupOffline();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyUi(useStore.getState().ui);
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
      stopOffline();
    };
  }, []);

  // Atajo del icono instalado: /?anotar=1 abre directamente el formulario.
  useEffect(() => {
    if (!hydrated || !onboarded) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("anotar")) return;
    url.searchParams.delete("anotar");
    window.history.replaceState(null, "", url.pathname + url.search);
    useSheets.getState().openTx();
  }, [hydrated, onboarded]);

  // Tecla N: anotar un movimiento desde cualquier pantalla.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (document.querySelector("dialog[open]")) return;
      if (!useStore.getState().data.onboarded) return;
      e.preventDefault();
      useSheets.getState().openTx();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!hydrated) return <Skeleton />;
  if (!onboarded) return <Onboarding />;

  return (
    <div className="app">
      <a href="#contenido" className="sr-only-focusable btn btn-primary fixed left-3 top-3 z-50">
        Saltar al contenido
      </a>
      <Sidebar />
      <main className="main" id="contenido">
        <DemoBanner />
        {children}
      </main>
      <TabBar />
      <TxSheet />
    </div>
  );
}
