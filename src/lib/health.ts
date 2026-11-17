import { addDays, endOfMonth, monthKey } from "./dates";
import {
  avgSpendByCategory,
  budgetStatus,
  categoriesById,
  debtInputs,
  goalStats,
  liquidAssets,
  monthElapsed,
  monthlyAverages,
  monthlyEquivalent,
  monthlyInterest,
  spendByCategory,
  toBase,
  accountsById,
  upcoming,
} from "./engine";
import { fmt, pct } from "./money";
import type { Data } from "./types";

const clamp = (v: number) => Math.max(0, Math.min(1, v));

export interface HealthPart {
  key: "savings" | "emergency" | "debt" | "budget";
  label: string;
  score: number;
  max: number;
  detail: string;
}

export interface Health {
  score: number;
  parts: HealthPart[];
}

/**
 * Indicador orientativo de 0 a 100, cuatro partes de 25:
 * tasa de ahorro (20% = máximo), fondo de emergencia (6 meses = máximo),
 * carga de deudas (pagos mínimos sobre ingresos) y disciplina de presupuesto.
 */
export function healthScore(d: Data, todayIso: string): Health {
  const key = monthKey(todayIso);
  const base = d.settings.base;
  const avg = monthlyAverages(d, key);

  const savings = Math.round(clamp(avg.rate / 0.2) * 25);

  const liquid = liquidAssets(d);
  const cover = avg.expense > 0 ? liquid / avg.expense : 0;
  const emergency = Math.round(clamp(cover / 6) * 25);

  const debts = debtInputs(d);
  const mins = debts.reduce((s, x) => s + x.min, 0);
  const load = avg.income > 0 ? mins / avg.income : debts.length ? 1 : 0;
  const debt = debts.length ? Math.round((1 - clamp(load / 0.4)) * 25) : 25;

  const status = budgetStatus(d, key, todayIso);
  const within = status.rows.filter((r) => r.pace !== "over").length;
  const budget = status.rows.length
    ? Math.round((within / status.rows.length) * 25)
    : 0;

  const parts: HealthPart[] = [
    {
      key: "savings",
      label: "Tasa de ahorro",
      score: savings,
      max: 25,
      detail:
        avg.income > 0
          ? `Ahorras ${pct(Math.max(0, avg.rate))} de lo que ingresa. La referencia es 20%.`
          : "Registra tus ingresos para calcularla.",
    },
    {
      key: "emergency",
      label: "Fondo de emergencia",
      score: emergency,
      max: 25,
      detail:
        avg.expense > 0
          ? `Tu dinero disponible cubre ${cover.toFixed(1).replace(".", ",")} meses de gastos. La referencia son 6.`
          : "Registra tus gastos para calcularlo.",
    },
    {
      key: "debt",
      label: "Carga de deudas",
      score: debt,
      max: 25,
      detail: debts.length
        ? `Los pagos mínimos (${fmt(mins, base)}) son ${pct(clamp(load))} de tu ingreso mensual.`
        : "No tienes deudas registradas.",
    },
    {
      key: "budget",
      label: "Presupuesto",
      score: budget,
      max: 25,
      detail: status.rows.length
        ? `${within} de ${status.rows.length} categorías dentro del presupuesto este mes.`
        : "Aún no defines un presupuesto.",
    },
  ];

  return { score: parts.reduce((s, p) => s + p.score, 0), parts };
}

export interface Insight {
  tone: "good" | "warn" | "info";
  title: string;
  body: string;
  href: string;
}

