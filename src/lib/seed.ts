import { addDays, addMonths, daysInMonth, monthKey } from "./dates";
import { advance } from "./engine";
import { convert } from "./money";
import type {
  Account,
  Category,
  Currency,
  Data,
  Goal,
  Recurring,
  Settings,
  Tx,
} from "./types";

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const cat = (
  id: string,
  name: string,
  kind: Category["kind"],
  icon: string,
  hue: number,
  group?: Category["group"],
): Category => ({ id, name, kind, icon, hue, group });

export const DEFAULT_CATEGORIES: Category[] = [
  cat("vivienda", "Vivienda", "expense", "home", 0, "needs"),
  cat("super", "Supermercado", "expense", "cart", 2, "needs"),
  cat("servicios", "Servicios", "expense", "zap", 3, "needs"),
  cat("transporte", "Transporte", "expense", "car", 1, "needs"),
  cat("salud", "Salud", "expense", "heart", 7, "needs"),
  cat("educacion", "Educación", "expense", "school", 6, "needs"),
  cat("seguros", "Seguros e impuestos", "expense", "shield", 5, "needs"),
  cat("intereses", "Intereses y comisiones", "expense", "percent", 7, "needs"),
  cat("restaurantes", "Restaurantes", "expense", "utensils", 4, "wants"),
  cat("entretenimiento", "Entretenimiento", "expense", "film", 6, "wants"),
  cat("suscripciones", "Suscripciones", "expense", "repeat", 2, "wants"),
  cat("compras", "Compras", "expense", "bag", 1, "wants"),
  cat("viajes", "Viajes", "expense", "plane", 0, "wants"),
  cat("cuidado", "Cuidado personal", "expense", "sparkles", 4, "wants"),
  cat("regalos", "Regalos", "expense", "gift", 7, "wants"),
  cat("mascotas", "Mascotas", "expense", "paw", 5, "wants"),
  cat("otros", "Otros gastos", "expense", "dots", 3, "wants"),
  cat("salario", "Salario", "income", "briefcase", 5),
  cat("freelance", "Trabajo independiente", "income", "laptop", 0),
  cat("rendimientos", "Rendimientos", "income", "trending", 6),
  cat("aguinaldo", "Aguinaldo", "income", "gift", 3),
  cat("otros-ingresos", "Otros ingresos", "income", "plus", 2),
];

export const defaultSettings = (base: Currency = "CRC"): Settings => ({
  name: "",
  base,
  usdRate: 505,
  plan: { returnPct: 5, withdrawalPct: 4 },
  debtExtra: 0,
  debtStrategy: "avalanche",
});

export const emptyData = (): Data => ({
  version: 1,
  onboarded: false,
  demo: false,
  accounts: [],
  categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
  txs: [],
  budgets: {},
  goals: [],
  recurring: [],
  settings: defaultSettings(),
});

/* ------------------------------------------------------------------ */
/* Datos de ejemplo                                                    */
/* ------------------------------------------------------------------ */

/** Generador determinista para que el ejemplo sea estable entre recargas. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const col = (colones: number) => Math.round(colones) * 100;
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Seis meses de movimientos de una persona asalariada en Costa Rica.
 * Todo es ficticio y la app lo etiqueta como ejemplo.
 */
