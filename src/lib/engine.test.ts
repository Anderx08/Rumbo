import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SECTIONS } from "./nav";
import { addMonthsToDate, daysInMonth, lastMonths } from "./dates";
import {
  advance,
  balances,
  budgetStatus,
  fiProjection,
  flowSeries,
  goalStats,
  monthlyEquivalent,
  netWorth,
  remainingToSpend,
  simulatePayoff,
  upcoming,
} from "./engine";
import { healthScore, insights } from "./health";
import { convert, fmt, parseAmount } from "./money";
import { demoData, emptyData } from "./seed";
import { parseBackup, exportJSON, toCSV } from "./backup";
import type { Data, Tx } from "./types";

const tx = (t: Partial<Tx> & Pick<Tx, "date" | "type" | "amount" | "accountId">): Tx => ({
  id: Math.random().toString(36),
  note: "",
  createdAt: 0,
  ...t,
});

function sample(): Data {
  const d = emptyData();
  d.onboarded = true;
  d.accounts = [
    { id: "crc", name: "Corriente", type: "checking", currency: "CRC", opening: 100_000_00 },
    { id: "usd", name: "Dólares", type: "savings", currency: "USD", opening: 500_00 },
    { id: "card", name: "Tarjeta", type: "credit", currency: "CRC", opening: -200_000_00, apr: 36, minPayment: 10_000_00 },
  ];
  d.settings.usdRate = 500;
  d.txs = [
    tx({ date: "2026-11-01", type: "income", amount: 800_000_00, accountId: "crc", categoryId: "salario" }),
    tx({ date: "2026-11-03", type: "expense", amount: 240_000_00, accountId: "crc", categoryId: "vivienda" }),
    tx({ date: "2026-11-05", type: "expense", amount: 30_000_00, accountId: "card", categoryId: "restaurantes" }),
    tx({ date: "2026-11-06", type: "transfer", amount: 50_000_00, accountId: "crc", toAccountId: "usd", toAmount: 100_00 }),
    tx({ date: "2026-11-07", type: "transfer", amount: 40_000_00, accountId: "crc", toAccountId: "card" }),
    tx({ date: "2026-10-10", type: "expense", amount: 20_000_00, accountId: "crc", categoryId: "super" }),
  ];
  return d;
}

describe("money", () => {
  it("interpreta montos escritos a mano", () => {
    expect(parseAmount("12500")).toBe(12_500_00);
    expect(parseAmount("12.500")).toBe(12_500_00);
    expect(parseAmount("12,500")).toBe(12_500_00);
    expect(parseAmount("₡1.250.000")).toBe(1_250_000_00);
    expect(parseAmount("1 250 000,50")).toBe(1_250_000_50);
    expect(parseAmount("12,500.75")).toBe(12_500_75);
    expect(parseAmount("12.50")).toBe(12_50);
    expect(parseAmount("1,5")).toBe(1_50);
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });

  it("formatea colones sin decimales y dólares con decimales", () => {
    expect(fmt(412_300_00, "CRC")).toBe("₡412 300");
    expect(fmt(-1_234_56, "USD")).toBe("−$1 234,56");
    expect(fmt(5_00, "CRC", { sign: true })).toBe("+₡5");
    expect(fmt(4_850_000_00, "CRC", { compact: true })).toBe("₡4,85 M");
  });

  it("convierte entre monedas", () => {
    expect(convert(100_00, "USD", "CRC", 505)).toBe(50_500_00);
    expect(convert(50_500_00, "CRC", "USD", 505)).toBe(100_00);
    expect(convert(7, "CRC", "CRC", 505)).toBe(7);
  });
});

describe("saldos y patrimonio", () => {
  it("aplica ingresos, gastos y transferencias entre monedas", () => {
    const b = balances(sample());
    expect(b.get("crc")).toBe((100_000 + 800_000 - 240_000 - 50_000 - 40_000 - 20_000) * 100);
    expect(b.get("usd")).toBe(600_00);
    expect(b.get("card")).toBe((-200_000 - 30_000 + 40_000) * 100);
  });

  it("respeta la fecha de corte", () => {
    const b = balances(sample(), "2026-10-31");
    expect(b.get("crc")).toBe(80_000_00);
    expect(b.get("card")).toBe(-200_000_00);
  });

  it("separa activos y pasivos en moneda base", () => {
    const n = netWorth(sample());
    expect(n.assets).toBe(550_000_00 + 600 * 500 * 100);
    expect(n.liabilities).toBe(190_000_00);
    expect(n.net).toBe(n.assets - n.liabilities);
  });

  it("las transferencias no cuentan como ingreso ni gasto", () => {
    const [nov] = flowSeries(sample(), ["2026-11"]);
    expect(nov.income).toBe(800_000_00);
    expect(nov.expense).toBe(270_000_00);
    expect(nov.rate).toBeCloseTo(530 / 800, 5);
  });
});

