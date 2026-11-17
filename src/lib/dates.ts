/** Utilidades de fecha sobre cadenas locales YYYY-MM-DD y claves de mes YYYY-MM. */

const pad = (n: number) => String(n).padStart(2, "0");

export const toISO = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const today = () => toISO(new Date());

/** Interpreta la fecha como local (no UTC) para evitar saltos de día. */
export const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const monthKey = (iso: string) => iso.slice(0, 7);

export const daysInMonth = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

export const addMonths = (key: string, n: number) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export const addDays = (iso: string, n: number) => {
  const d = parse(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

export const diffDays = (from: string, to: string) =>
  Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000);

export const endOfMonth = (key: string) => `${key}-${pad(daysInMonth(key))}`;

/** Las últimas n claves de mes terminando en endKey, en orden ascendente. */
export const lastMonths = (n: number, endKey: string) =>
  Array.from({ length: n }, (_, i) => addMonths(endKey, i - (n - 1)));

/** Meses (con fracción) entre dos fechas. */
export const monthsBetween = (from: string, to: string) =>
  diffDays(from, to) / 30.4375;

/** Suma meses conservando el día cuando existe; si no, usa el último del mes. */
export const addMonthsToDate = (iso: string, n: number) => {
  const day = Number(iso.slice(8, 10));
  const key = addMonths(monthKey(iso), n);
  return `${key}-${pad(Math.min(day, daysInMonth(key)))}`;
};

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const MONTHS_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

export const monthName = (key: string) => MONTHS[Number(key.slice(5, 7)) - 1];

/** "noviembre 2026" */
export const monthLabel = (key: string) =>
  `${monthName(key)} ${key.slice(0, 4)}`;

/** "nov 2026" */
export const monthShort = (key: string) =>
  `${MONTHS_SHORT[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

/** "nov" */
export const monthTiny = (key: string) =>
  MONTHS_SHORT[Number(key.slice(5, 7)) - 1];

/** "16 nov" o "16 nov 2025" cuando el año no es el actual. */
export const fmtDate = (iso: string, withYear?: boolean) => {
  const y = iso.slice(0, 4);
  const base = `${Number(iso.slice(8, 10))} ${MONTHS_SHORT[Number(iso.slice(5, 7)) - 1]}`;
  const showYear = withYear ?? y !== String(new Date().getFullYear());
  return showYear ? `${base} ${y}` : base;
};

/** "Hoy", "Ayer", "Mañana" o la fecha corta. */
export const fmtRelative = (iso: string, ref = today()) => {
  const d = diffDays(ref, iso);
  if (d === 0) return "Hoy";
  if (d === -1) return "Ayer";
  if (d === 1) return "Mañana";
  return fmtDate(iso);
};

/** "en 4 meses", "en 1 año y 2 meses" */
export const humanMonths = (months: number) => {
  const m = Math.max(0, Math.round(months));
  if (m === 0) return "este mes";
  const y = Math.floor(m / 12);
  const r = m % 12;
  const ys = y === 1 ? "1 año" : `${y} años`;
  const ms = r === 1 ? "1 mes" : `${r} meses`;
  if (y === 0) return ms;
  if (r === 0) return ys;
  return `${ys} y ${ms}`;
};
