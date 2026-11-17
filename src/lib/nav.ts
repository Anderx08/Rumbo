export interface Section {
  href: string;
  label: string;
  icon: string;
}

export const SECTIONS: Section[] = [
  { href: "/", label: "Panel", icon: "panel" },
  { href: "/movimientos", label: "Movimientos", icon: "transfer" },
  { href: "/presupuesto", label: "Presupuesto", icon: "budget" },
  { href: "/metas", label: "Metas", icon: "target" },
  { href: "/cuentas", label: "Cuentas", icon: "wallet" },
  { href: "/deudas", label: "Deudas", icon: "card" },
  { href: "/recurrentes", label: "Recurrentes", icon: "repeat" },
  { href: "/plan", label: "Largo plazo", icon: "trending" },
  { href: "/reportes", label: "Reportes", icon: "chart" },
  { href: "/ajustes", label: "Ajustes", icon: "settings" },
];

export const sectionFor = (pathname: string) =>
  SECTIONS.find((s) => (s.href === "/" ? pathname === "/" : pathname.startsWith(s.href))) ?? SECTIONS[0];