/** Observaciones calculadas con reglas simples sobre los datos del usuario. */
export function insights(d: Data, todayIso: string): Insight[] {
  const out: Insight[] = [];
  const key = monthKey(todayIso);
  const base = d.settings.base;
  const cats = categoriesById(d);
  const accounts = accountsById(d);
  const elapsed = monthElapsed(key, todayIso);
  const avg = monthlyAverages(d, key);

  const overdue = upcoming(d, addDays(todayIso, -1)).length;
  if (overdue) {
    out.push({
      tone: "info",
      title:
        overdue === 1
          ? "Tienes 1 pago recurrente sin registrar"
          : `Tienes ${overdue} pagos recurrentes sin registrar`,
      body: "Regístralos u omítelos para que tus saldos queden al día.",
      href: "/recurrentes",
    });
  }

  const status = budgetStatus(d, key, todayIso);
  for (const r of status.rows.filter((x) => x.pace === "over").slice(0, 2)) {
    out.push({
      tone: "warn",
      title: `Te pasaste en ${r.category.name}`,
      body: `Llevas ${fmt(r.spent, base)} de ${fmt(r.budget, base)}: ${fmt(-r.left, base)} por encima.`,
      href: "/presupuesto",
    });
  }
  for (const r of status.rows.filter((x) => x.pace === "fast").slice(0, 2)) {
    out.push({
      tone: "warn",
      title: `Vas rápido en ${r.category.name}`,
      body: `Ya usaste ${pct(r.ratio)} del presupuesto y ha pasado ${pct(elapsed)} del mes.`,
      href: "/presupuesto",
    });
  }

  if (elapsed >= 0.4 && avg.months > 0) {
    const usual = avgSpendByCategory(d, key);
    const jump = spendByCategory(d, key)
      .map((row) => ({ ...row, usual: usual.get(row.categoryId) ?? 0 }))
      .filter(
        (row) =>
          row.usual > 0 &&
          !(d.budgets[row.categoryId] > 0) &&
          row.amount > row.usual * 1.3 &&
          row.amount - row.usual > avg.income * 0.01,
      )[0];
    if (jump) {
      out.push({
        tone: "warn",
        title: `${cats.get(jump.categoryId)?.name ?? "Sin categoría"} va por encima de lo habitual`,
        body: `Llevas ${fmt(jump.amount, base)} este mes; tu promedio es ${fmt(jump.usual, base)}.`,
        href: "/reportes",
      });
    }
  }

  const debts = debtInputs(d);
  const interest = monthlyInterest(debts);
  if (interest > 0) {
    out.push({
      tone: "warn",
      title: `Tus deudas generan unos ${fmt(interest, base)} de intereses al mes`,
      body: "Un pago extra a la deuda con la tasa más alta es el que más intereses ahorra.",
      href: "/deudas",
    });
  }

  for (const g of d.goals) {
    const s = goalStats(g, todayIso);
    if (s.status === "behind" && s.required) {
      out.push({
        tone: "warn",
        title: `${g.name} va atrasada`,
        body: `Para llegar a tiempo hacen falta ${fmt(s.required, g.currency)} al mes; tu ritmo es ${fmt(s.pace, g.currency)}.`,
        href: "/metas",
      });
      break;
    }
  }

  const subs = d.recurring
    .filter((r) => r.active && r.subscription && r.type === "expense")
    .reduce(
      (s, r) =>
        s +
        toBase(
          d,
          monthlyEquivalent(r),
          accounts.get(r.accountId)?.currency ?? base,
        ),
      0,
    );
  if (subs > 0) {
    out.push({
      tone: "info",
      title: `Tus suscripciones suman ${fmt(subs * 12, base)} al año`,
      body: `Son ${fmt(subs, base)} cada mes. Revisa cuáles sigues usando.`,
      href: "/recurrentes",
    });
  }

  if (avg.expense > 0) {
    const cover = liquidAssets(d) / avg.expense;
    if (cover < 3) {
      out.push({
        tone: "warn",
        title: "Tu fondo de emergencia cubre menos de 3 meses",
        body: `Hoy alcanza para ${cover.toFixed(1).replace(".", ",")} meses de gastos. Seis meses da margen ante un imprevisto.`,
        href: "/metas",
      });
    } else if (cover >= 6) {
      out.push({
        tone: "good",
        title: "Tu fondo de emergencia cubre más de 6 meses",
        body: "Lo que ahorres de más puede ir a metas o al largo plazo.",
        href: "/plan",
      });
    }
  }

  if (avg.income > 0 && avg.rate >= 0.2) {
    out.push({
      tone: "good",
      title: `Estás ahorrando ${pct(avg.rate)} de tus ingresos`,
      body: "Vas por encima de la referencia del 20%.",
      href: "/reportes",
    });
  }

  return out.slice(0, 6);
}

/** Fecha límite usada para listar próximos pagos en el panel. */
export const horizon = (todayIso: string) => {
  const end = endOfMonth(monthKey(todayIso));
  const twoWeeks = addDays(todayIso, 14);
  return end > twoWeeks ? end : twoWeeks;
};
