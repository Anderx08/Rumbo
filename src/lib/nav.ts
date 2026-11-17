export interface Section {
  href: string;
  label: string;
  icon: string;
  tone: string;
}

export const SECTIONS: Section[] = [
  { href: "/", label: "Panel", icon: "panel", tone: "ink" },
  { href: "/movimientos", label: "Movimientos", icon: "transfer", tone: "ink" },
  { href: "/presupuesto", label: "Presupuesto", icon: "budget", tone: "gasto" },
  { href: "/metas", label: "Metas", icon: "target", tone: "meta" },
  { href: "/cuentas", label: "Cuentas", icon: "wallet", tone: "cuenta" },
  { href: "/deudas", label: "Deudas", icon: "card", tone: "deuda" },
  { href: "/recurrentes", label: "Recurrentes", icon: "repeat", tone: "recur" },
  { href: "/plan", label: "Largo plazo", icon: "trending", tone: "plan" },
  { href: "/reportes", label: "Reportes", icon: "chart", tone: "ink" },
  { href: "/ajustes", label: "Ajustes", icon: "settings", tone: "ink" },
];

export const sectionFor = (pathname: string) =>
  SECTIONS.find((s) =>
    s.href === "/" ? pathname === "/" : pathname.startsWith(s.href),
  ) ?? SECTIONS[0];

export const nextSection = (href: string) => {
  const i = SECTIONS.findIndex((s) => s.href === href);
  return SECTIONS[(i + 1) % SECTIONS.length];
};
