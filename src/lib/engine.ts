import {
  addDays,
  addMonths,
  addMonthsToDate,
  daysInMonth,
  endOfMonth,
  monthKey,
  monthsBetween,
} from "./dates";
import { convert } from "./money";
import {
  LIQUID_TYPES,
  SPENDING_TYPES,
  isLiability,
  type Account,
  type Category,
  type Currency,
  type Data,
  type Frequency,
  type Goal,
  type Money,
  type Recurring,
  type Tx,
} from "./types";

/* ------------------------------------------------------------------ */
/* Saldos y patrimonio                                                 */
/* ------------------------------------------------------------------ */

export const toBase = (d: Data, amount: Money, currency: Currency) =>
  convert(amount, currency, d.settings.base, d.settings.usdRate);

export const accountsById = (d: Data) =>
  new Map(d.accounts.map((a) => [a.id, a] as const));

export const categoriesById = (d: Data) =>
  new Map(d.categories.map((c) => [c.id, c] as const));

/** Monto que recibe la cuenta destino de una transferencia, en su moneda. */
export function transferIn(tx: Tx, accounts: Map<string, Account>, usdRate: number) {
  if (tx.toAmount != null) return tx.toAmount;
  const from = accounts.get(tx.accountId);
  const to = tx.toAccountId ? accounts.get(tx.toAccountId) : undefined;
  if (!from || !to) return tx.amount;
  return convert(tx.amount, from.currency, to.currency, usdRate);
}

/** Saldo de cada cuenta (en su propia moneda) hasta la fecha indicada inclusive. */
export function balances(d: Data, upTo?: string): Map<string, Money> {
  const accounts = accountsById(d);
  const out = new Map<string, Money>();
  for (const a of d.accounts) out.set(a.id, a.opening);
  for (const tx of d.txs) {
    if (upTo && tx.date > upTo) continue;
    if (tx.type === "income") {
      out.set(tx.accountId, (out.get(tx.accountId) ?? 0) + tx.amount);
    } else if (tx.type === "expense") {
      out.set(tx.accountId, (out.get(tx.accountId) ?? 0) - tx.amount);
    } else {
      out.set(tx.accountId, (out.get(tx.accountId) ?? 0) - tx.amount);
      if (tx.toAccountId) {
        out.set(
          tx.toAccountId,
          (out.get(tx.toAccountId) ?? 0) +
            transferIn(tx, accounts, d.settings.usdRate),
        );
      }
    }
  }
  return out;
}

export interface NetWorth {
  assets: Money;
  liabilities: Money;
  net: Money;
}

/** Patrimonio en moneda base, al tipo de cambio actual. */
export function netWorth(d: Data, upTo?: string): NetWorth {
  const bal = balances(d, upTo);
  let assets = 0;
  let liabilities = 0;
  for (const a of d.accounts) {
    const b = toBase(d, bal.get(a.id) ?? 0, a.currency);
    if (b >= 0) assets += b;
    else liabilities += -b;
  }
  return { assets, liabilities, net: assets - liabilities };
}

export function netWorthSeries(d: Data, keys: string[], todayIso: string) {
  return keys.map((key) => {
    const end = endOfMonth(key);
    return { key, ...netWorth(d, end < todayIso ? end : todayIso) };
  });
}

/** Dinero disponible de inmediato: efectivo, cuentas corrientes y ahorros. */
export function liquidAssets(d: Data) {
  const bal = balances(d);
  return d.accounts
    .filter((a) => LIQUID_TYPES.includes(a.type))
    .reduce((s, a) => s + Math.max(0, toBase(d, bal.get(a.id) ?? 0, a.currency)), 0);
}

export function investedAssets(d: Data) {
  const bal = balances(d);
  return d.accounts
    .filter((a) => a.type === "investment")
    .reduce((s, a) => s + Math.max(0, toBase(d, bal.get(a.id) ?? 0, a.currency)), 0);
}

/* ------------------------------------------------------------------ */
/* Flujo mensual                                                       */
/* ------------------------------------------------------------------ */

export interface MonthFlow {
  key: string;
  income: Money;
  expense: Money;
  net: Money;
  /** Tasa de ahorro: lo que queda de cada colón que entra. */
  rate: number;
}

const txBase = (d: Data, tx: Tx, accounts: Map<string, Account>) =>
  toBase(d, tx.amount, accounts.get(tx.accountId)?.currency ?? d.settings.base);

