"use client";

import { ArrowDownLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Bars, Rank } from "@/components/charts";
import { RecurringSheet, type RecurringEdit } from "@/components/forms";
import { Hero } from "@/components/hero";
import { HealthCard, InsightList, TxRow, UpcomingRow } from "@/components/lists";
import { Button, Empty, PageHead, Panel } from "@/components/ui";
import { buildDashboard } from "@/lib/dashboard";
import { diffDays, fmtDate, lastMonths, monthName, monthTiny } from "@/lib/dates";
import { accountsById, categoriesById, flowSeries, nextPayday, postingDate, spendByCategory } from "@/lib/engine";
import { healthScore, insights } from "@/lib/health";
import { useToday } from "@/lib/hooks";
import { fmt } from "@/lib/money";
import { useSheets } from "@/lib/sheets";
import { useData, useStore } from "@/lib/store";

export default function PanelPage() {
  const data = useData();
  const today = useToday();
  const openTx = useSheets((s) => s.openTx);
  const base = data.settings.base;
  const [recurring, setRecurring] = useState<RecurringEdit | null>(null);

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
  const due = m.due[0];
  const hasIncomePlan = data.recurring.some((r) => r.active && r.type === "income");

  // Si hay una quincena pendiente, registrar un ingreso cuenta como esa quincena
  // (así el aviso desaparece y no se anota dos veces).
  const registerIncome = () =>
    openTx({
      preset: due
        ? {
            type: "income",
            amount: due.recurring.amount,
            accountId: due.recurring.accountId,
            categoryId: due.recurring.categoryId ?? "salario",
            note: due.recurring.name,
            date: postingDate(due.date, today),
            recurringId: due.recurring.id,
          }
        : { type: "income", categoryId: "salario", note: "Quincena" },
    });

  return (
    <>
      <PageHead
        title={title}
        sub={
          <>
            {hello}Tu patrimonio neto es <strong className="num">{fmt(m.net.net, base)}</strong>.
          </>
        }
        actions={
          <>
            <Button onClick={registerIncome}>
              <ArrowDownLeft aria-hidden="true" />
              Registrar ingreso
            </Button>
            <Button variant="primary" onClick={() => openTx()}>
              <Plus aria-hidden="true" />
              Anotar gasto
            </Button>
          </>
        }
      />

      {due ? (
        <div className="callout mb-4" role="status">
          <div className="callout-body">
            <div className="callout-title">
              {due.date === today
                ? `Hoy toca: ${due.recurring.name}`
                : `${due.recurring.name} pendiente desde ${diffDays(due.date, today) === 1 ? "ayer" : `el ${fmtDate(due.date)}`}`}
            </div>
            <div className="muted">
              ¿Ya te llegaron los {fmt(due.recurring.amount, accounts.get(due.recurring.accountId)?.currency ?? base)}?
              Regístralo y tu saldo queda al día.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => useStore.getState().postRecurring(due.recurring.id)}>
              Sí, registrar
            </Button>
            <Button onClick={registerIncome}>Llegó otro monto</Button>
          </div>
        </div>
      ) : !hasIncomePlan && m.flow.income === 0 ? (
        <div className="callout mb-4">
          <div className="callout-body">
            <div className="callout-title">¿Cobras por quincena?</div>
            <div className="muted">
              Prográmala una vez y cada 15 y fin de mes te recordamos registrarla con un toque.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() =>
                setRecurring({
                  preset: {
                    type: "income",
                    name: "Quincena",
                    frequency: "semimonthly",
                    categoryId: "salario",
                    nextDate: nextPayday(today),
                  },
                })
              }
            >
              Programar quincena
            </Button>
            <Button onClick={registerIncome}>Registrar un ingreso</Button>
          </div>
        </div>
      ) : null}

      <Hero m={m} base={base} />

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
                body="Registra tu quincena o tu primer gasto. Con unos pocos días de registro la app empieza a calcular tu ritmo."
                action={
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={registerIncome}>Registrar ingreso</Button>
                    <Button onClick={() => openTx()}>Anotar gasto</Button>
                  </div>
                }
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
            title="Próximos pagos e ingresos"
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
                body="Agrega tu quincena, el alquiler o los servicios como recurrentes y aparecerán aquí antes de su fecha."
                action={
                  <Link href="/recurrentes" className="btn">
                    Ir a recurrentes
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

      <RecurringSheet value={recurring} onClose={() => setRecurring(null)} />
    </>
  );
}
