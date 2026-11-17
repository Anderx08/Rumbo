"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { ContributionSheet, GoalSheet, goalIcon } from "@/components/forms";
import { Bullet, Button, Chip, ConfirmButton, Empty, PageHead, Panel, Stat, Track } from "@/components/ui";
import { fmtDate, monthKey, monthShort } from "@/lib/dates";
import { goalStats, monthlyAverages, toBase, type GoalStatus } from "@/lib/engine";
import { useToday } from "@/lib/hooks";
import { fmt, pct } from "@/lib/money";
import { useData, useStore } from "@/lib/store";
import type { Goal } from "@/lib/types";

const STATUS: Record<GoalStatus, { label: string; state?: "good" | "warn" | "bad" }> = {
  done: { label: "Cumplida", state: "good" },
  onTrack: { label: "En ruta", state: "good" },
  behind: { label: "Atrasada", state: "warn" },
  idle: { label: "Sin aportes recientes" },
};

export default function MetasPage() {
  const data = useData();
  const today = useToday();
  const base = data.settings.base;
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  const [adding, setAdding] = useState<Goal | null>(null);

  const goals = useMemo(
    () => data.goals.map((goal) => ({ goal, stats: goalStats(goal, today) })),
    [data.goals, today],
  );
  const avg = useMemo(() => monthlyAverages(data, monthKey(today)), [data, today]);
  const totalSaved = goals.reduce((s, g) => s + toBase(data, g.stats.saved, g.goal.currency), 0);
  const totalPace = goals.reduce((s, g) => s + toBase(data, g.stats.pace, g.goal.currency), 0);
  const active = goals.filter((g) => g.stats.status !== "done").length;

  return (
    <>
      <PageHead
        title="Metas"
        sub="Cada meta es una línea con su estación de llegada. La fecha se calcula con lo que has aportado en los últimos tres meses."
        actions={
          <Button variant="primary" onClick={() => setEditing({})}>
            <Plus aria-hidden="true" />
            Nueva meta
          </Button>
        }
      />

      {goals.length === 0 ? (
        <Panel>
          <Empty
            title="Aún no tienes metas"
            body="Empieza por un fondo de emergencia: lo usual es reunir entre tres y seis meses de tus gastos. Luego agrega lo que quieras alcanzar, con monto y, si quieres, fecha."
            action={
              <Button variant="primary" onClick={() => setEditing({})}>
                Crear mi primera meta
              </Button>
            }
          />
        </Panel>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-3">
            <Stat tone="meta" label="Ahorrado en metas" value={fmt(totalSaved, base)} />
            <Stat tone="ingreso" label="Aportas al mes" value={fmt(totalPace, base)} hint="Promedio de los últimos 3 meses" />
            <Stat tone="ink" label="Metas en curso" value={String(active)} hint={`${goals.length - active} cumplidas`} />
          </div>

          <div className="grid gap-4">
            {goals.map(({ goal, stats }) => {
              const status = STATUS[stats.status];
              const cover =
                goal.kind === "emergency" && avg.expense > 0
                  ? toBase(data, stats.saved, goal.currency) / avg.expense
                  : null;
              const history = [...goal.contributions].sort((a, b) => b.date.localeCompare(a.date));
              return (
                <Panel key={goal.id}>
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                    <Bullet tone="meta" icon={goalIcon(goal.kind)} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h2 className="h-section">{goal.name}</h2>
                        <Chip state={status.state}>{status.label}</Chip>
                      </div>
                      <p className="num mt-1">
                        <strong className="text-[1.25rem]">{fmt(stats.saved, goal.currency)}</strong>
                        <span className="muted"> de {fmt(goal.target, goal.currency)}</span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="primary" size="sm" onClick={() => setAdding(goal)}>
                        Aportar
                      </Button>
                      <Button size="sm" onClick={() => setEditing({ id: goal.id })}>
                        Editar
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <Track value={stats.ratio} tone="meta" label={`${goal.name}: ${pct(stats.ratio)}`} />
                    </div>
                    <span className="terminal">
                      {stats.status === "done" ? "Llegaste" : stats.eta ? `Llegada ${monthShort(stats.eta)}` : "Sin fecha de llegada"}
                    </span>
                  </div>

                  <ul className="muted mt-3 grid gap-1 text-[0.875rem]">
                    {stats.status !== "done" ? (
                      <li>
                        {stats.pace > 0
                          ? `A tu ritmo de ${fmt(stats.pace, goal.currency)} al mes faltan ${fmt(stats.left, goal.currency)}.`
                          : `Faltan ${fmt(stats.left, goal.currency)}. Haz un aporte para calcular cuándo llegas.`}
                      </li>
                    ) : null}
                    {goal.deadline && stats.required != null ? (
                      <li>
                        Para llegar el {fmtDate(goal.deadline, true)} hacen falta{" "}
                        <strong className="text-ink">{fmt(stats.required, goal.currency)}</strong> al mes.
                      </li>
                    ) : null}
                    {cover != null ? (
                      <li>Hoy cubre {cover.toFixed(1).replace(".", ",")} meses de tus gastos promedio.</li>
                    ) : null}
                  </ul>

                  {history.length ? (
                    <details className="mt-3">
                      <summary className="linkish inline-block cursor-pointer">
                        Ver {history.length} {history.length === 1 ? "aporte" : "aportes"}
                      </summary>
                      <div className="rows mt-2">
                        {history.map((c) => (
                          <div key={c.id} className="row">
                            <span className="num muted w-24">{fmtDate(c.date, true)}</span>
                            <span className="row-sub">{c.note ?? (c.amount < 0 ? "Retiro" : "Aporte")}</span>
                            <span className="flex items-center gap-2">
                              <span className="amount">{fmt(c.amount, goal.currency, { sign: true })}</span>
                              <ConfirmButton
                                size="sm"
                                label="Quitar"
                                confirmLabel="Sí, quitar"
                                onConfirm={() => useStore.getState().deleteContribution(goal.id, c.id)}
                              />
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </Panel>
              );
            })}
          </div>
        </>
      )}

      <GoalSheet value={editing} onClose={() => setEditing(null)} />
      <ContributionSheet value={adding} onClose={() => setAdding(null)} />
    </>
  );
}