export function flowSeries(d: Data, keys: string[]): MonthFlow[] {
  const accounts = accountsById(d);
  const idx = new Map(keys.map((k, i) => [k, i] as const));
  const rows = keys.map((key) => ({ key, income: 0, expense: 0, net: 0, rate: 0 }));
  for (const tx of d.txs) {
    if (tx.type === "transfer") continue;
    const i = idx.get(monthKey(tx.date));
    if (i == null) continue;
    const v = txBase(d, tx, accounts);
    if (tx.type === "income") rows[i].income += v;
    else rows[i].expense += v;
  }
  for (const r of rows) {
    r.net = r.income - r.expense;
    r.rate = r.income > 0 ? r.net / r.income : 0;
  }
  return rows;
}

export const monthFlow = (d: Data, key: string) => flowSeries(d, [key])[0];

/** Gasto por categoría en moneda base, de mayor a menor. */
export function spendByCategory(d: Data, key: string) {
  const accounts = accountsById(d);
  const map = new Map<string, Money>();
  for (const tx of d.txs) {
    if (tx.type !== "expense" || monthKey(tx.date) !== key) continue;
    const id = tx.categoryId ?? "";
    map.set(id, (map.get(id) ?? 0) + txBase(d, tx, accounts));
  }
  return [...map.entries()]
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    .sort((a, b) => b.amount - a.amount);
}

/** Los n meses completos anteriores al mes dado que tienen movimientos. */
export function trailingKeys(d: Data, key: string, n = 3) {
  const keys = Array.from({ length: n }, (_, i) => addMonths(key, -(n - i)));
  const active = new Set(d.txs.map((t) => monthKey(t.date)));
  return keys.filter((k) => active.has(k));
}

/** Promedio mensual de ingresos y gastos; si no hay historia usa el mes actual. */
export function monthlyAverages(d: Data, key: string, n = 3) {
  const keys = trailingKeys(d, key, n);
  const rows = flowSeries(d, keys.length ? keys : [key]);
  const count = rows.length || 1;
  const income = rows.reduce((s, r) => s + r.income, 0) / count;
  const expense = rows.reduce((s, r) => s + r.expense, 0) / count;
  return {
    income: Math.round(income),
    expense: Math.round(expense),
    net: Math.round(income - expense),
    rate: income > 0 ? (income - expense) / income : 0,
    months: keys.length,
  };
}

export function avgSpendByCategory(d: Data, key: string, n = 3) {
  const keys = trailingKeys(d, key, n);
  const out = new Map<string, Money>();
  if (!keys.length) return out;
  for (const k of keys) {
    for (const row of spendByCategory(d, k)) {
      out.set(row.categoryId, (out.get(row.categoryId) ?? 0) + row.amount);
    }
  }
  for (const [id, v] of out) out.set(id, Math.round(v / keys.length));
  return out;
}

/** Reparto 50/30/20 real sobre los meses dados. */
export function rule503020(d: Data, keys: string[]) {
  const accounts = accountsById(d);
  const cats = categoriesById(d);
  const set = new Set(keys);
  let income = 0;
  let needs = 0;
  let wants = 0;
  for (const tx of d.txs) {
    if (tx.type === "transfer" || !set.has(monthKey(tx.date))) continue;
    const v = txBase(d, tx, accounts);
    if (tx.type === "income") income += v;
    else if (cats.get(tx.categoryId ?? "")?.group === "needs") needs += v;
    else wants += v;
  }
  return { income, needs, wants, savings: income - needs - wants };
}

/* ------------------------------------------------------------------ */
/* Pagos recurrentes                                                   */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, "0");

/** Siguiente fecha de un pago recurrente. Quincenal = día 15 y fin de mes. */
export function advance(iso: string, frequency: Frequency): string {
  if (frequency === "weekly") return addDays(iso, 7);
  if (frequency === "monthly") return addMonthsToDate(iso, 1);
  if (frequency === "yearly") return addMonthsToDate(iso, 12);
  const key = monthKey(iso);
  const day = Number(iso.slice(8, 10));
  const last = daysInMonth(key);
  if (day < 15) return `${key}-15`;
  if (day < last) return `${key}-${pad(last)}`;
  return `${addMonths(key, 1)}-15`;
}

/** Próximo día de quincena (15 o fin de mes), contando hoy. */
export function nextPayday(iso: string): string {
  const key = monthKey(iso);
  const day = Number(iso.slice(8, 10));
  if (day <= 15) return `${key}-15`;
  return `${key}-${pad(daysInMonth(key))}`;
}

