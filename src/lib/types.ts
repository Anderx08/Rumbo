/** Todos los montos son enteros en unidades menores (céntimos / centavos). */
export type Money = number;

export type Currency = "CRC" | "USD";

export type AccountType =
  | "cash"
  | "checking"
  | "savings"
  | "investment"
  | "credit"
  | "loan";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  /** La cuenta que se usa sin preguntar al anotar movimientos. */
  primary?: boolean;
  currency: Currency;
  /** Saldo inicial. Negativo para deudas (tarjeta, préstamo). */
  opening: Money;
  /** Tasa anual en % (solo deudas). */
  apr?: number;
  /** Pago mínimo mensual en la moneda de la cuenta (solo deudas). */
  minPayment?: Money;
  archived?: boolean;
}

export type TxType = "expense" | "income" | "transfer";

export interface Tx {
  id: string;
  /** Fecha local YYYY-MM-DD. */
  date: string;
  type: TxType;
  /** Siempre positivo, en la moneda de la cuenta de origen. */
  amount: Money;
  accountId: string;
  /** Solo transferencias. */
  toAccountId?: string;
  /** Monto recibido cuando las monedas difieren. */
  toAmount?: Money;
  categoryId?: string;
  note: string;
  recurringId?: string;
  createdAt: number;
}

export type CatGroup = "needs" | "wants";

export interface Category {
  id: string;
  name: string;
  kind: "expense" | "income";
  /** Para la regla 50/30/20. Solo gastos. */
  group?: CatGroup;
  icon: string;
  /** Índice 0-7 en la paleta categórica (--k0 a --k7). */
  hue: number;
  archived?: boolean;
}

export interface Contribution {
  id: string;
  date: string;
  amount: Money;
  note?: string;
  /** Saldo con el que arrancó la meta; no cuenta para el ritmo mensual. */
  initial?: boolean;
}

export type GoalKind =
  | "emergency"
  | "travel"
  | "purchase"
  | "home"
  | "education"
  | "other";

export interface Goal {
  id: string;
  name: string;
  kind: GoalKind;
  target: Money;
  currency: Currency;
  /** Fecha objetivo YYYY-MM-DD, opcional. */
  deadline?: string;
  contributions: Contribution[];
  createdAt: number;
}

export type Frequency = "weekly" | "semimonthly" | "monthly" | "yearly";

export interface Recurring {
  id: string;
  name: string;
  type: "expense" | "income";
  amount: Money;
  accountId: string;
  categoryId?: string;
  frequency: Frequency;
  /** Próxima fecha pendiente YYYY-MM-DD. */
  nextDate: string;
  active: boolean;
  subscription?: boolean;
}

export type DebtStrategy = "avalanche" | "snowball";

export interface PlanSettings {
  /** Rendimiento anual real esperado, en %. */
  returnPct: number;
  /** Tasa de retiro anual, en %. */
  withdrawalPct: number;
  /** Aporte mensual; si falta se usa el ahorro promedio. */
  monthly?: Money;
  /** Capital invertido hoy; si falta se usa el saldo de cuentas de inversión. */
  invested?: Money;
  /** Gasto anual a cubrir; si falta se usa el gasto promedio x 12. */
  annualSpend?: Money;
}

export interface Settings {
  name: string;
  base: Currency;
  /** Colones por dólar. */
  usdRate: number;
  plan: PlanSettings;
  debtExtra: Money;
  debtStrategy: DebtStrategy;
}

export interface Data {
  version: 1;
  onboarded: boolean;
  /** Verdadero mientras se muestran los datos de ejemplo. */
  demo: boolean;
  accounts: Account[];
  categories: Category[];
  txs: Tx[];
  /** Presupuesto mensual por categoría, en moneda base. */
  budgets: Record<string, Money>;
  goals: Goal[];
  recurring: Recurring[];
  settings: Settings;
}

export type Mode = "light" | "dark" | "system";

export interface UiPrefs {
  mode: Mode;
}

export const LIABILITY_TYPES: AccountType[] = ["credit", "loan"];
export const LIQUID_TYPES: AccountType[] = ["cash", "checking", "savings"];
/** Cuentas de las que sale el gasto del día a día (no ahorros ni inversión). */
export const SPENDING_TYPES: AccountType[] = ["cash", "checking"];

export const isLiability = (a: Account) => LIABILITY_TYPES.includes(a.type);

/**
 * La cuenta que se usa cuando la persona no elige ninguna: la marcada como
 * principal, si no la primera de dinero disponible, si no la primera.
 */
export function defaultAccountId(accounts: Account[]): string {
  const open = accounts.filter((a) => !a.archived);
  return (
    open.find((a) => a.primary)?.id ??
    open.find((a) => SPENDING_TYPES.includes(a.type))?.id ??
    open.find((a) => !isLiability(a))?.id ??
    open[0]?.id ??
    ""
  );
}