describe("presupuesto", () => {
  it("marca ritmo rápido y sobregasto", () => {
    const d = sample();
    d.budgets = { vivienda: 240_000_00, restaurantes: 25_000_00, super: 100_000_00 };
    const s = budgetStatus(d, "2026-11", "2026-11-10");
    const by = Object.fromEntries(s.rows.map((r) => [r.category.id, r.pace]));
    expect(by.restaurantes).toBe("over");
    expect(by.vivienda).toBe("fast");
    expect(by.super).toBe("ok");
    expect(s.totalBudget).toBe(365_000_00);
  });

  it("descuenta los pagos fijos pendientes de lo que queda por gastar", () => {
    const d = sample();
    d.budgets = { servicios: 60_000_00, super: 100_000_00 };
    d.recurring = [
      { id: "r", name: "Internet", type: "expense", amount: 25_000_00, accountId: "crc", categoryId: "servicios", frequency: "monthly", nextDate: "2026-11-20", active: true },
    ];
    const r = remainingToSpend(d, "2026-11-16");
    expect(r.basis).toBe("budget");
    expect(r.amount).toBe(35_000_00 + 100_000_00);
    expect(r.daysLeft).toBe(15);
    expect(r.committed).toBe(25_000_00);
  });

  it("sin presupuesto usa ingresos menos gastos", () => {
    const r = remainingToSpend(sample(), "2026-11-16");
    expect(r.basis).toBe("income");
    expect(r.amount).toBe(530_000_00);
  });
});