/**
 * Fecha con la que se registra un pago recurrente: la programada si ya pasó,
 * o hoy si llegó antes de tiempo (nunca una fecha futura).
 */
export const postingDate = (scheduled: string, todayIso: string) =>
  scheduled > todayIso ? todayIso : scheduled;

export function monthlyEquivalent(r: Pick<Recurring, "amount" | "frequency">) {
  switch (r.frequency) {
    case "weekly":
      return Math.round((r.amount * 52) / 12);
    case "semimonthly":
      return r.amount * 2;
    case "yearly":
      return Math.round(r.amount / 12);
    default:
      return r.amount;
  }
}

export interface Occurrence {
  recurring: Recurring;
  date: string;
}

/** Todas las ocurrencias pendientes hasta la fecha dada, incluidas las atrasadas. */
export function upcoming(d: Data, until: string): Occurrence[] {
  const out: Occurrence[] = [];
  for (const r of d.recurring) {
    if (!r.active) continue;
    let date = r.nextDate;
    for (let i = 0; i < 60 && date <= until; i++) {
      out.push({ recurring: r, date });
      date = advance(date, r.frequency);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/* ------------------------------------------------------------------ */
/* Presupuesto                                                         */
/* ------------------------------------------------------------------ */

export type Pace = "ok" | "fast" | "over";

export interface BudgetRow {
  category: Category;
  budget: Money;
  spent: Money;
  left: Money;
  ratio: number;
  pace: Pace;
}

export interface BudgetStatus {
  rows: BudgetRow[];
  unbudgeted: { category: Category | undefined; spent: Money }[];
  totalBudget: Money;
  totalSpent: Money;
  /** Fracción del mes transcurrida (0-1). */
  elapsed: number;
}

export function monthElapsed(key: string, todayIso: string) {
  const current = monthKey(todayIso);
  if (key < current) return 1;
  if (key > current) return 0;
  return Number(todayIso.slice(8, 10)) / daysInMonth(key);
}

export function budgetStatus(d: Data, key: string, todayIso: string): BudgetStatus {
  const cats = categoriesById(d);
  const spent = new Map(spendByCategory(d, key).map((r) => [r.categoryId, r.amount]));
  const elapsed = monthElapsed(key, todayIso);
  const isCurrent = key === monthKey(todayIso);
  // Las categorías con pagos fijos (alquiler, suscripciones) se gastan de golpe:
  // ir "adelantado" ahí es normal y no se marca como ritmo rápido.
  const fixed = new Set(
    d.recurring
      .filter((r) => r.active && r.type === "expense" && r.categoryId)
      .map((r) => r.categoryId),
  );

  const rows: BudgetRow[] = [];
  for (const [id, budget] of Object.entries(d.budgets)) {
    const category = cats.get(id);
    if (!category || budget <= 0) continue;
    const s = spent.get(id) ?? 0;
    const ratio = s / budget;
    const pace: Pace =
      ratio > 1
        ? "over"
        : isCurrent && !fixed.has(id) && ratio > elapsed + 0.15
          ? "fast"
          : "ok";
    rows.push({ category, budget, spent: s, left: budget - s, ratio, pace });
  }
  rows.sort((a, b) => b.ratio - a.ratio);

  const unbudgeted = [...spent.entries()]
    .filter(([id]) => !(d.budgets[id] > 0))
    .map(([id, s]) => ({ category: cats.get(id), spent: s }))
    .sort((a, b) => b.spent - a.spent);

  return {
    rows,
    unbudgeted,
    totalBudget: rows.reduce((s, r) => s + r.budget, 0),
    totalSpent: rows.reduce((s, r) => s + r.spent, 0),
    elapsed,
  };
}

export interface Remaining {
  amount: Money;
  perDay: Money;
  daysLeft: number;
  /** De dónde sale la cifra. */
  basis: "budget" | "balance";
  /** Pagos recurrentes ya comprometidos de aquí a fin de mes. */
  committed: Money;
}

/** Saldo de las cuentas del día a día (efectivo y cuentas corrientes), en moneda base. */
export function spendingBalance(d: Data) {
  const bal = balances(d);
  return d.accounts
    .filter((a) => !a.archived && SPENDING_TYPES.includes(a.type))
    .reduce((s, a) => s + toBase(d, bal.get(a.id) ?? 0, a.currency), 0);
}

/**
 * Lo que queda libre para gastar este mes. Con presupuesto: lo no gastado de
 * cada categoría menos los pagos fijos que aún faltan. Sin presupuesto: el
 * dinero de las cuentas del día a día menos los pagos fijos que aún faltan.
 */
export function remainingToSpend(d: Data, todayIso: string): Remaining {
  const key = monthKey(todayIso);
  const daysLeft = daysInMonth(key) - Number(todayIso.slice(8, 10)) + 1;
  const accounts = accountsById(d);

  const pendingByCat = new Map<string, Money>();
  let committed = 0;
  for (const o of upcoming(d, endOfMonth(key))) {
    if (o.recurring.type !== "expense") continue;
    const v = toBase(
      d,
      o.recurring.amount,
      accounts.get(o.recurring.accountId)?.currency ?? d.settings.base,
    );
    committed += v;
    const id = o.recurring.categoryId ?? "";
    pendingByCat.set(id, (pendingByCat.get(id) ?? 0) + v);
  }

  const status = budgetStatus(d, key, todayIso);
  let amount: Money;
  let basis: Remaining["basis"];
  if (status.rows.length) {
    basis = "budget";
    amount = status.rows.reduce(
      (s, r) => s + Math.max(0, r.left - (pendingByCat.get(r.category.id) ?? 0)),
      0,
    );
  } else {
    basis = "balance";
    amount = Math.max(0, spendingBalance(d) - committed);
  }
  return {
    amount,
    perDay: Math.round(amount / Math.max(1, daysLeft)),
    daysLeft,
    basis,
    committed,
  };
}

/* ------------------------------------------------------------------ */
/* Metas de ahorro                                                     */
/* ------------------------------------------------------------------ */

export type GoalStatus = "done" | "onTrack" | "behind" | "idle";

export interface GoalStats {
  saved: Money;
  left: Money;
  ratio: number;
  /** Aporte mensual promedio de los últimos 3 meses. */
  pace: Money;
  /** Aporte mensual necesario para llegar a la fecha objetivo. */
  required: Money | null;
  /** Mes de llegada al ritmo actual (YYYY-MM). */
  eta: string | null;
  status: GoalStatus;
}

export function goalStats(g: Goal, todayIso: string): GoalStats {
  const saved = g.contributions.reduce((s, c) => s + c.amount, 0);
  const left = Math.max(0, g.target - saved);
  const ratio = g.target > 0 ? Math.min(1, saved / g.target) : 0;

  // Ritmo: el mayor entre los últimos 91 días y los 3 meses calendario
  // anteriores, para no castigar a quien aporta a fin de mes. El saldo
  // inicial de la meta no cuenta.
  const regular = g.contributions.filter((c) => !c.initial && c.date <= todayIso);
  const sum = (from: string, to: string) =>
    regular.filter((c) => c.date > from && c.date <= to).reduce((s, c) => s + c.amount, 0);
  const first = regular.reduce((min, c) => (c.date < min ? c.date : min), todayIso);
  const window = Math.min(3, Math.max(1, monthsBetween(first, todayIso)));
  const trailing = sum(addDays(todayIso, -91), todayIso) / window;
  const key = monthKey(todayIso);
  const prior = [3, 2, 1].map((n) => addMonths(key, -n)).filter((k) => k >= monthKey(first));
  const calendar = prior.length
    ? sum(`${prior[0]}-00`, endOfMonth(prior[prior.length - 1])) / prior.length
    : 0;
  const pace = Math.max(0, Math.round(Math.max(trailing, calendar)));

  const eta =
    left === 0
      ? monthKey(todayIso)
      : pace > 0
        ? monthKey(addDays(todayIso, Math.round((left / pace) * 30.4375)))
        : null;

  let required: Money | null = null;
  if (g.deadline && left > 0) {
    const months = Math.max(1, Math.ceil(monthsBetween(todayIso, g.deadline)));
    required = Math.ceil(left / months);
  }

  let status: GoalStatus;
  if (left === 0) status = "done";
  else if (g.deadline) {
    status = eta && eta <= monthKey(g.deadline) ? "onTrack" : "behind";
  } else status = pace > 0 ? "onTrack" : "idle";

  return { saved, left, ratio, pace, required, eta, status };
}

/* ------------------------------------------------------------------ */
/* Deudas                                                              */
/* ------------------------------------------------------------------ */

export interface DebtInput {
  id: string;
  name: string;
  /** Saldo adeudado, positivo, en moneda base. */
  balance: Money;
  apr: number;
  min: Money;
}

export function debtInputs(d: Data): DebtInput[] {
  const bal = balances(d);
  return d.accounts
    .filter((a) => isLiability(a))
    .map((a) => ({
      id: a.id,
      name: a.name,
      balance: Math.max(0, -toBase(d, bal.get(a.id) ?? 0, a.currency)),
      apr: a.apr ?? 0,
      min: toBase(d, a.minPayment ?? 0, a.currency),
    }))
    .filter((x) => x.balance > 0);
}

export interface Payoff {
  months: number;
  interest: Money;
  /** Mes (1 = el próximo) en que se liquida cada deuda. */
  payoff: Record<string, number>;
  /** Saldo total al cierre de cada mes, empezando por hoy. */
  series: Money[];
  /** El pago no alcanza a cubrir los intereses. */
  stuck: boolean;
}

/**
 * Simula el pago de deudas mes a mes. El presupuesto total (mínimos + extra)
 * se mantiene constante: al liquidar una deuda, su pago pasa a la siguiente.
 * Avalancha ataca primero la tasa más alta; bola de nieve, el saldo más bajo.
 */
export function simulatePayoff(
  debts: DebtInput[],
  extra: Money,
  strategy: "avalanche" | "snowball",
  maxMonths = 600,
): Payoff {
  const state = debts.filter((x) => x.balance > 0).map((x) => ({ ...x }));
  const budget = state.reduce((s, x) => s + x.min, 0) + Math.max(0, extra);
  const total = () => state.reduce((s, x) => s + x.balance, 0);
  const payoff: Record<string, number> = {};
  const series = [total()];
  let months = 0;
  let interest = 0;

  while (total() > 0 && months < maxMonths) {
    months++;
    for (const x of state) {
      if (x.balance <= 0) continue;
      const i = Math.round((x.balance * x.apr) / 1200);
      x.balance += i;
      interest += i;
    }
    let avail = budget;
    for (const x of state) {
      if (x.balance <= 0) continue;
      const pay = Math.min(x.min, x.balance, avail);
      x.balance -= pay;
      avail -= pay;
    }
    const order = state
      .filter((x) => x.balance > 0)
      .sort((a, b) =>
        strategy === "avalanche"
          ? b.apr - a.apr || a.balance - b.balance
          : a.balance - b.balance || b.apr - a.apr,
      );
    for (const x of order) {
      if (avail <= 0) break;
      const pay = Math.min(avail, x.balance);
      x.balance -= pay;
      avail -= pay;
    }
    for (const x of state) {
      if (x.balance <= 0 && payoff[x.id] == null) payoff[x.id] = months;
    }
    series.push(total());
  }

  return { months, interest, payoff, series, stuck: total() > 0 };
}

/** Intereses que generan las deudas en un mes, al saldo actual. */
export const monthlyInterest = (debts: DebtInput[]) =>
  debts.reduce((s, x) => s + Math.round((x.balance * x.apr) / 1200), 0);

/* ------------------------------------------------------------------ */
/* Largo plazo                                                         */
/* ------------------------------------------------------------------ */

export interface FiInput {
  invested: Money;
  monthly: Money;
  returnPct: number;
  annualSpend: Money;
  withdrawalPct: number;
  maxYears?: number;
}

export interface FiProjection {
  /** Capital que cubre el gasto anual con la tasa de retiro elegida. */
  target: Money;
  /** Meses hasta alcanzarlo; null si no se llega en el horizonte. */
  months: number | null;
  series: { year: number; value: Money; contributed: Money }[];
}

export function fiProjection(input: FiInput): FiProjection {
  const maxYears = input.maxYears ?? 60;
  const target =
    input.withdrawalPct > 0
      ? Math.round(input.annualSpend / (input.withdrawalPct / 100))
      : Number.POSITIVE_INFINITY;
  const r = Math.pow(1 + input.returnPct / 100, 1 / 12) - 1;
  let value = input.invested;
  let contributed = input.invested;
  let months: number | null = value >= target ? 0 : null;
  const series = [{ year: 0, value: Math.round(value), contributed }];
  for (let m = 1; m <= maxYears * 12; m++) {
    value = value * (1 + r) + input.monthly;
    contributed += input.monthly;
    if (months === null && value >= target) months = m;
    if (m % 12 === 0) {
      series.push({ year: m / 12, value: Math.round(value), contributed });
    }
  }
  return { target, months, series };
}

/** Valores por defecto del plan a partir de los datos registrados. */
export function planDefaults(d: Data, todayIso: string) {
  const avg = monthlyAverages(d, monthKey(todayIso));
  return {
    invested: investedAssets(d),
    monthly: Math.max(0, avg.net),
    annualSpend: avg.expense * 12,
  };
}
