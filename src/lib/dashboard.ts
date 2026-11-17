import { addMonths, endOfMonth, monthKey, monthShort } from "./dates";
import {
  balances,
  budgetStatus,
  debtInputs,
  fiProjection,
  goalStats,
  monthFlow,
  monthlyAverages,
  netWorth,
  planDefaults,
  remainingToSpend,
  simulatePayoff,
  toBase,
  upcoming,
  type FiInput,
  type Occurrence,
} from "./engine";
import { horizon } from "./health";
import { fmt, pct } from "./money";
import { isLiability, type Data } from "./types";

const clamp = (v: number) => Math.max(0, Math.min(1, v));

export interface LineItem {
  key: "gasto" | "meta" | "deuda" | "plan";
  icon: string;
  href: string;
  title: string;
  detail: string;
  progress: number;
  /** A dónde llega y cuándo. */
  terminal: string;
}

/** Entradas del plan de largo plazo: lo que el usuario fijó o lo calculado. */
export function fiInput(d: Data, todayIso: string): FiInput & { auto: ReturnType<typeof planDefaults> } {
  const auto = planDefaults(d, todayIso);
  const p = d.settings.plan;
  return {
    invested: p.invested ?? auto.invested,
    monthly: p.monthly ?? auto.monthly,
    annualSpend: p.annualSpend ?? auto.annualSpend,
    returnPct: p.returnPct,
    withdrawalPct: p.withdrawalPct,
    auto,
  };
}

export function debtStart(d: Data) {
  const bal = balances(d);
  return d.accounts
    .filter(isLiability)
    .reduce(
      (s, a) =>
        s + toBase(d, Math.max(Math.abs(Math.min(0, a.opening)), Math.abs(Math.min(0, bal.get(a.id) ?? 0))), a.currency),
      0,
    );
}

/** Ingresos recurrentes que ya tocan (hoy o atrasados), los más viejos primero. */
export function dueIncome(d: Data, todayIso: string): Occurrence[] {
  return upcoming(d, todayIso).filter((o) => o.recurring.type === "income" && o.date === o.recurring.nextDate);
}

export function buildDashboard(d: Data, todayIso: string) {
  const base = d.settings.base;
  const key = monthKey(todayIso);

  const remaining = remainingToSpend(d, todayIso);
  const flow = monthFlow(d, key);
  const net = netWorth(d);
  const prevNet = netWorth(d, endOfMonth(addMonths(key, -1)));
  const status = budgetStatus(d, key, todayIso);
  const avg = monthlyAverages(d, key);

  const budgetRatio = status.totalBudget > 0 ? status.totalSpent / status.totalBudget : null;
  const gasto: LineItem = {
    key: "gasto",
    icon: "budget",
    href: "/presupuesto",
    title: "Gastos del mes",
    detail:
      budgetRatio != null
        ? `${fmt(status.totalSpent, base)} de ${fmt(status.totalBudget, base)} presupuestados`
        : `${fmt(flow.expense, base)} gastados, sin presupuesto definido`,
    progress: budgetRatio != null ? clamp(budgetRatio) : flow.income > 0 ? clamp(flow.expense / flow.income) : 0,
    terminal: budgetRatio != null ? `${pct(budgetRatio)} del presupuesto` : "Crear presupuesto",
  };

  const goals = d.goals.map((goal) => ({ goal, stats: goalStats(goal, todayIso) }));
  const open = goals
    .filter((g) => g.stats.status !== "done")
    .sort((a, b) => (a.stats.eta ?? "9999").localeCompare(b.stats.eta ?? "9999"));
  const focus = open[0];
  const meta: LineItem = focus
    ? {
        key: "meta",
        icon: "target",
        href: "/metas",
        title: focus.goal.name,
        detail: `${fmt(focus.stats.saved, focus.goal.currency)} de ${fmt(focus.goal.target, focus.goal.currency)}`,
        progress: focus.stats.ratio,
        terminal: focus.stats.eta ? `Llegada ${monthShort(focus.stats.eta)}` : "Sin aportes recientes",
      }
    : {
        key: "meta",
        icon: "target",
        href: "/metas",
        title: "Metas de ahorro",
        detail: goals.length ? "Cumpliste todas tus metas" : "Define a dónde quieres llegar",
        progress: goals.length ? 1 : 0,
        terminal: goals.length ? "Cumplidas" : "Crear meta",
      };

  const debts = debtInputs(d);
  const debtTotal = debts.reduce((s, x) => s + x.balance, 0);
  const start = debtStart(d);
  const payoff = debts.length ? simulatePayoff(debts, d.settings.debtExtra, d.settings.debtStrategy) : null;
  const freeMonth = payoff && !payoff.stuck ? addMonths(key, payoff.months) : null;
  const deuda: LineItem = debts.length
    ? {
        key: "deuda",
        icon: "card",
        href: "/deudas",
        title: "Deudas",
        detail: `Debes ${fmt(debtTotal, base)}`,
        progress: start > 0 ? clamp(1 - debtTotal / start) : 0,
        terminal: freeMonth ? `Deuda cero ${monthShort(freeMonth)}` : "El pago no cubre los intereses",
      }
    : {
        key: "deuda",
        icon: "card",
        href: "/deudas",
        title: "Deudas",
        detail: "No tienes deudas registradas",
        progress: 1,
        terminal: "Sin deudas",
      };

  const input = fiInput(d, todayIso);
  const fi = fiProjection(input);
  const fiYear =
    fi.months != null ? Number(key.slice(0, 4)) + Math.floor((Number(key.slice(5, 7)) - 1 + fi.months) / 12) : null;
  const hasPlan = input.annualSpend > 0 && Number.isFinite(fi.target);
  const plan: LineItem = {
    key: "plan",
    icon: "trending",
    href: "/plan",
    title: "Largo plazo",
    detail: hasPlan
      ? `${fmt(input.invested, base, { compact: true })} invertidos de ${fmt(fi.target, base, { compact: true })}`
      : "Registra gastos para calcular tu meta de independencia",
    progress: hasPlan ? clamp(input.invested / fi.target) : 0,
    terminal: !hasPlan ? "Ver el plan" : fiYear ? `Independencia ${fiYear}` : "A más de 60 años",
  };

  return {
    key,
    remaining,
    flow,
    net,
    netChange: net.net - prevNet.net,
    status,
    avg,
    lines: [gasto, meta, deuda, plan],
    next: upcoming(d, horizon(todayIso)),
    due: dueIncome(d, todayIso),
    goals,
    debtTotal,
    freeMonth,
    fiYear,
  };
}

export type Dashboard = ReturnType<typeof buildDashboard>;
