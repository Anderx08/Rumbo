import type { Currency, Money } from "./types";

const NBSP = " ";
const SYMBOL: Record<Currency, string> = { CRC: "₡", USD: "$" };

const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);

export interface FmtOpts {
  /** Antepone + a los positivos. */
  sign?: boolean;
  /** Fuerza o esconde los decimales. Por defecto: CRC sin, USD con. */
  cents?: boolean;
  /** 1,2 M / 850 mil para espacios pequeños. */
  compact?: boolean;
}

/**
 * Formato es-CR: ₡412 300 y $1 234,56. Se formatea a mano para que el
 * resultado sea idéntico en servidor y navegador.
 */
export function fmt(amount: Money, currency: Currency, opts: FmtOpts = {}) {
  const neg = amount < 0;
  const abs = Math.abs(amount);
  const prefix = neg ? "−" : opts.sign && abs > 0 ? "+" : "";
  const sym = SYMBOL[currency];

  if (opts.compact) {
    const units = abs / 100;
    if (units >= 1_000_000) {
      const v = units / 1_000_000;
      return `${prefix}${sym}${v.toFixed(v >= 10 ? 1 : 2).replace(".", ",")}${NBSP}M`;
    }
    if (units >= 10_000) {
      return `${prefix}${sym}${Math.round(units / 1000)}${NBSP}mil`;
    }
  }

  const cents = opts.cents ?? currency === "USD";
  if (!cents) return `${prefix}${sym}${group(String(Math.round(abs / 100)))}`;
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${prefix}${sym}${group(String(whole))},${frac}`;
}

/**
 * Interpreta lo que escribe una persona: "12500", "12.500", "12 500,50",
 * "12,500.50", "₡1.250.000". Devuelve unidades menores o null si no es válido.
 */
export function parseAmount(text: string): Money | null {
  const clean = text.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(clean)) return null;
  const negative = clean.startsWith("-");
  const body = clean.replace(/-/g, "");

  const lastDot = body.lastIndexOf(".");
  const lastComma = body.lastIndexOf(",");
  let intPart = body;
  let fracPart = "";

  if (lastDot >= 0 && lastComma >= 0) {
    // Ambos: el último es el decimal.
    const cut = Math.max(lastDot, lastComma);
    intPart = body.slice(0, cut);
    fracPart = body.slice(cut + 1);
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? "." : ",";
    const parts = body.split(sep);
    const tail = parts[parts.length - 1];
    // Un solo separador seguido de 1 o 2 dígitos es decimal; con 3 es de miles.
    if (parts.length === 2 && tail.length !== 3) {
      intPart = parts[0];
      fracPart = tail;
    }
  }

  const whole = Number(intPart.replace(/[.,]/g, "") || "0");
  const frac = Number((fracPart + "00").slice(0, 2));
  if (!Number.isFinite(whole) || !Number.isFinite(frac)) return null;
  const value = whole * 100 + frac;
  return negative ? -value : value;
}

/** Texto editable para un campo de monto, sin símbolo. */
export function toInput(amount: Money, currency: Currency) {
  const abs = Math.abs(amount);
  if (currency === "CRC" && abs % 100 === 0) return String(abs / 100);
  return `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

/** Convierte entre monedas usando colones por dólar. */
export function convert(
  amount: Money,
  from: Currency,
  to: Currency,
  usdRate: number,
): Money {
  if (from === to) return amount;
  if (!(usdRate > 0)) return 0;
  return from === "USD"
    ? Math.round(amount * usdRate)
    : Math.round(amount / usdRate);
}

export const pct = (ratio: number, digits = 0) =>
  `${(ratio * 100).toFixed(digits).replace(".", ",")}%`;