export function demoData(todayIso: string, name = ""): Data {
  const rand = mulberry32(20261116);
  const between = (min: number, max: number) =>
    Math.round((min + rand() * (max - min)) / 50) * 50;
  const settings = { ...defaultSettings("CRC"), name, debtExtra: 40_000 * 100 };
  const rate = settings.usdRate;

  const accounts: Account[] = [
    { id: "efectivo", name: "Efectivo", type: "cash", currency: "CRC", opening: col(28_000) },
    { id: "corriente", name: "Cuenta corriente", type: "checking", currency: "CRC", opening: col(180_000), primary: true },
    { id: "ahorros", name: "Ahorros", type: "savings", currency: "CRC", opening: col(900_000) },
    { id: "inversion", name: "Fondo de inversión", type: "investment", currency: "USD", opening: 210_000 },
    {
      id: "tarjeta",
      name: "Tarjeta de crédito",
      type: "credit",
      currency: "CRC",
      opening: -col(720_000),
      apr: 34,
      minPayment: col(36_000),
    },
    {
      id: "prestamo",
      name: "Préstamo personal",
      type: "loan",
      currency: "CRC",
      opening: -col(1_400_000),
      apr: 17,
      minPayment: col(62_000),
    },
  ];

  const txs: Tx[] = [];
  let seq = 0;
  const add = (tx: Omit<Tx, "id" | "createdAt">) => {
    if (tx.date > todayIso) return;
    txs.push({ ...tx, id: `demo-${++seq}`, createdAt: seq });
  };
  const spend = (date: string, colones: number, categoryId: string, note: string, accountId = "corriente") =>
    add({ date, type: "expense", amount: col(colones), accountId, categoryId, note });

  const current = monthKey(todayIso);
  let loan = 1_400_000;
  for (let i = 5; i >= 0; i--) {
    const key = addMonths(current, -i);
    const last = daysInMonth(key);
    const day = (n: number) => `${key}-${pad(Math.min(n, last))}`;
    const anyDay = () => day(1 + Math.floor(rand() * last));

    add({ date: day(15), type: "income", amount: col(425_000), accountId: "corriente", categoryId: "salario", note: "Salario, primera quincena" });
    add({ date: day(last), type: "income", amount: col(425_000), accountId: "corriente", categoryId: "salario", note: "Salario, segunda quincena" });
    if (i === 4 || i === 1) {
      add({ date: day(19), type: "income", amount: col(between(85_000, 140_000)), accountId: "corriente", categoryId: "freelance", note: "Proyecto independiente" });
    }

    spend(day(1), 240_000, "vivienda", "Alquiler");
    for (const n of [3, 10, 17, 24]) spend(day(n), between(26_000, 38_000), "super", "Supermercado");
    spend(day(5), 12_500, "servicios", "Plan celular");
    spend(day(12), between(24_000, 32_000), "servicios", "Electricidad");
    spend(day(14), between(8_500, 11_000), "servicios", "Agua");
    spend(day(20), 24_900, "servicios", "Internet");
    for (const n of [6, 21]) spend(day(n), between(20_000, 26_000), "transporte", "Gasolina");
    if (rand() > 0.5) spend(anyDay(), between(9_000, 22_000), "salud", "Farmacia");
    spend(day(18), between(9_000, 14_000), "cuidado", "Barbería", "efectivo");

    spend(day(3), 18_000, "suscripciones", "Gimnasio", "tarjeta");
    spend(day(9), 4_200, "suscripciones", "Música en línea", "tarjeta");
    spend(day(22), 6_900, "suscripciones", "Películas en línea", "tarjeta");
    for (let n = 0; n < 4; n++) spend(anyDay(), between(2_500, 5_500), "transporte", "Viaje en app", "tarjeta");
    for (let n = 0; n < 5; n++) spend(anyDay(), between(6_000, 14_000), "restaurantes", n % 2 ? "Almuerzo" : "Cena", "tarjeta");
    spend(anyDay(), between(5_000, 12_000), "entretenimiento", "Cine", "tarjeta");
    spend(anyDay(), between(15_000, 45_000), "compras", "Ropa", "tarjeta");
    spend(day(25), between(16_000, 19_000), "intereses", "Intereses de la tarjeta", "tarjeta");

    const loanInterest = Math.round((loan * 0.17) / 12 / 50) * 50;
    spend(day(2), loanInterest, "intereses", "Intereses del préstamo", "prestamo");
    add({ date: day(2), type: "transfer", amount: col(62_000), accountId: "corriente", toAccountId: "prestamo", note: "Cuota del préstamo" });
    loan += loanInterest - 62_000;

    add({ date: day(4), type: "transfer", amount: col(20_000), accountId: "corriente", toAccountId: "efectivo", note: "Retiro de efectivo" });
    add({ date: day(16), type: "transfer", amount: col(between(150_000, 170_000)), accountId: "corriente", toAccountId: "tarjeta", note: "Pago de la tarjeta" });
    add({ date: day(16), type: "transfer", amount: col(60_000), accountId: "corriente", toAccountId: "ahorros", note: "Ahorro del mes" });
    if (i === 3 || i === 1) {
      add({
        date: day(17),
        type: "transfer",
        amount: col(50_000),
        accountId: "corriente",
        toAccountId: "inversion",
        toAmount: convert(col(50_000), "CRC", "USD", rate),
        note: "Aporte al fondo",
      });
    }
  }
  txs.sort((a, b) => a.date.localeCompare(b.date));

  const monthsBack = (n: number, d: number) => {
    const key = addMonths(current, -n);
    return `${key}-${pad(Math.min(d, daysInMonth(key)))}`;
  };
  const contribs = (prefix: string, amount: (i: number) => number, d: number) =>
    [5, 4, 3, 2, 1, 0]
      .map((n, i) => ({ id: `${prefix}-${n}`, date: monthsBack(n, d), amount: amount(i) }))
      .filter((c) => c.date <= todayIso);

  const goals: Goal[] = [
    {
      id: "fondo",
      name: "Fondo de emergencia",
      kind: "emergency",
      target: col(2_000_000),
      currency: "CRC",
      contributions: [
        { id: "fondo-inicial", date: monthsBack(6, 1), amount: col(900_000), note: "Saldo inicial", initial: true },
        ...contribs("fondo", () => col(60_000), 16),
      ],
      createdAt: 1,
    },
    {
      id: "viaje",
      name: "Viaje a Japón",
      kind: "travel",
      target: 320_000,
      currency: "USD",
      deadline: `${addMonths(current, 11)}-01`,
      contributions: [
        { id: "viaje-inicial", date: monthsBack(6, 1), amount: 22_000, note: "Saldo inicial", initial: true },
        ...contribs("viaje", () => 15_000, 17),
      ],
      createdAt: 2,
    },
    {
      id: "laptop",
      name: "Laptop nueva",
      kind: "purchase",
      target: col(950_000),
      currency: "CRC",
      contributions: contribs("laptop", (i) => col(45_000 + (i % 3) * 5_000), 18),
      createdAt: 3,
    },
  ];

  /** Primera fecha con ese día del mes posterior a hoy. */
  const nextDay = (d: number) => {
    const here = `${current}-${pad(Math.min(d, daysInMonth(current)))}`;
    if (here > todayIso) return here;
    const next = addMonths(current, 1);
    return `${next}-${pad(Math.min(d, daysInMonth(next)))}`;
  };
  const year = Number(todayIso.slice(0, 4));
  const marchamo = `${year}-12-15` > todayIso ? `${year}-12-15` : `${year + 1}-12-15`;
  const rec = (
    id: string,
    name: string,
    colones: number,
    categoryId: string,
    nextDate: string,
    extra: Partial<Recurring> = {},
  ): Recurring => ({
    id,
    name,
    type: "expense",
    amount: col(colones),
    accountId: "corriente",
    categoryId,
    frequency: "monthly",
    nextDate,
    active: true,
    ...extra,
  });

  const recurring: Recurring[] = [
    rec("r-salario", "Salario", 425_000, "salario", advance(addDays(todayIso, 0), "semimonthly"), {
      type: "income",
      frequency: "semimonthly",
    }),
    rec("r-alquiler", "Alquiler", 240_000, "vivienda", nextDay(1)),
    rec("r-celular", "Plan celular", 12_500, "servicios", nextDay(5)),
    rec("r-luz", "Electricidad", 28_000, "servicios", nextDay(12)),
    rec("r-agua", "Agua", 9_500, "servicios", nextDay(14)),
    rec("r-internet", "Internet", 24_900, "servicios", nextDay(20)),
    rec("r-gym", "Gimnasio", 18_000, "suscripciones", nextDay(3), { accountId: "tarjeta", subscription: true }),
    rec("r-musica", "Música en línea", 4_200, "suscripciones", nextDay(9), { accountId: "tarjeta", subscription: true }),
    rec("r-pelis", "Películas en línea", 6_900, "suscripciones", nextDay(22), { accountId: "tarjeta", subscription: true }),
    rec("r-marchamo", "Marchamo", 185_000, "seguros", marchamo, { frequency: "yearly" }),
  ];

  const budgets: Record<string, number> = {
    vivienda: col(240_000),
    super: col(135_000),
    servicios: col(80_000),
    transporte: col(65_000),
    restaurantes: col(45_000),
    suscripciones: col(30_000),
    compras: col(35_000),
    entretenimiento: col(15_000),
    salud: col(20_000),
    cuidado: col(15_000),
  };

  return {
    version: 1,
    onboarded: true,
    demo: true,
    accounts,
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    txs,
    budgets,
    goals,
    recurring,
    settings,
  };
}
