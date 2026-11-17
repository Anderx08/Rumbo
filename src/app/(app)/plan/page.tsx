"use client";

import { useMemo, useState } from "react";
import { Line } from "@/components/charts";
import { Field, MoneyInput, PageHead, Panel, Stat, Track } from "@/components/ui";
import { fiInput } from "@/lib/dashboard";
import { addMonths, humanMonths, monthKey, monthShort } from "@/lib/dates";
import { fiProjection } from "@/lib/engine";
import { useToday } from "@/lib/hooks";
import { fmt, pct } from "@/lib/money";
import { useData, useStore } from "@/lib/store";
import type { PlanSettings } from "@/lib/types";

const toNumber = (text: string) => Number(text.replace(",", "."));

export default function PlanPage() {
  const data = useData();
  const today = useToday();
  const base = data.settings.base;
  const key = monthKey(today);
  const plan = data.settings.plan;
  const [resets, setResets] = useState(0);
  const [returnText, setReturnText] = useState(String(plan.returnPct).replace(".", ","));
  const [withdrawText, setWithdrawText] = useState(String(plan.withdrawalPct).replace(".", ","));

  const input = useMemo(() => fiInput(data, today), [data, today]);
  const fi = useMemo(() => fiProjection(input), [input]);

  const patch = (p: Partial<PlanSettings>) =>
    useStore.getState().updateSettings({ plan: { ...useStore.getState().data.settings.plan, ...p } });
  const reset = (field: "invested" | "monthly" | "annualSpend") => {
    patch({ [field]: undefined });
    setResets((n) => n + 1);
  };

  const hasSpend = input.annualSpend > 0 && Number.isFinite(fi.target);
  const arrival = fi.months != null ? addMonths(key, fi.months) : null;
  const contributed = fi.months != null ? input.invested + input.monthly * fi.months : 0;
  const growth = Math.max(0, fi.target - contributed);
  const covered = hasSpend ? (input.invested * (input.withdrawalPct / 100)) / input.annualSpend : 0;

  const step = base === "CRC" ? 5_000_000 : 10_000;
  const more = fiProjection({ ...input, monthly: input.monthly + step });
  const lean = fiProjection({ ...input, annualSpend: Math.round(input.annualSpend * 0.9) });
  const year0 = Number(key.slice(0, 4));
  const horizon = Math.min(60, fi.months != null ? Math.ceil(fi.months / 12) + 4 : 40);
  const chart = fi.series.slice(0, horizon + 1).map((p) => ({
    label: String(year0 + p.year),
    value: p.value,
    note: `Aportado: ${fmt(p.contributed, base, { compact: true })}`,
  }));

  const auto = (field: "invested" | "monthly" | "annualSpend", text: string) =>
    plan[field] == null ? (
      `Automático: ${text}`
    ) : (
      <>
        Valor fijado por ti.{" "}
        <button type="button" className="linkish" onClick={() => reset(field)}>
          Volver al cálculo automático ({fmt(input.auto[field], base, { compact: true })})
        </button>
      </>
    );

  return (
    <>
      <PageHead
        title="Largo plazo"
        sub="Cuánto capital necesitas para que tus inversiones paguen tus gastos, y en qué año llegas si mantienes el ritmo."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat tone="plan" label="Capital objetivo" value={hasSpend ? fmt(fi.target, base, { compact: true }) : "Sin datos"} hint={hasSpend ? `${fmt(input.annualSpend, base, { compact: true })} al año entre ${String(input.withdrawalPct).replace(".", ",")}%` : "Registra gastos o fija tu gasto anual"} />
        <Stat
          tone="ingreso"
          label="Llegada"
          value={!hasSpend ? "Sin datos" : arrival ? monthShort(arrival) : "Más de 60 años"}
          hint={arrival && fi.months ? `En ${humanMonths(fi.months)}` : arrival ? "Ya lo alcanzaste" : "Sube el aporte o baja el gasto"}
        />
        <Stat tone="cuenta" label="Invertido hoy" value={fmt(input.invested, base, { compact: true })} hint={hasSpend ? `${pct(Math.min(1, input.invested / fi.target), 1)} del objetivo` : undefined} />
        <Stat tone="meta" label="Tus inversiones ya cubren" value={pct(Math.min(1, covered), 1)} hint="De tu gasto anual" />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <Panel title="Supuestos">
          <div className="grid gap-4">
            <Field label="Capital invertido hoy" hint={auto("invested", "el saldo de tus cuentas de inversión.")}>
              <MoneyInput key={`inv-${resets}`} value={input.invested} currency={base} onChange={(v) => patch({ invested: v })} />
            </Field>
            <Field label="Aporte mensual" hint={auto("monthly", "tu ahorro promedio de los últimos 3 meses.")}>
              <MoneyInput key={`mon-${resets}`} value={input.monthly} currency={base} onChange={(v) => patch({ monthly: v })} />
            </Field>
            <Field label="Gasto anual que quieres cubrir" hint={auto("annualSpend", "tu gasto promedio mensual por 12.")}>
              <MoneyInput key={`spe-${resets}`} value={input.annualSpend} currency={base} onChange={(v) => patch({ annualSpend: v })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Rendimiento real anual (%)" hint="Después de inflación. 4 a 6 es un rango prudente a largo plazo.">
                <input
                  className="input num"
                  inputMode="decimal"
                  value={returnText}
                  onChange={(e) => {
                    setReturnText(e.target.value);
                    const v = toNumber(e.target.value);
                    if (v >= 0 && v <= 20) patch({ returnPct: v });
                  }}
                />
              </Field>
              <Field label="Tasa de retiro anual (%)" hint="Qué parte del capital gastarías cada año. 4 es la referencia clásica.">
                <input
                  className="input num"
                  inputMode="decimal"
                  value={withdrawText}
                  onChange={(e) => {
                    setWithdrawText(e.target.value);
                    const v = toNumber(e.target.value);
                    if (v > 0 && v <= 10) patch({ withdrawalPct: v });
                  }}
                />
              </Field>
            </div>
          </div>
        </Panel>

        <div className="grid gap-4">
          <Panel title="Proyección del capital">
            {hasSpend ? (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <Track value={Math.min(1, input.invested / fi.target)} tone="plan" label="Avance hacia el capital objetivo" />
                  </div>
                  <span className="terminal">{arrival ? `Independencia ${monthShort(arrival)}` : "A más de 60 años"}</span>
                </div>
                <Line
                  title="Capital proyectado por año"
                  data={chart}
                  toneName="plan"
                  format={(v) => fmt(v, base)}
                  axisFormat={(v) => fmt(v, base, { compact: true })}
                  target={fi.target}
                  targetLabel={`Objetivo ${fmt(fi.target, base, { compact: true })}`}
                  everyLabel={Math.max(1, Math.ceil(chart.length / 6))}
                  height={250}
                />
              </>
            ) : (
              <p className="muted">
                Aún no hay gastos registrados para estimar cuánto necesitas. Anota tus movimientos durante unas semanas o
                fija a mano tu gasto anual en los supuestos.
              </p>
            )}
          </Panel>

          {hasSpend && fi.months ? (
            <Panel title="Qué mueve la fecha">
              <ul className="grid gap-3">
                <li>
                  De los {fmt(fi.target, base, { compact: true })} del objetivo, unos{" "}
                  <strong className="num">{fmt(contributed, base, { compact: true })}</strong> saldrían de tus aportes y{" "}
                  <strong className="num">{fmt(growth, base, { compact: true })}</strong> del rendimiento acumulado.
                </li>
                {more.months != null && fi.months - more.months > 0 ? (
                  <li>
                    Aportar {fmt(step, base)} más al mes adelanta la llegada{" "}
                    <strong>{humanMonths(fi.months - more.months)}</strong>.
                  </li>
                ) : null}
                {lean.months != null && fi.months - lean.months > 0 ? (
                  <li>
                    Vivir con 10% menos baja el objetivo a {fmt(lean.target, base, { compact: true })} y adelanta la llegada{" "}
                    <strong>{humanMonths(fi.months - lean.months)}</strong>.
                  </li>
                ) : null}
              </ul>
            </Panel>
          ) : null}

          <p className="hint">
            Proyección con rendimiento constante y sin impuestos ni comisiones. Los mercados suben y bajan, así que la fecha
            real cambiará. Es una herramienta para comparar escenarios, no una recomendación de inversión.
          </p>
        </div>
      </div>
    </>
  );
}
