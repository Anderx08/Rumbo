"use client";

import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { TxRow } from "@/components/lists";
import { Button, Empty, PageHead, Panel, Segmented } from "@/components/ui";
import { fmtRelative, monthKey, monthLabel } from "@/lib/dates";
import { accountsById, categoriesById, toBase } from "@/lib/engine";
import { useToday } from "@/lib/hooks";
import { fmt } from "@/lib/money";
import { useSheets } from "@/lib/sheets";
import { useData } from "@/lib/store";
import type { Tx, TxType } from "@/lib/types";

type Filter = "all" | TxType;
const PAGE = 80;

export default function MovimientosPage() {
  const data = useData();
  const today = useToday();
  const openTx = useSheets((s) => s.openTx);
  const base = data.settings.base;
  const accounts = useMemo(() => accountsById(data), [data]);
  const categories = useMemo(() => categoriesById(data), [data]);

  const [query, setQuery] = useState("");
  const [type, setType] = useState<Filter>("all");
  const [month, setMonth] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const months = useMemo(
    () => [...new Set(data.txs.map((t) => monthKey(t.date)))].sort().reverse(),
    [data.txs],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.txs
      .filter((t) => {
        if (type !== "all" && t.type !== type) return false;
        if (month && monthKey(t.date) !== month) return false;
        if (accountId && t.accountId !== accountId && t.toAccountId !== accountId) return false;
        if (categoryId && t.categoryId !== categoryId) return false;
        if (!q) return true;
        const hay = `${t.note} ${categories.get(t.categoryId ?? "")?.name ?? ""} ${accounts.get(t.accountId)?.name ?? ""}`;
        return hay.toLowerCase().includes(q);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }, [data.txs, query, type, month, accountId, categoryId, accounts, categories]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      const v = toBase(data, t.amount, accounts.get(t.accountId)?.currency ?? base);
      if (t.type === "income") income += v;
      else if (t.type === "expense") expense += v;
    }
    return { income, expense };
  }, [filtered, data, accounts, base]);

  const groups = useMemo(() => {
    const out: { date: string; txs: Tx[] }[] = [];
    for (const t of filtered.slice(0, limit)) {
      const last = out[out.length - 1];
      if (last && last.date === t.date) last.txs.push(t);
      else out.push({ date: t.date, txs: [t] });
    }
    return out;
  }, [filtered, limit]);

  const filtering = Boolean(query || month || accountId || categoryId || type !== "all");
  const clear = () => {
    setQuery("");
    setType("all");
    setMonth("");
    setAccountId("");
    setCategoryId("");
  };

  return (
    <>
      <PageHead
        title="Movimientos"
        sub="Todo lo que entra, sale o se mueve entre tus cuentas. Toca un movimiento para corregirlo."
        actions={
          <Button variant="primary" onClick={() => openTx()}>
            <Plus aria-hidden="true" />
            Anotar movimiento
          </Button>
        }
      />

      <div className="mb-4 grid gap-3">
        <Segmented
          label="Tipo"
          options={[
            { value: "all", label: "Todos" },
            { value: "expense", label: "Gastos" },
            { value: "income", label: "Ingresos" },
            { value: "transfer", label: "Transferencias" },
          ]}
          value={type}
          onChange={(v) => {
            setType(v);
            setLimit(PAGE);
          }}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="relative block">
            <span className="sr-only">Buscar</span>
            <Search aria-hidden="true" className="faint pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2" />
            <input
              className="input"
              style={{ paddingLeft: 38 }}
              type="search"
              placeholder="Buscar por nota o categoría"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE);
              }}
            />
          </label>
          <select className="select" aria-label="Mes" value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">Todos los meses</option>
            {months.map((k) => (
              <option key={k} value={k}>
                {monthLabel(k)}
              </option>
            ))}
          </select>
          <select className="select" aria-label="Cuenta" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Todas las cuentas</option>
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select className="select" aria-label="Categoría" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Todas las categorías</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Panel>
        {data.txs.length === 0 ? (
          <Empty
            title="Aún no hay movimientos"
            body="Empieza por lo de hoy: un gasto, un ingreso o una transferencia entre cuentas. También puedes usar la tecla N desde cualquier pantalla."
            action={<Button onClick={() => openTx()}>Anotar el primero</Button>}
          />
        ) : filtered.length === 0 ? (
          <Empty
            title="Nada coincide con esos filtros"
            body="Prueba con otro mes, otra cuenta o una búsqueda más corta."
            action={<Button onClick={clear}>Quitar filtros</Button>}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pb-2" role="status">
              <span className="font-semibold">
                {filtered.length} {filtered.length === 1 ? "movimiento" : "movimientos"}
                {filtering ? " con estos filtros" : ""}
              </span>
              <span className="muted num">
                Ingresos {fmt(totals.income, base)} · Gastos {fmt(totals.expense, base)}
              </span>
            </div>
            {groups.map((g) => (
              <section key={g.date}>
                <h2 className="daygroup">{fmtRelative(g.date, today)}</h2>
                <div className="rows">
                  {g.txs.map((tx) => (
                    <TxRow key={tx.id} tx={tx} accounts={accounts} categories={categories} usdRate={data.settings.usdRate} today={today} />
                  ))}
                </div>
              </section>
            ))}
            {filtered.length > limit ? (
              <div className="pt-4">
                <Button onClick={() => setLimit((n) => n + PAGE)}>
                  Ver {Math.min(PAGE, filtered.length - limit)} más
                </Button>
              </div>
            ) : null}
          </>
        )}
      </Panel>
    </>
  );
}
