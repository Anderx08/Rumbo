"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Line } from "@/components/charts";
import { AccountSheet, accountIcon, accountTypeLabel, type AccountEdit } from "@/components/forms";
import { Bullet, Button, Empty, PageHead, Panel, Stat } from "@/components/ui";
import { lastMonths, monthKey, monthShort, monthTiny } from "@/lib/dates";
import { balances, netWorth, netWorthSeries, toBase } from "@/lib/engine";
import { useToday } from "@/lib/hooks";
import { fmt } from "@/lib/money";
import { useData } from "@/lib/store";
import { isLiability, type Account } from "@/lib/types";

export default function CuentasPage() {
  const data = useData();
  const today = useToday();
  const base = data.settings.base;
  const [editing, setEditing] = useState<AccountEdit | null>(null);

  const bal = useMemo(() => balances(data), [data]);
  const net = useMemo(() => netWorth(data), [data]);
  const series = useMemo(
    () => netWorthSeries(data, lastMonths(12, monthKey(today)), today),
    [data, today],
  );
  const firstTx = data.txs.reduce((min, t) => (t.date < min ? t.date : min), today);
  const visible = series.filter((s) => s.key >= monthKey(firstTx));
  const assets = data.accounts.filter((a) => !isLiability(a));
  const debts = data.accounts.filter(isLiability);
  const hasUsd = data.accounts.some((a) => a.currency !== base);

  const row = (a: Account) => {
    const b = bal.get(a.id) ?? 0;
    return (
      <button key={a.id} type="button" className="row" onClick={() => setEditing({ id: a.id })} aria-label={`Editar ${a.name}`}>
        <Bullet tone={isLiability(a) ? "deuda" : "cuenta"} icon={accountIcon(a.type)} />
        <span className="min-w-0">
          <span className="row-title block">{a.name}</span>
          <span className="row-sub block">
            {accountTypeLabel(a)}
            {a.apr != null ? ` · ${String(a.apr).replace(".", ",")}% anual` : ""}
          </span>
        </span>
        <span className="text-right">
          <span className="amount block">{fmt(b, a.currency)}</span>
          {a.currency !== base ? <span className="row-sub block">{fmt(toBase(data, b, a.currency), base)}</span> : null}
        </span>
      </button>
    );
  };

  return (
    <>
      <PageHead
        title="Cuentas"
        sub="Dónde está tu dinero y cuánto debes. La resta de ambos es tu patrimonio neto."
        actions={
          <Button variant="primary" onClick={() => setEditing({})}>
            <Plus aria-hidden="true" />
            Nueva cuenta
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-3">
        <Stat tone="cuenta" label="Patrimonio neto" value={fmt(net.net, base)} />
        <Stat tone="ingreso" label="Lo que tienes" value={fmt(net.assets, base)} />
        <Stat tone="deuda" label="Lo que debes" value={fmt(net.liabilities, base)} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="grid gap-4">
          <Panel title="Lo que tienes">
            {assets.length ? (
              <div className="rows">{assets.map(row)}</div>
            ) : (
              <Empty title="Sin cuentas" body="Agrega tu efectivo, tu cuenta del banco o tus ahorros para llevar el saldo de cada una." />
            )}
          </Panel>
          <Panel
            title="Lo que debes"
            action={
              <button type="button" className="linkish" onClick={() => setEditing({ type: "credit" })}>
                Agregar deuda
              </button>
            }
          >
            {debts.length ? (
              <div className="rows">{debts.map(row)}</div>
            ) : (
              <p className="muted">No tienes tarjetas ni préstamos registrados.</p>
            )}
          </Panel>
        </div>

        <div className="grid gap-4">
          <Panel title="Patrimonio neto en el tiempo">
            {visible.length > 1 ? (
              <Line
                title="Patrimonio neto por mes"
                data={visible.map((s) => ({ label: monthTiny(s.key), value: s.net, note: monthShort(s.key) }))}
                toneName="cuenta"
                format={(v) => fmt(v, base)}
                axisFormat={(v) => fmt(v, base, { compact: true })}
                everyLabel={visible.length > 7 ? 2 : 1}
              />
            ) : (
              <p className="muted">Cuando tengas más de un mes de movimientos verás aquí cómo cambia tu patrimonio.</p>
            )}
          </Panel>
          {hasUsd ? (
            <p className="hint">
              Las cuentas en otra moneda se convierten a ₡{data.settings.usdRate} por dólar.{" "}
              <Link href="/ajustes" className="linkish">
                Cambiar el tipo de cambio
              </Link>
            </p>
          ) : null}
        </div>
      </div>

      <AccountSheet value={editing} onClose={() => setEditing(null)} />
    </>
  );
}
