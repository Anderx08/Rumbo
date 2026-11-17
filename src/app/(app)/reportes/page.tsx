"use client";

import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { Bars, Line, Rank } from "@/components/charts";
import { Button, Empty, PageHead, Panel, Segmented, Stat } from "@/components/ui";
import { download, toCSV } from "@/lib/backup";
import { lastMonths, monthKey, monthLabel, monthShort, monthTiny } from "@/lib/dates";
import { categoriesById, flowSeries, spendByCategory } from "@/lib/engine";
import { useToday } from "@/lib/hooks";
import { fmt, pct } from "@/lib/money";
import { useData } from "@/lib/store";

type Period = "3" | "6" | "12";

export default function ReportesPage() {
  const data = useData();
  const today = useToday();
  const base = data.settings.base;
  const [period, setPeriod] = useState<Period>("6");

  const keys = useMemo(() => lastMonths(Number(period), monthKey(today)), [period, today]);
  const flows = useMemo(() => flowSeries(data, keys), [data, keys]);
  const categories = useMemo(() => categoriesById(data), [data]);
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const k of keys) {
      for (const row of spendByCategory(data, k)) {
        map.set(row.categoryId, (map.get(row.categoryId) ?? 0) + row.amount);
      }
    }
    return [...map.entries()].map(([id, amount]) => ({ id, amount })).sort((a, b) => b.amount - a.amount);
  }, [data, keys]);

  const income = flows.reduce((s, f) => s + f.income, 0);
  const expense = flows.reduce((s, f) => s + f.expense, 0);
  const net = income - expense;
  const withData = flows.filter((f) => f.income > 0 || f.expense > 0);
  const months = Math.max(1, withData.length);

  return (
    <>
      <PageHead
        title="Reportes"
        sub="Cómo se ha movido tu dinero mes a mes y en qué categorías se concentra el gasto."
        actions={
          <Button onClick={() => download(`rumbo-movimientos-${today}.csv`, toCSV(data), "text/csv;charset=utf-8")} disabled={!data.txs.length}>
            <Download aria-hidden="true" />
            Exportar CSV
          </Button>
        }
      />

      <div className="mb-4">
        <Segmented<Period>
          label="Periodo"
          options={[
            { value: "3", label: "3 meses" },
            { value: "6", label: "6 meses" },
            { value: "12", label: "12 meses" },
          ]}
          value={period}
          onChange={setPeriod}
        />
      </div>

      {!withData.length ? (
        <Panel>
          <Empty title="Sin movimientos en este periodo" body="Cuando anotes ingresos y gastos, aquí verás su evolución y el desglose por categoría." />
        </Panel>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat tone="ingreso" label="Ingresos" value={fmt(income, base)} hint={`${fmt(Math.round(income / months), base)} al mes`} />
            <Stat tone="gasto" label="Gastos" value={fmt(expense, base)} hint={`${fmt(Math.round(expense / months), base)} al mes`} />
            <Stat tone="meta" label="Ahorro neto" value={fmt(net, base, { sign: true })} />
            <Stat tone="ink" label="Tasa de ahorro" value={income > 0 ? pct(net / income, 1) : "Sin ingresos"} hint="Referencia: 20%" />
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Panel title="Ingresos y gastos por mes">
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

            <Panel title="Tasa de ahorro por mes">
              <Line
                title="Tasa de ahorro por mes"
                data={flows.map((f) => ({ label: monthTiny(f.key), value: f.income > 0 ? f.rate : 0, note: monthShort(f.key) }))}
                toneName="meta"
                format={(v) => pct(v, 1)}
                axisFormat={(v) => pct(v)}
                target={0.2}
                targetLabel="Referencia 20%"
                height={234}
                everyLabel={flows.length > 7 ? 2 : 1}
              />
            </Panel>

            <Panel title="Gasto por categoría">
              {byCategory.length ? (
                <Rank
                  rows={byCategory.map((row) => {
                    const c = categories.get(row.id);
                    return {
                      id: row.id || "sin",
                      label: c?.name ?? "Sin categoría",
                      value: row.amount,
                      text: fmt(row.amount, base),
                      sub: `${pct(expense > 0 ? row.amount / expense : 0, 1)} del gasto · ${fmt(Math.round(row.amount / months), base)} al mes`,
                      icon: c?.icon ?? "dots",
                      hue: c?.hue,
                      tone: c ? undefined : "neutral",
                    };
                  })}
                />
              ) : (
                <p className="muted">No hay gastos en este periodo.</p>
              )}
            </Panel>

            <Panel title="Detalle por mes">
              <div className="overflow-x-auto">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th scope="col">Mes</th>
                      <th scope="col">Ingresos</th>
                      <th scope="col">Gastos</th>
                      <th scope="col">Ahorro</th>
                      <th scope="col">Tasa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...flows].reverse().map((f) => (
                      <tr key={f.key}>
                        <th scope="row">{monthLabel(f.key)}</th>
                        <td>{fmt(f.income, base)}</td>
                        <td>{fmt(f.expense, base)}</td>
                        <td>{fmt(f.net, base, { sign: true })}</td>
                        <td>{f.income > 0 ? pct(f.rate) : "n/d"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
