"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Bars, Rank } from "@/components/charts";
import { Hero } from "@/components/hero";
import { HealthCard, InsightList, TxRow, UpcomingRow, upcomingTitle } from "@/components/lists";
import { Button, Empty, PageHead, Panel } from "@/components/ui";
import { buildDashboard } from "@/lib/dashboard";
import { lastMonths, monthName, monthTiny } from "@/lib/dates";
import { accountsById, categoriesById, flowSeries, spendByCategory } from "@/lib/engine";
import { healthScore, insights } from "@/lib/health";
import { useToday, useWorld } from "@/lib/hooks";
import { fmt } from "@/lib/money";
import { useSheets } from "@/lib/sheets";
import { useData } from "@/lib/store";

export default function PanelPage() {
  const data = useData();
  const today = useToday();
  const world = useWorld();
  const openTx = useSheets((s) => s.openTx);
  const base = data.settings.base;

  const m = useMemo(() => buildDashboard(data, today), [data, today]);
  const accounts = useMemo(() => accountsById(data), [data]);
  const categories = useMemo(() => categoriesById(data), [data]);
  const recent = useMemo(
    () => [...data.txs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 7),
    [data.txs],
  );
  const flows = useMemo(() => flowSeries(data, lastMonths(6, m.key)), [data, m.key]);
  const top = useMemo(() => spendByCategory(data, m.key).slice(0, 5), [data, m.key]);
  const notes = useMemo(() => insights(data, today), [data, today]);
  const health = useMemo(() => healthScore(data, today), [data, today]);

  const month = monthName(m.key);
  const title = `${month[0].toUpperCase()}${month.slice(1)} ${m.key.slice(0, 4)}`;
  const hello = data.settings.name ? `Hola, ${data.settings.name}. ` : "";

  return (
    <>
      <PageHead
        title={title}
        sub={
          <>
            {hello}Tu patrimonio neto es <strong className="num">{fmt(m.net.net, base)}</strong>
            {m.netChange !== 0 ? ` (${fmt(m.netChange, base, { sign: true })} este mes).` : "."}
          </>
        }
        actions={
          <Button variant="primary" onClick={() => openTx()}>
            <Plus aria-hidden="true" />
            Anotar movimiento
          </Button>
        }
      />

      <Hero world={world} m={m} base={base} />

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="grid gap-4">
          <Panel
            title="Últimos movimientos"
            action={
              <Link href="/movimientos" className="linkish">
                Ver todos
              </Link>
            }
          >
            {recent.length ? (
              <div className="rows">
                {recent.map((tx) => (
                  <TxRow key={tx.id} tx={tx} accounts={accounts} categories={categories} usdRate={data.settings.usdRate} today={today} showDate />
                ))}
              </div>
            ) : (
              <Empty
                title="Aún no hay movimientos"
                body="Anota tu primer gasto o ingreso. Con unos pocos días de registro la app empieza a calcular tu ritmo."
                action={<Button onClick={() => openTx()}>Anotar el primero</Button>}
              />
            )}
          </Panel>

          <Panel title="Ingresos y gastos, últimos 6 meses">
            <Bars
              title="Ingresos y gastos por mes"
              data={flows.map((f) => ({ label: monthTiny(f.key), a: f.income, b: f.expense }))}
              aLabel="Ingresos"
              bLabel="Gastos"
              aTone="ingreso"
              bTone="gasto"
              format={(v) => fmt(v, base)}
              axisFormat={(v) => fmt(v, base, { compact: true })}
            />
          </Panel>

          {top.length ? (
            <Panel
              title={`En qué se fue ${month}`}
              action={
                <Link href="/reportes" className="linkish">
                  Ver reporte
                </Link>
              }
            >
              <Rank
                rows={top.map((row) => {
                  const c = categories.get(row.categoryId);
                  return {
                    id: row.categoryId || "sin",
                    label: c?.name ?? "Sin categoría",
                    value: row.amount,
                    text: fmt(row.amount, base),
                    icon: c?.icon ?? "dots",
                    hue: c?.hue,
                    tone: c ? undefined : "neutral",
                  };
                })}
              />
            </Panel>
          ) : null}
        </div>

        <div className="grid gap-4">
          <Panel
            title={upcomingTitle(world)}
            action={
              <Link href="/recurrentes" className="linkish">
                Ver todos
              </Link>
            }
          >
            {m.next.length ? (
              <div className="rows">
                {m.next.slice(0, 6).map((o) => (
                  <UpcomingRow key={o.recurring.id + o.date} occurrence={o} accounts={accounts} categories={categories} today={today} />
                ))}
              </div>
            ) : (
              <Empty
                title="Nada programado"
                body="Agrega el alquiler, los servicios o tu salario como recurrentes y aparecerán aquí antes de su fecha."
                action={
                  <Link href="/recurrentes" className="btn">
                    Agregar un pago recurrente
                  </Link>
                }
              />
            )}
          </Panel>

          {notes.length ? (
            <Panel title="Para revisar">
              <InsightList items={notes} />
            </Panel>
          ) : null}

          <Panel title="Salud financiera">
            <HealthCard health={health} />
          </Panel>
        </div>
      </div>
    </>
  );
}
