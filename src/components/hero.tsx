"use client";

import Link from "next/link";
import type { Dashboard, LineItem } from "@/lib/dashboard";
import { fmt, pct } from "@/lib/money";
import type { Currency } from "@/lib/types";
import { Bullet, Panel, Stat, Track } from "./ui";

const perDay = (m: Dashboard, base: Currency) =>
  `unos ${fmt(m.remaining.perDay, base)} por día durante ${m.remaining.daysLeft} ${m.remaining.daysLeft === 1 ? "día" : "días"}`;

export const basisText = (m: Dashboard) =>
  m.remaining.basis === "budget"
    ? "Lo que queda de tu presupuesto, ya descontados los pagos fijos que faltan este mes."
    : "Lo que hay en tus cuentas del día a día, ya descontados los pagos fijos que faltan este mes.";

function Lines({ lines }: { lines: LineItem[] }) {
  return (
    <Panel title="Hacia dónde vas">
      <div className="rows">
        {lines.map((l) => (
          <Link key={l.key} href={l.href} className="row line-row">
            <Bullet tone={l.key} icon={l.icon} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="row-title">{l.title}</span>
                <span className="row-sub">{l.detail}</span>
              </div>
              <div className="mt-2">
                <Track value={l.progress} tone={l.key} label={`${l.title}: ${pct(l.progress)}`} />
              </div>
            </div>
            <span className="terminal">{l.terminal}</span>
          </Link>
        ))}
      </div>
    </Panel>
  );
}

/** Cabecera del panel: cuatro cifras clave y las líneas hacia cada objetivo. */
export function Hero({ m, base }: { m: Dashboard; base: Currency }) {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat tone="meta" label="Te queda por gastar" value={fmt(m.remaining.amount, base)} hint={perDay(m, base)} />
        <Stat
          tone="cuenta"
          label="Patrimonio neto"
          value={fmt(m.net.net, base)}
          hint={m.netChange !== 0 ? `${fmt(m.netChange, base, { sign: true })} este mes` : "Lo que tienes menos lo que debes"}
        />
        <Stat tone="ingreso" label="Ingresos del mes" value={fmt(m.flow.income, base)} />
        <Stat tone="gasto" label="Gastos del mes" value={fmt(m.flow.expense, base)} />
      </div>
      <p className="hint -mt-1">{basisText(m)}</p>
      <Lines lines={m.lines} />
    </div>
  );
}
