"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { Dashboard, LineItem, RouteStop } from "@/lib/dashboard";
import { fmtDate, monthName } from "@/lib/dates";
import { useWidth } from "@/lib/hooks";
import { fmt, pct } from "@/lib/money";
import type { Currency, World } from "@/lib/types";
import { Bullet, Panel, Stat, Track } from "./ui";

const basisText = (m: Dashboard) =>
  m.remaining.basis === "budget"
    ? "Según tu presupuesto, ya descontados los pagos fijos que faltan."
    : "Ingresos menos gastos del mes, descontados los pagos fijos que faltan.";

const perDay = (m: Dashboard, base: Currency) =>
  `unos ${fmt(m.remaining.perDay, base)} por día durante ${m.remaining.daysLeft} ${m.remaining.daysLeft === 1 ? "día" : "días"}`;

/* ------------------------------------------------------------------ */
/* Rutas: la ruta del mes y las cuatro líneas                          */
/* ------------------------------------------------------------------ */

interface Placed extends RouteStop {
  side: "up" | "down" | null;
}

/** Reparte etiquetas arriba y abajo de la línea para que no se pisen. */
function place(stops: RouteStop[]): Placed[] {
  const gap = 0.17;
  const last = { up: -1, down: -1 };
  const now = stops.find((s) => s.kind === "now")?.pos ?? -1;
  return stops.map((s) => {
    if (s.kind === "now") {
      last.up = s.pos;
      return { ...s, side: "up" as const };
    }
    if (s.pos - last.down >= gap) {
      last.down = s.pos;
      return { ...s, side: "down" as const };
    }
    if (s.pos - last.up >= gap && Math.abs(s.pos - now) >= 0.24) {
      last.up = s.pos;
      return { ...s, side: "up" as const };
    }
    return { ...s, side: null };
  });
}

