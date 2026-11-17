"use client";

import { useCallback, useState } from "react";
import { today } from "./dates";
import { useStore } from "./store";

/** La fecha de hoy, fija durante la vida del componente. */
export function useToday() {
  const [value] = useState(() => today());
  return value;
}

export const useBase = () => useStore((s) => s.data.settings.base);

/**
 * Ancho en píxeles de un elemento, para dibujar gráficos a medida.
 * Mide al montar (sin esperar al primer aviso del observador) y luego
 * sigue los cambios de tamaño.
 */
export function useWidth<T extends HTMLElement>() {
  const [width, setWidth] = useState(0);
  const ref = useCallback((el: T | null) => {
    if (!el) return;
    setWidth(Math.round(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}
