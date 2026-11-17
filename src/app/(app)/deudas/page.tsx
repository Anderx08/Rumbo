"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Line } from "@/components/charts";
import { AccountSheet, accountIcon, type AccountEdit } from "@/components/forms";
import { Bullet, Button, Empty, Field, MoneyInput, PageHead, Panel, Segmented, Stat, Track } from "@/components/ui";
import { addMonths, humanMonths, monthKey, monthShort } from "@/lib/dates";
import { debtInputs, monthlyInterest, simulatePayoff } from "@/lib/engine";
import { useToday } from "@/lib/hooks";
import { fmt } from "@/lib/money";
import { useData, useStore } from "@/lib/store";
import { isLiability, type DebtStrategy } from "@/lib/types";

export default function DeudasPage() {
  const data = useData();
  const today = useToday();
  const base = data.settings.base;
  const key = monthKey(today);
  const { debtExtra: extra, debtStrategy: strategy } = data.settings;
  const [editing, setEditing] = useState<AccountEdit | null>(null);

  const debts = useMemo(() => debtInputs(data), [data]);
  const plan = useMemo(() => simulatePayoff(debts, extra, strategy), [debts, extra, strategy]);
  const noExtra = useMemo(() => simulatePayoff(debts, 0, strategy), [debts, strategy]);
  const other = useMemo(
    () => simulatePayoff(debts, extra, strategy === "avalanche" ? "snowball" : "avalanche"),
    [debts, extra, strategy],
  );

  const total = debts.reduce((s, x) => s + x.balance, 0);
  const mins = debts.reduce((s, x) => s + x.min, 0);
  const interest = monthlyInterest(debts);
  const accounts = new Map(data.accounts.filter(isLiability).map((a) => [a.id, a]));
  const order = [...debts].sort((a, b) => (plan.payoff[a.id] ?? 9999) - (plan.payoff[b.id] ?? 9999));
  const missingMin = debts.some((x) => x.min === 0);

  const head = (
    <PageHead
      title="Deudas"
      sub="Un plan para quedar en cero: cuánto pagar, en qué orden y en qué mes terminas."
      actions={
        <Button variant="primary" onClick={() => setEditing({ type: "credit" })}>
          <Plus aria-hidden="true" />
          Agregar deuda
        </Button>
      }
    />
  );

  if (!debts.length) {
    return (
      <>
        {head}
        <Panel>
          <Empty
            title="No tienes deudas registradas"
            body="Si tienes una tarjeta con saldo o un préstamo, agrégalo con su tasa y su pago mínimo. La app calcula cuándo terminas de pagar y cuánto se va en intereses."
            action={<Button onClick={() => setEditing({ type: "credit" })}>Agregar una deuda</Button>}
          />
        </Panel>
        <AccountSheet value={editing} onClose={() => setEditing(null)} />
      </>
    );
  }

  const savedInterest = noExtra.interest - plan.interest;
  const savedMonths = noExtra.months - plan.months;
  const step = Math.max(1, Math.ceil(plan.series.length / 60));
  const chart = plan.series
    .map((value, i) => ({ value, i }))
    .filter((p) => p.i % step === 0 || p.i === plan.series.length - 1)
    .map((p) => ({ label: monthShort(addMonths(key, p.i)), value: p.value }));

  return (
    <>
      {head}

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat tone="deuda" label="Debes en total" value={fmt(total, base)} />
        <Stat tone="gasto" label="Intereses al mes" value={fmt(interest, base)} hint="Al saldo de hoy" />
        <Stat tone="ink" label="Pagos mínimos" value={fmt(mins, base)} hint="Al mes" />
        <Stat
          tone="ingreso"
          label="Deuda cero"
          value={plan.stuck ? "Sin fecha" : monthShort(addMonths(key, plan.months))}
          hint={plan.stuck ? "El pago no cubre los intereses" : `En ${humanMonths(plan.months)}`}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="grid gap-4">
          <Panel title="Tu plan de pago">
            <div className="grid gap-4">
              <div className="field">
                <span className="label">Orden de pago</span>
                <Segmented<DebtStrategy>
                  label="Orden de pago"
                  options={[
                    { value: "avalanche", label: "Avalancha" },
                    { value: "snowball", label: "Bola de nieve" },
                  ]}
                  value={strategy}
                  onChange={(v) => useStore.getState().updateSettings({ debtStrategy: v })}
                />
                <span className="hint">
                  {strategy === "avalanche"
                    ? "Primero la tasa más alta: es la que menos intereses paga en total."
                    : "Primero el saldo más bajo: liquidas una deuda pronto y eso ayuda a sostener el plan."}
                </span>
              </div>
              <Field label="Pago extra al mes" hint="Encima de los mínimos. Al liquidar una deuda, su pago pasa a la siguiente.">
                <MoneyInput value={extra} currency={base} onChange={(v) => useStore.getState().updateSettings({ debtExtra: v })} />
              </Field>
            </div>

            <div className="mt-5 grid gap-2">
              {plan.stuck ? (
                <p className="error" role="alert">
                  Con estos pagos la deuda no baja: los intereses son mayores que lo que pagas. Sube el pago extra o revisa
                  los pagos mínimos de cada deuda.
                </p>
              ) : (
                <>
                  <p>
                    Pagando <strong className="num">{fmt(mins + extra, base)}</strong> al mes terminas en{" "}
                    <strong>{monthShort(addMonths(key, plan.months))}</strong> y pagas{" "}
                    <strong className="num">{fmt(plan.interest, base)}</strong> en intereses.
                  </p>
                  {extra > 0 && !noExtra.stuck && savedMonths > 0 ? (
                    <p className="muted">
                      El pago extra te ahorra {fmt(savedInterest, base)} en intereses y adelanta la llegada {humanMonths(savedMonths)}.
                    </p>
                  ) : null}
                  {!other.stuck && other.interest !== plan.interest ? (
                    <p className="muted">
                      Con {strategy === "avalanche" ? "bola de nieve" : "avalancha"} pagarías {fmt(other.interest, base)} en
                      intereses ({fmt(Math.abs(other.interest - plan.interest), base)}{" "}
                      {other.interest > plan.interest ? "más" : "menos"}).
                    </p>
                  ) : null}
                </>
              )}
              {missingMin ? (
                <p className="hint">
                  Alguna deuda no tiene pago mínimo definido. Edítala para que el cálculo sea realista.
                </p>
              ) : null}
            </div>
          </Panel>

          <p className="hint">
            Es una simulación con tasas fijas y pagos constantes. Tu banco puede calcular los intereses de otra forma; úsala
            para comparar escenarios, no como estado de cuenta.
          </p>
        </div>

        <div className="grid gap-4">
          <Panel title="En qué orden se liquidan">
            <div className="rows">
              {order.map((x) => {
                const account = accounts.get(x.id);
                const opening = Math.max(x.balance, Math.abs(account?.opening ?? 0));
                const month = plan.payoff[x.id];
                return (
                  <button key={x.id} type="button" className="row" onClick={() => setEditing({ id: x.id })} aria-label={`Editar ${x.name}`}>
                    <Bullet tone="deuda" icon={accountIcon(account?.type ?? "credit")} />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="row-title">{x.name}</span>
                        <span className="amount">{fmt(x.balance, base)}</span>
                      </span>
                      <span className="my-1.5 block">
                        <Track value={opening > 0 ? 1 - x.balance / opening : 0} tone="deuda" label={`${x.name}: pagado`} />
                      </span>
                      <span className="row-sub block">
                        {String(x.apr).replace(".", ",")}% anual · mínimo {fmt(x.min, base)}
                      </span>
                    </span>
                    <span className="terminal">{month ? monthShort(addMonths(key, month)) : "Sin fecha"}</span>
                  </button>
                );
              })}
            </div>
          </Panel>

          {!plan.stuck && chart.length > 1 ? (
            <Panel title="Cómo baja el saldo">
              <Line
                title="Saldo total proyectado por mes"
                data={chart}
                toneName="deuda"
                format={(v) => fmt(v, base)}
                axisFormat={(v) => fmt(v, base, { compact: true })}
                everyLabel={Math.max(1, Math.ceil(chart.length / 5))}
              />
            </Panel>
          ) : null}
        </div>
      </div>

      <AccountSheet value={editing} onClose={() => setEditing(null)} />
    </>
  );
}
