"use client";

import { CircleCheck, Info, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { fmtRelative } from "@/lib/dates";
import { transferIn, type Occurrence } from "@/lib/engine";
import type { Health, Insight } from "@/lib/health";
import { fmt } from "@/lib/money";
import { useSheets } from "@/lib/sheets";
import { useStore } from "@/lib/store";
import type { Account, Category, Tx, World } from "@/lib/types";
import { Bullet, Button, Track } from "./ui";

export const upcomingTitle = (world: World) =>
  world === "rutas" ? "Próximas paradas" : world === "senal" ? "Próximas salidas" : "Próximos pagos";

const TYPE_LABEL = { expense: "Gasto", income: "Ingreso", transfer: "Transferencia" } as const;

export function TxRow({
  tx,
  accounts,
  categories,
  usdRate,
  showDate,
  today,
}: {
  tx: Tx;
  accounts: Map<string, Account>;
  categories: Map<string, Category>;
  usdRate: number;
  showDate?: boolean;
  today: string;
}) {
  const openTx = useSheets((s) => s.openTx);
  const from = accounts.get(tx.accountId);
  const to = tx.toAccountId ? accounts.get(tx.toAccountId) : undefined;
  const cat = categories.get(tx.categoryId ?? "");
  const currency = from?.currency ?? "CRC";
  const title = tx.note || cat?.name || TYPE_LABEL[tx.type];
  const where =
    tx.type === "transfer"
      ? `${from?.name ?? "Cuenta"} a ${to?.name ?? "cuenta"}`
      : [cat && tx.note ? cat.name : null, from?.name].filter(Boolean).join(" · ");
  const received =
    tx.type === "transfer" && from && to && from.currency !== to.currency
      ? ` (llegan ${fmt(transferIn(tx, accounts, usdRate), to.currency)})`
      : "";
  const amount =
    tx.type === "income"
      ? fmt(tx.amount, currency, { sign: true })
      : tx.type === "expense"
        ? fmt(-tx.amount, currency)
        : fmt(tx.amount, currency);

  return (
    <button type="button" className="row" onClick={() => openTx({ id: tx.id })} aria-label={`Editar ${title}, ${amount}`}>
      {tx.type === "transfer" ? (
        <Bullet tone="neutral" icon="transfer" />
      ) : (
        <Bullet hue={cat?.hue} tone={cat ? undefined : "neutral"} icon={cat?.icon ?? "dots"} />
      )}
      <span className="min-w-0">
        <span className="row-title block">{title}</span>
        <span className="row-sub block">
          {showDate ? `${fmtRelative(tx.date, today)} · ` : ""}
          {where}
          {received}
        </span>
      </span>
      <span className={tx.type === "income" ? "amount amount-pos" : "amount"}>{amount}</span>
    </button>
  );
}

export function UpcomingRow({
  occurrence,
  accounts,
  categories,
  today,
  canSkip,
}: {
  occurrence: Occurrence;
  accounts: Map<string, Account>;
  categories: Map<string, Category>;
  today: string;
  canSkip?: boolean;
}) {
  const { recurring: r, date } = occurrence;
  const account = accounts.get(r.accountId);
  const cat = categories.get(r.categoryId ?? "");
  const isNext = date === r.nextDate;
  const overdue = date < today;
  const amount = fmt(r.type === "income" ? r.amount : -r.amount, account?.currency ?? "CRC", { sign: r.type === "income" });
  return (
    <div className="row upcoming-row">
      <Bullet hue={cat?.hue} tone={cat ? undefined : "neutral"} icon={cat?.icon ?? "repeat"} />
      <div className="min-w-0">
        <div className="row-title">{r.name}</div>
        <div className="row-sub">
          {overdue ? "Pendiente desde " : ""}
          {fmtRelative(date, today).toLowerCase()} · {account?.name}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={r.type === "income" ? "amount amount-pos" : "amount"}>{amount}</span>
        {isNext ? (
          <>
            <Button size="sm" onClick={() => useStore.getState().postRecurring(r.id)} aria-label={`Registrar ${r.name}`}>
              Registrar
            </Button>
            {canSkip ? (
              <Button size="sm" variant="ghost" onClick={() => useStore.getState().skipRecurring(r.id)} aria-label={`Omitir ${r.name}`}>
                Omitir
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

const INSIGHT_ICON = { good: CircleCheck, warn: TriangleAlert, info: Info } as const;
const INSIGHT_COLOR = { good: "var(--pos)", warn: "var(--warn)", info: "var(--ink-2)" } as const;

export function InsightList({ items }: { items: Insight[] }) {
  return (
    <div className="rows">
      {items.map((it) => {
        const I = INSIGHT_ICON[it.tone];
        return (
          <Link key={it.title} href={it.href} className="row insight-row">
            <I aria-hidden="true" style={{ color: INSIGHT_COLOR[it.tone], width: 20, height: 20 }} />
            <span className="min-w-0">
              <span className="block font-semibold">{it.title}</span>
              <span className="muted block text-[0.875rem]">{it.body}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function HealthCard({ health }: { health: Health }) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-[2.5rem] font-[number:var(--w-head)] leading-none">{health.score}</span>
        <span className="muted">de 100</span>
      </div>
      <ul className="mt-4 grid gap-3">
        {health.parts.map((p) => (
          <li key={p.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{p.label}</span>
              <span className="num muted">
                {p.score} de {p.max}
              </span>
            </div>
            <div className="my-1">
              <Track value={p.score / p.max} label={`${p.label}: ${p.score} de ${p.max}`} tone="ink" />
            </div>
            <p className="hint">{p.detail}</p>
          </li>
        ))}
      </ul>
      <p className="hint mt-3">Indicador orientativo calculado con tus propios datos; no es asesoría financiera.</p>
    </div>
  );
}