function MonthRoute({ m, base }: { m: Dashboard; base: Currency }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const now = m.stops.find((s) => s.kind === "now")!;
  const headline = (
    <>
      <b>Te quedan {fmt(m.remaining.amount, base)}</b>
      {perDay(m, base)}
    </>
  );

  return (
    <Panel title={`La ruta de ${monthName(m.key)}`} action={<span className="muted num">Día {m.day} de {m.days}</span>}>
      <div ref={ref}>
        {width >= 720 ? (
          <div className="route" role="img" aria-label={`Hoy es el día ${m.day} de ${m.days}. Te quedan ${fmt(m.remaining.amount, base)}.`}>
            <div className="route-line" />
            <div className="route-done" style={{ width: `${now.pos * 100}%` }} />
            {place(m.stops).map((s, i) => {
              const left = `${s.pos * 100}%`;
              const edge = s.pos < 0.1 ? "start" : s.pos > 0.9 ? "end" : undefined;
              return (
                <div key={s.kind + s.date + i}>
                  {s.kind === "now" ? (
                    <span className="route-now" style={{ left }} />
                  ) : (
                    <span
                      className="route-stop"
                      data-kind={s.kind}
                      style={{ left }}
                      title={s.amount ? `${s.label}: ${s.amount}, ${fmtDate(s.date)}` : s.label}
                    />
                  )}
                  {s.side ? (
                    <div
                      className="route-label"
                      data-side={s.side}
                      data-edge={edge}
                      data-now={s.kind === "now" ? "" : undefined}
                      style={{ left }}
                    >
                      {s.kind === "now" ? (
                        headline
                      ) : (
                        <>
                          <b>{s.kind === "start" || s.kind === "end" ? s.label : s.label}</b>
                          {s.amount ? (
                            <span className="num">
                              {s.amount} · {fmtDate(s.date)}
                            </span>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="stops">
            {m.stops.map((s, i) => (
              <div className="stop" data-kind={s.kind} key={s.kind + s.date + i}>
                <span className="stop-dot" />
                <div className="min-w-0">
                  {s.kind === "now" ? (
                    <>
                      <div className="text-[1.25rem] font-extrabold leading-tight">
                        Te quedan {fmt(m.remaining.amount, base)}
                      </div>
                      <div className="row-sub">Hoy, {perDay(m, base)}</div>
                    </>
                  ) : (
                    <>
                      <div className="row-title">{s.label}</div>
                      {s.amount ? <div className="row-sub">{fmtDate(s.date)}</div> : null}
                    </>
                  )}
                </div>
                {s.amount ? <span className="amount">{s.amount}</span> : null}
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="hint mt-3">{basisText(m)}</p>
    </Panel>
  );
}

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
              <div className="mt-1.5">
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

/* ------------------------------------------------------------------ */
/* Mosaicos                                                            */
/* ------------------------------------------------------------------ */

function Tiles({ m, base }: { m: Dashboard; base: Currency }) {
  const [gasto, meta, deuda, plan] = m.lines;
  const next = m.next.find((o) => o.recurring.type === "expense");
  const tile = (
    href: string,
    tone: string,
    value: string,
    label: string,
    wide?: boolean,
    i = 0,
  ) => (
    <Link
      href={href}
      className={wide ? "tile tile-wide" : "tile"}
      data-tone={tone}
      style={{ "--i": i } as CSSProperties}
    >
      <span className="tile-value">{value}</span>
      <span className="tile-label">{label}</span>
    </Link>
  );
  return (
    <div className="tiles">
      {tile("/presupuesto", "meta", fmt(m.remaining.amount, base), `te queda por gastar · ${perDay(m, base)}`, true, 0)}
      {tile("/presupuesto", "gasto", gasto.short, m.status.totalBudget > 0 ? "presupuesto usado" : "gastado este mes", false, 1)}
      {tile("/reportes", "ingreso", pct(Math.max(0, m.avg.rate)), "tasa de ahorro", false, 2)}
      {tile("/cuentas", "cuenta", fmt(m.net.net, base), "patrimonio neto", true, 3)}
      {tile("/deudas", "deuda", deuda.short, m.freeMonth ? "deuda cero" : "deudas", false, 4)}
      {tile("/metas", "recur", meta.short, meta.title, false, 5)}
      {tile("/plan", "plan", plan.short, "independencia financiera", true, 6)}
      {tile(
        "/recurrentes",
        "neutral",
        next ? fmtDate(next.date) : "al día",
        next ? `próximo pago · ${next.recurring.name}` : "sin pagos pendientes",
        true,
        7,
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Señalética                                                          */
/* ------------------------------------------------------------------ */

const ARROWS = [ArrowRight, ArrowUp, ArrowLeft, ArrowDown];

function Signs({ m, base }: { m: Dashboard; base: Currency }) {
  return (
    <div className="grid gap-2">
      <div className="band">
        <div className="min-w-0">
          <div className="text-[1.25rem] font-bold leading-tight">Disponible este mes</div>
          <div>{perDay(m, base)}</div>
        </div>
        <ArrowRight className="band-arrow" strokeWidth={2.5} aria-hidden="true" />
        <div className="band-value">{fmt(m.remaining.amount, base)}</div>
      </div>
      {m.lines.map((l, i) => {
        const Arrow = ARROWS[i % ARROWS.length];
        return (
          <Link key={l.key} href={l.href} className="decision">
            <span className="decision-pict">
              <Arrow aria-hidden="true" strokeWidth={2.5} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[1.125rem] font-bold leading-tight">{l.title}</span>
              <span className="row-sub block">{l.detail}</span>
            </span>
            <span className="text-right text-[1.125rem] font-bold">{l.terminal}</span>
          </Link>
        );
      })}
      <p className="hint">{basisText(m)}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Clásico                                                             */
/* ------------------------------------------------------------------ */

function Cards({ m, base }: { m: Dashboard; base: Currency }) {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat
          tone="cuenta"
          label="Patrimonio neto"
          value={fmt(m.net.net, base)}
          hint={`${fmt(m.netChange, base, { sign: true })} este mes`}
        />
        <Stat tone="meta" label="Te queda por gastar" value={fmt(m.remaining.amount, base)} hint={perDay(m, base)} />
        <Stat tone="ingreso" label="Ingresos del mes" value={fmt(m.flow.income, base)} />
        <Stat tone="gasto" label="Gastos del mes" value={fmt(m.flow.expense, base)} />
      </div>
      <Lines lines={m.lines} />
    </div>
  );
}

export function Hero({ world, m, base }: { world: World; m: Dashboard; base: Currency }) {
  if (world === "mosaicos") return <Tiles m={m} base={base} />;
  if (world === "senal") return <Signs m={m} base={base} />;
  if (world === "clasico") return <Cards m={m} base={base} />;
  return (
    <div className="grid gap-4">
      <MonthRoute m={m} base={base} />
      <Lines lines={m.lines} />
    </div>
  );
}