describe("recurrentes", () => {
  it("la quincena alterna entre el 15 y el fin de mes", () => {
    expect(advance("2026-11-15", "semimonthly")).toBe("2026-11-30");
    expect(advance("2026-11-30", "semimonthly")).toBe("2026-12-15");
    expect(advance("2026-11-03", "semimonthly")).toBe("2026-11-15");
    expect(advance("2027-02-15", "semimonthly")).toBe("2027-02-28");
  });

  it("avanza por semana, mes y año", () => {
    expect(advance("2026-11-28", "weekly")).toBe("2026-12-05");
    expect(advance("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(advance("2026-12-15", "yearly")).toBe("2027-12-15");
    expect(addMonthsToDate("2026-11-30", 3)).toBe("2027-02-28");
    expect(daysInMonth("2028-02")).toBe(29);
  });

  it("calcula el equivalente mensual y lista ocurrencias", () => {
    expect(monthlyEquivalent({ amount: 12_000_00, frequency: "yearly" })).toBe(1_000_00);
    expect(monthlyEquivalent({ amount: 1_000_00, frequency: "semimonthly" })).toBe(2_000_00);
    const d = sample();
    d.recurring = [
      { id: "r", name: "Salario", type: "income", amount: 1, accountId: "crc", frequency: "semimonthly", nextDate: "2026-11-15", active: true },
      { id: "x", name: "Pausado", type: "expense", amount: 1, accountId: "crc", frequency: "monthly", nextDate: "2026-11-01", active: false },
    ];
    expect(upcoming(d, "2026-12-31").map((o) => o.date)).toEqual([
      "2026-11-15",
      "2026-11-30",
      "2026-12-15",
      "2026-12-31",
    ]);
  });
});

describe("metas", () => {
  it("proyecta la llegada al ritmo de los últimos tres meses", () => {
    const s = goalStats(
      {
        id: "g",
        name: "Meta",
        kind: "other",
        target: 1_000_000_00,
        currency: "CRC",
        deadline: "2027-03-31",
        createdAt: 0,
        contributions: [
          { id: "a", date: "2026-05-01", amount: 400_000_00 },
          { id: "b", date: "2026-09-10", amount: 50_000_00 },
          { id: "c", date: "2026-10-10", amount: 50_000_00 },
          { id: "d", date: "2026-11-10", amount: 50_000_00 },
        ],
      },
      "2026-11-16",
    );
    expect(s.saved).toBe(550_000_00);
    expect(s.pace).toBe(50_000_00);
    expect(s.eta).toBe("2027-08");
    expect(s.status).toBe("behind");
    expect(s.required).toBe(90_000_00);
  });

  it("una meta cumplida queda terminada", () => {
    const s = goalStats(
      { id: "g", name: "x", kind: "other", target: 100, currency: "CRC", createdAt: 0, contributions: [{ id: "a", date: "2026-11-01", amount: 150 }] },
      "2026-11-16",
    );
    expect(s.status).toBe("done");
    expect(s.left).toBe(0);
    expect(s.ratio).toBe(1);
  });
});

describe("deudas", () => {
  const debts = [
    { id: "card", name: "Tarjeta", balance: 600_000_00, apr: 36, min: 30_000_00 },
    { id: "loan", name: "Préstamo", balance: 300_000_00, apr: 12, min: 20_000_00 },
  ];

  it("una deuda sin interés se paga en saldo / pago meses", () => {
    const r = simulatePayoff([{ id: "a", name: "a", balance: 120_000_00, apr: 0, min: 10_000_00 }], 0, "avalanche");
    expect(r.months).toBe(12);
    expect(r.interest).toBe(0);
    expect(r.series.at(-1)).toBe(0);
  });

  it("avalancha paga menos intereses que bola de nieve", () => {
    const avalanche = simulatePayoff(debts, 40_000_00, "avalanche");
    const snowball = simulatePayoff(debts, 40_000_00, "snowball");
    expect(avalanche.interest).toBeLessThan(snowball.interest);
    expect(snowball.payoff.loan).toBeLessThan(snowball.payoff.card);
    expect(avalanche.payoff.card).toBeLessThan(avalanche.payoff.loan);
  });

  it("el pago extra acorta el plazo", () => {
    const base = simulatePayoff(debts, 0, "avalanche");
    const extra = simulatePayoff(debts, 40_000_00, "avalanche");
    expect(extra.months).toBeLessThan(base.months);
    expect(extra.interest).toBeLessThan(base.interest);
  });

  it("detecta cuando el pago no cubre los intereses", () => {
    const r = simulatePayoff([{ id: "a", name: "a", balance: 1_000_000_00, apr: 36, min: 10_000_00 }], 0, "avalanche");
    expect(r.stuck).toBe(true);
  });
});

describe("largo plazo", () => {
  it("el capital objetivo es el gasto anual entre la tasa de retiro", () => {
    const p = fiProjection({ invested: 0, monthly: 100_000_00, returnPct: 0, annualSpend: 6_000_000_00, withdrawalPct: 4 });
    expect(p.target).toBe(150_000_000_00);
    expect(p.months).toBeNull();
  });

  it("con rendimiento se llega antes que sin rendimiento", () => {
    const flat = fiProjection({ invested: 0, monthly: 500_000_00, returnPct: 0, annualSpend: 6_000_000_00, withdrawalPct: 4 });
    const grow = fiProjection({ invested: 0, monthly: 500_000_00, returnPct: 5, annualSpend: 6_000_000_00, withdrawalPct: 4 });
    expect(flat.months).toBe(300);
    expect(grow.months).not.toBeNull();
    expect(grow.months!).toBeLessThan(flat.months!);
    expect(grow.series[1].value).toBeGreaterThan(grow.series[1].contributed);
  });
});

describe("uso sin conexión", () => {
  it("el service worker guarda todas las secciones de la app", () => {
    const sw = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
    for (const section of SECTIONS) {
      expect(sw).toContain(`"${section.href}"`);
    }
  });
});

describe("datos de ejemplo y respaldo", () => {
  const d = demoData("2026-11-16", "Prueba");

  it("genera seis meses coherentes", () => {
    const keys = lastMonths(6, "2026-11");
    const flows = flowSeries(d, keys);
    expect(flows.every((f) => f.expense > 0)).toBe(true);
    expect(flows.slice(0, 5).every((f) => f.income >= 850_000_00)).toBe(true);
    expect(d.txs.every((t) => t.date <= "2026-11-16")).toBe(true);
    const b = balances(d);
    expect(b.get("corriente")!).toBeGreaterThan(0);
    expect(b.get("tarjeta")!).toBeLessThan(0);
    expect(b.get("tarjeta")!).toBeGreaterThan(-720_000_00);
    expect(d.recurring.every((r) => r.nextDate > "2026-11-16")).toBe(true);
  });

  it("produce un indicador de salud y observaciones", () => {
    const h = healthScore(d, "2026-11-16");
    expect(h.score).toBeGreaterThan(0);
    expect(h.score).toBeLessThanOrEqual(100);
    expect(h.parts).toHaveLength(4);
    expect(insights(d, "2026-11-16").length).toBeGreaterThan(0);
  });

  it("el respaldo se exporta y se vuelve a leer igual", () => {
    const back = parseBackup(exportJSON(d));
    expect(back.txs).toHaveLength(d.txs.length);
    expect(back.settings.usdRate).toBe(d.settings.usdRate);
    expect(() => parseBackup("{}")).toThrow();
    expect(() => parseBackup("no es json")).toThrow();
    expect(toCSV(d).split("\r\n")).toHaveLength(d.txs.length + 1);
  });
});
