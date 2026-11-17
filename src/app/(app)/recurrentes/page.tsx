"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { FREQUENCIES, RecurringSheet } from "@/components/forms";
import { UpcomingRow } from "@/components/lists";
import { Bullet, Button, Chip, Empty, PageHead, Panel, Stat } from "@/components/ui";
import { addDays, fmtDate } from "@/lib/dates";
import { accountsById, categoriesById, monthlyEquivalent, toBase, upcoming } from "@/lib/engine";
import { useToday } from "@/lib/hooks";
import { fmt } from "@/lib/money";
import { useData } from "@/lib/store";

export default function RecurrentesPage() {
  const data = useData();
  const today = useToday();
  const base = data.settings.base;
  const [editing, setEditing] = useState<{ id?: string } | null>(null);

  const accounts = useMemo(() => accountsById(data), [data]);
  const categories = useMemo(() => categoriesById(data), [data]);
  const soon = useMemo(() => upcoming(data, addDays(today, 30)), [data, today]);

  const monthly = (filter: (r: (typeof data.recurring)[number]) => boolean) =>
    data.recurring
      .filter((r) => r.active && filter(r))
      .reduce((s, r) => s + toBase(data, monthlyEquivalent(r), accounts.get(r.accountId)?.currency ?? base), 0);
  const fixedOut = monthly((r) => r.type === "expense");
  const fixedIn = monthly((r) => r.type === "income");
  const subs = monthly((r) => r.type === "expense" && Boolean(r.subscription));

  const sorted = [...data.recurring].sort(
    (a, b) => Number(b.active) - Number(a.active) || a.nextDate.localeCompare(b.nextDate),
  );

  return (
    <>
      <PageHead
        title="Recurrentes"
        sub="Lo que se repite: quincena, alquiler, servicios, suscripciones. Llega la fecha, lo registras con un toque y el saldo queda al día."
        actions={
          <Button variant="primary" onClick={() => setEditing({})} disabled={!data.accounts.length}>
            <Plus aria-hidden="true" />
            Nuevo recurrente
          </Button>
        }
      />

      {data.recurring.length === 0 ? (
        <Panel>
          <Empty
            title="Nada se repite todavía"
            body="Agrega tus pagos fijos y tu salario. La app te avisa cuáles vienen, los descuenta de lo que te queda por gastar y suma cuánto te cuestan al año tus suscripciones."
            action={
              <Button variant="primary" onClick={() => setEditing({})} disabled={!data.accounts.length}>
                Agregar el primero
              </Button>
            }
          />
        </Panel>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-3">
            <Stat tone="gasto" label="Pagos fijos al mes" value={fmt(fixedOut, base)} />
            <Stat tone="ingreso" label="Ingresos fijos al mes" value={fmt(fixedIn, base)} />
            <Stat tone="recur" label="Suscripciones al año" value={fmt(subs * 12, base)} hint={`${fmt(subs, base)} al mes`} />
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Panel title="Pendientes y próximos 30 días">
              {soon.length ? (
                <div className="rows">
                  {soon.map((o) => (
                    <UpcomingRow key={o.recurring.id + o.date} occurrence={o} accounts={accounts} categories={categories} today={today} canSkip />
                  ))}
                </div>
              ) : (
                <p className="muted">No hay nada programado para los próximos 30 días.</p>
              )}
            </Panel>

            <Panel title="Todo lo que se repite">
              <div className="rows">
                {sorted.map((r) => {
                  const cat = categories.get(r.categoryId ?? "");
                  const account = accounts.get(r.accountId);
                  const freq = FREQUENCIES.find((f) => f.value === r.frequency)?.label.toLowerCase() ?? "";
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className="row"
                      style={r.active ? undefined : { opacity: 0.6 }}
                      onClick={() => setEditing({ id: r.id })}
                      aria-label={`Editar ${r.name}`}
                    >
                      <Bullet hue={cat?.hue} tone={cat ? undefined : "neutral"} icon={cat?.icon ?? "repeat"} />
                      <span className="min-w-0">
                        <span className="row-title flex items-center gap-2">
                          <span className="truncate">{r.name}</span>
                          {r.subscription ? <Chip>Suscripción</Chip> : null}
                          {!r.active ? <Chip>En pausa</Chip> : null}
                        </span>
                        <span className="row-sub block">
                          {freq} · próximo {fmtDate(r.nextDate)}
                          {data.accounts.length > 1 && account ? ` · ${account.name}` : ""}
                        </span>
                      </span>
                      <span className={r.type === "income" ? "amount amount-pos" : "amount"}>
                        {fmt(r.type === "income" ? r.amount : -r.amount, account?.currency ?? base, { sign: r.type === "income" })}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </div>
        </>
      )}

      <RecurringSheet value={editing} onClose={() => setEditing(null)} />
    </>
  );
}
