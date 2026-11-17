import { accountsById, categoriesById, transferIn } from "./engine";
import { defaultSettings, DEFAULT_CATEGORIES } from "./seed";
import type { Data } from "./types";

export const exportJSON = (d: Data) =>
  JSON.stringify({ app: "rumbo", exportedAt: new Date().toISOString(), data: d }, null, 2);

/** Valida un respaldo antes de reemplazar los datos. Lanza un Error legible. */
export function parseBackup(text: string): Data {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es un JSON válido.");
  }
  const wrapper = raw as { app?: string; data?: Partial<Data> };
  const d = (wrapper?.data ?? raw) as Partial<Data>;
  if (!d || typeof d !== "object" || !Array.isArray(d.accounts) || !Array.isArray(d.txs)) {
    throw new Error("El archivo no parece un respaldo de Rumbo: faltan cuentas o movimientos.");
  }
  if (d.version !== 1) {
    throw new Error("Este respaldo es de una versión que esta app no reconoce.");
  }
  const ids = new Set(d.accounts.map((a) => a.id));
  const orphan = d.txs.find((t) => !ids.has(t.accountId));
  if (orphan) {
    throw new Error("El respaldo tiene movimientos de una cuenta que no existe.");
  }
  return {
    version: 1,
    onboarded: true,
    demo: Boolean(d.demo),
    accounts: d.accounts,
    categories: Array.isArray(d.categories) && d.categories.length
      ? d.categories
      : DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    txs: d.txs,
    budgets: d.budgets ?? {},
    goals: Array.isArray(d.goals) ? d.goals : [],
    recurring: Array.isArray(d.recurring) ? d.recurring : [],
    settings: { ...defaultSettings(), ...(d.settings ?? {}) },
  };
}

const cell = (v: string | number) => {
  const s = String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const TYPE: Record<string, string> = {
  expense: "Gasto",
  income: "Ingreso",
  transfer: "Transferencia",
};

/** CSV con punto y coma y BOM para que Excel en español lo abra bien. */
export function toCSV(d: Data) {
  const accounts = accountsById(d);
  const cats = categoriesById(d);
  const head = ["Fecha", "Tipo", "Cuenta", "Cuenta destino", "Categoría", "Nota", "Monto", "Moneda", "Monto recibido"];
  const rows = [...d.txs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => {
      const from = accounts.get(t.accountId);
      const to = t.toAccountId ? accounts.get(t.toAccountId) : undefined;
      const amount = (t.amount / 100).toFixed(2).replace(".", ",");
      const received =
        t.type === "transfer"
          ? (transferIn(t, accounts, d.settings.usdRate) / 100).toFixed(2).replace(".", ",")
          : "";
      return [
        t.date,
        TYPE[t.type],
        from?.name ?? "",
        to?.name ?? "",
        cats.get(t.categoryId ?? "")?.name ?? "",
        t.note,
        t.type === "expense" ? `-${amount}` : amount,
        from?.currency ?? "",
        received,
      ]
        .map(cell)
        .join(";");
    });
  return "﻿" + [head.join(";"), ...rows].join("\r\n");
}

export function download(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
