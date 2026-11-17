"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Parts } from "@/components/charts";
import { Bullet, Button, Chip, Empty, MoneyInput, PageHead, Panel, Stat, Track } from "@/components/ui";
import { addMonths, monthKey, monthLabel } from "@/lib/dates";
import { avgSpendByCategory, budgetStatus, monthlyAverages, rule503020, trailingKeys } from "@/lib/engine";
import { useToday } from "@/lib/hooks";
import { fmt, pct } from "@/lib/money";
import { useData, useStore } from "@/lib/store";

const PACE = {
  ok: { label: "En ritmo", state: "good" as const },
  fast: { label: "Va rápido", state: "warn" as const },
  over: { label: "Excedido", state: "bad" as const },
};

export default function PresupuestoPage() {
  const data = useData();
  const today = useToday();
  const base = data.settings.base;
  const current = monthKey(today);
  const [key, setKey] = useState(current);
  const [editing, setEditing] = useState(false);

  const status = useMemo(() => budgetStatus(data, key, today), [data, key, today]);
  const avg = useMemo(() => monthlyAverages(data, current), [data, current]);
  const usual = useMemo(() => avgSpendByCategory(data, current), [data, current]);
  const split = useMemo(() => {
    const keys = trailingKeys(data, current);
    return rule503020(data, keys.length ? keys : [current]);
  }, [data, current]);

  const expenseCats = data.categories.filter((c) => c.kind === "expense" && !c.archived);
  const hasBudget = status.rows.length > 0;
  const free = avg.income - status.totalBudget;

  const suggest = () => {
    const next: Record<string, number> = { ...data.budgets };
    for (const c of expenseCats) {
      const v = usual.get(c.id) ?? 0;
      // Redondea hacia arriba al millar más cercano de la moneda base.
      if (v > 0 && !(next[c.id] > 0)) next[c.id] = Math.ceil(v / 100_000) * 100_000;
    }
    useStore.getState().setBudgets(next);
    setEditing(true);
  };

  return (
    <>
      <PageHead
        title="Presupuesto"
        sub="Un tope mensual por categoría. La marca sobre cada línea muestra por dónde deberías ir según el día del mes."
        actions={
          <>
            <Button onClick={() => setEditing((e) => !e)} variant={editing ? "primary" : "default"}>
              {editing ? "Listo" : "Editar montos"}
            </Button>
          </>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Button size="icon" onClick={() => setKey(addMonths(key, -1))} aria-label="Mes anterior">
          <ChevronLeft aria-hidden="true" />
        </Button>
        <span className="min-w-40 text-center font-semibold" aria-live="polite">
          {monthLabel(key)}
        </span>
        <Button size="icon" onClick={() => setKey(addMonths(key, 1))} disabled={key >= current} aria-label="Mes siguiente">
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>

      {!hasBudget && !editing ? (
        <Panel>
          <Empty
            title="Aún no tienes presupuesto"
            body={
              usual.size
                ? "Puedo proponerte un tope por categoría a partir de lo que gastaste en promedio los últimos meses. Luego lo ajustas."
                : "Define cuánto quieres gastar al mes en cada categoría. Cuando tengas unas semanas de registro podré sugerirte los montos."
            }
            action={
              <div className="flex flex-wrap gap-2">
                {usual.size ? (
                  <Button variant="primary" onClick={suggest}>
                    Proponer con mi promedio
                  </Button>
                ) : null}
                <Button onClick={() => setEditing(true)}>Definirlo a mano</Button>
              </div>
            }
          />
        </Panel>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat tone="ink" label="Presupuestado" value={fmt(status.totalBudget, base)} hint="Al mes" />
            <Stat tone="gasto" label="Gastado" value={fmt(status.totalSpent, base)} hint={status.totalBudget > 0 ? `${pct(status.totalSpent / status.totalBudget)} del presupuesto` : undefined} />
            <Stat tone="meta" label="Disponible" value={fmt(Math.max(0, status.totalBudget - status.totalSpent), base)} hint={`Va ${pct(status.elapsed)} del mes`} />
            <Stat
              tone="ingreso"
              label={free >= 0 ? "Sin asignar" : "Presupuestado de más"}
              value={fmt(Math.abs(free), base)}
              hint={avg.income > 0 ? `Frente a tu ingreso promedio de ${fmt(avg.income, base)}` : "Registra ingresos para compararlo"}
            />
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Panel
              title="Por categoría"
              action={
                editing && usual.size ? (
                  <button type="button" className="linkish" onClick={suggest}>
                    Completar con mi promedio
                  </button>
                ) : null
              }
            >
              {editing ? (
                <div className="rows">
                  {expenseCats.map((c) => (
                    <div key={c.id} className="row">
                      <Bullet hue={c.hue} icon={c.icon} />
                      <div className="min-w-0">
                        <div className="row-title">{c.name}</div>
                        <div className="row-sub">
                          {usual.get(c.id) ? `Promedio reciente: ${fmt(usual.get(c.id)!, base)}` : "Sin gasto reciente"}
                        </div>
                      </div>
                      <div className="w-36">
                        <MoneyInput
                          key={`${c.id}-${data.budgets[c.id] ?? 0}`}
                          value={data.budgets[c.id] ?? 0}
                          currency={base}
                          onChange={(v) => useStore.getState().setBudget(c.id, v)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rows">
                  {status.rows.map((r) => (
                    <div key={r.category.id} className="row budget-row">
                      <Bullet hue={r.category.hue} icon={r.category.icon} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className="row-title">{r.category.name}</span>
                          <span className="num text-[0.875rem]">
                            <strong>{fmt(r.spent, base)}</strong>
                            <span className="muted"> de {fmt(r.budget, base)}</span>
                          </span>
                        </div>
                        <div className="my-1.5">
                          <Track
                            value={r.ratio}
                            hue={r.category.hue}
                            over={r.pace === "over"}
                            pace={key === current ? status.elapsed : undefined}
                            label={`${r.category.name}: ${pct(r.ratio)} usado`}
                          />
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="row-sub">
                            {r.left >= 0 ? `Quedan ${fmt(r.left, base)}` : `${fmt(-r.left, base)} por encima`}
                          </span>
                          <Chip state={PACE[r.pace].state}>{PACE[r.pace].label}</Chip>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <div className="grid gap-4">
              <Panel title="Regla 50/30/20">
                <Parts
                  title="Reparto de tus ingresos"
                  parts={[
                    { label: "Necesidades", value: split.needs, tone: "meta", detail: `${fmt(split.needs, base, { compact: true })} · referencia 50%` },
                    { label: "Gustos", value: split.wants, tone: "deuda", detail: `${fmt(split.wants, base, { compact: true })} · referencia 30%` },
                    { label: "Ahorro", value: Math.max(0, split.savings), tone: "ingreso", detail: `${fmt(split.savings, base, { compact: true })} · referencia 20%` },
                  ]}
                />
                <p className="hint mt-3">
                  Calculado sobre tus ingresos de los últimos meses. Es una referencia para comparar, no una regla fija.
                </p>
              </Panel>

              {status.unbudgeted.length ? (
                <Panel title="Gastos sin presupuesto">
                  <div className="rows">
                    {status.unbudgeted.map((u) => (
                      <div key={u.category?.id ?? "sin"} className="row">
                        <Bullet hue={u.category?.hue} tone={u.category ? undefined : "neutral"} icon={u.category?.icon ?? "dots"} size="sm" />
                        <span className="row-title">{u.category?.name ?? "Sin categoría"}</span>
                        <span className="amount">{fmt(u.spent, base)}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              ) : null}
            </div>
          </div>
        </>
      )}
    </>
  );
}
