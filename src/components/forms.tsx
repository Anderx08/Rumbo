"use client";

import { useEffect, useMemo, useState } from "react";
import { today } from "@/lib/dates";
import { balances } from "@/lib/engine";
import { convert, fmt } from "@/lib/money";
import { useSheets } from "@/lib/sheets";
import { useData, useStore } from "@/lib/store";
import {
  defaultAccountId,
  type Account,
  type AccountType,
  type Category,
  type Currency,
  type Frequency,
  type Goal,
  type GoalKind,
  type Recurring,
  type Tx,
  type TxType,
} from "@/lib/types";
import {
  Bullet,
  Button,
  CATEGORY_ICONS,
  ConfirmButton,
  Field,
  FormSheet,
  Icon,
  MoneyInput,
  Segmented,
  Sheet,
  SheetForm,
  useLinger,
} from "./ui";

export const ACCOUNT_TYPES: { value: AccountType; label: string; icon: string }[] = [
  { value: "checking", label: "Cuenta de banco", icon: "bank" },
  { value: "cash", label: "Efectivo", icon: "wallet" },
  { value: "savings", label: "Ahorros", icon: "piggy" },
  { value: "investment", label: "Inversión", icon: "trending" },
  { value: "credit", label: "Tarjeta de crédito", icon: "card" },
  { value: "loan", label: "Préstamo", icon: "loan" },
];

export const accountIcon = (type: AccountType) =>
  ACCOUNT_TYPES.find((t) => t.value === type)?.icon ?? "wallet";
export const accountTypeLabel = (a: Pick<Account, "type" | "primary">) =>
  a.primary ? "Cuenta principal" : (ACCOUNT_TYPES.find((t) => t.value === a.type)?.label ?? "");

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "semimonthly", label: "Cada quincena (15 y fin de mes)" },
  { value: "monthly", label: "Cada mes" },
  { value: "weekly", label: "Cada semana" },
  { value: "yearly", label: "Cada año" },
];

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "CRC", label: "Colones ₡" },
  { value: "USD", label: "Dólares $" },
];

/** Devuelve el foco al primer campo de la hoja abierta, sin desplazar. */
const refocus = () =>
  document.querySelector<HTMLElement>("dialog[open] [data-autofocus]")?.focus({ preventScroll: true });

function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="catpick" role="radiogroup" aria-label="Categoría">
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={c.id === value}
          onClick={() => onChange(c.id === value ? "" : c.id)}
        >
          <Bullet hue={c.hue} icon={c.icon} size="sm" />
          <span>{c.name}</span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Movimiento                                                          */
/* ------------------------------------------------------------------ */

const TX_TYPES: { value: TxType; label: string }[] = [
  { value: "expense", label: "Gasto" },
  { value: "income", label: "Ingreso" },
  { value: "transfer", label: "Transferencia" },
];

function TxForm({ id, preset, onDone }: { id?: string; preset?: Partial<Tx>; onDone: () => void }) {
  const data = useData();
  const existing = id ? data.txs.find((t) => t.id === id) : undefined;
  const init: Partial<Tx> = existing ?? preset ?? {};
  const bal = useMemo(() => balances(data), [data]);
  const accounts = data.accounts.filter((a) => !a.archived || a.id === init.accountId);
  // Con una sola cuenta no se pregunta nada: todo va ahí.
  const many = accounts.length > 1;

  const [type, setType] = useState<TxType>(init.type ?? "expense");
  const [amount, setAmount] = useState(init.amount ?? 0);
  const [accountId, setAccountId] = useState(init.accountId ?? defaultAccountId(data.accounts));
  const [toAccountId, setToAccountId] = useState(init.toAccountId ?? "");
  const [toAmount, setToAmount] = useState<number | null>(init.toAmount ?? null);
  const [categoryId, setCategoryId] = useState(init.categoryId ?? "");
  const [date, setDate] = useState(init.date ?? today());
  const [note, setNote] = useState(init.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  // Si viene de un ingreso programado (la quincena), al guardar se da por recibido.
  const [linked, setLinked] = useState(existing ? undefined : init.recurringId);

  useEffect(() => {
    if (round > 0) refocus();
  }, [round]);

  const from = data.accounts.find((a) => a.id === accountId);
  const to = data.accounts.find((a) => a.id === toAccountId);
  const currency = from?.currency ?? data.settings.base;
  const crossCurrency = type === "transfer" && from && to && from.currency !== to.currency;
  const suggestedTo =
    crossCurrency && from && to ? convert(amount, from.currency, to.currency, data.settings.usdRate) : 0;
  const categories = data.categories.filter(
    (c) => !c.archived && c.kind === (type === "income" ? "income" : "expense"),
  );
  const typeOptions = many || type === "transfer" ? TX_TYPES : TX_TYPES.filter((t) => t.value !== "transfer");

  const changeType = (next: TxType) => {
    setType(next);
    setCategoryId(next === "income" && !existing ? "salario" : "");
    setError(null);
  };

  const save = (another: boolean) => {
    if (!from) return setError("Crea una cuenta en la sección Cuentas para poder anotar.");
    if (!(amount > 0)) return setError("Escribe un monto mayor que cero.");
    if (type === "transfer") {
      if (!to) return setError("Elige la cuenta que recibe el dinero.");
      if (to.id === from.id) return setError("La cuenta de origen y la de destino deben ser distintas.");
    }
    if (!date) return setError("Elige la fecha.");
    const tx = {
      date,
      type,
      amount,
      accountId: from.id,
      toAccountId: type === "transfer" ? to?.id : undefined,
      toAmount: crossCurrency ? (toAmount ?? suggestedTo) : undefined,
      categoryId: type === "transfer" ? undefined : categoryId || undefined,
      note: note.trim(),
      recurringId: existing?.recurringId ?? linked,
    };
    const store = useStore.getState();
    if (existing) store.updateTx(existing.id, tx);
    else store.addTx(tx);
    if (!existing && linked) {
      store.skipRecurring(linked);
      setLinked(undefined);
    }
    if (another && !existing) {
      setSaved(`Guardado: ${TX_TYPES.find((t) => t.value === type)?.label.toLowerCase()} de ${fmt(amount, currency)}.`);
      setAmount(0);
      setNote("");
      setToAmount(null);
      setError(null);
      setRound((r) => r + 1);
      return;
    }
    onDone();
  };

  if (!data.accounts.length) {
    return (
      <div className="sheet-content">
        <p className="muted">Primero crea una cuenta en la sección Cuentas para poder anotar movimientos.</p>
      </div>
    );
  }

  const accountLabel = (a: Account) => `${a.name} · ${fmt(bal.get(a.id) ?? 0, a.currency)}`;

  return (
    <SheetForm
      onSubmit={() => save(false)}
      footer={
        <>
          <Button variant="primary" type="submit" className="flex-1">
            {existing ? "Guardar cambios" : type === "income" ? "Guardar ingreso" : type === "expense" ? "Guardar gasto" : "Guardar"}
          </Button>
          {existing ? (
            <ConfirmButton
              label="Borrar"
              onConfirm={() => {
                useStore.getState().deleteTx(existing.id);
                onDone();
              }}
            />
          ) : (
            <Button onClick={() => save(true)}>Guardar y otro</Button>
          )}
        </>
      }
    >
      <Segmented label="Tipo de movimiento" options={typeOptions} value={type} onChange={changeType} wide />

      <Field label={type === "income" ? "¿Cuánto entró?" : type === "expense" ? "¿Cuánto gastaste?" : "Monto"} error={error}>
        <MoneyInput
          key={round}
          value={amount}
          onChange={(v) => {
            setAmount(v);
            setError(null);
          }}
          currency={currency}
          large
          autoFocus
          invalid={Boolean(error)}
        />
      </Field>

      {type !== "transfer" ? (
        <div className="field">
          <span className="label">Categoría</span>
          <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha">
          <input className="input" type="date" value={date} max="2099-12-31" onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Nota">
          <input
            className="input"
            value={note}
            maxLength={80}
            placeholder={type === "income" ? "Ej. quincena" : type === "transfer" ? "Ej. pago de la tarjeta" : "Ej. almuerzo"}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>

      {many ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={type === "transfer" ? "Sale de" : type === "income" ? "Entra a" : "Pagado con"}>
            <select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {accountLabel(a)}
                </option>
              ))}
            </select>
          </Field>
          {type === "transfer" ? (
            <Field label="Llega a">
              <select className="select" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                <option value="">Elige una cuenta</option>
                {accounts
                  .filter((a) => a.id !== accountId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {accountLabel(a)}
                    </option>
                  ))}
              </select>
            </Field>
          ) : null}
        </div>
      ) : null}

      {crossCurrency && to ? (
        <Field
          label={`Monto que llega a ${to.name}`}
          hint={`Sugerido al tipo de cambio de ₡${data.settings.usdRate} por dólar: ${fmt(suggestedTo, to.currency)}.`}
        >
          <MoneyInput
            key={`to-${round}-${to.id}`}
            value={toAmount ?? 0}
            onChange={(v) => setToAmount(v > 0 ? v : null)}
            currency={to.currency}
            placeholder={fmt(suggestedTo, to.currency).replace(/^[₡$]/, "")}
          />
        </Field>
      ) : null}

      <p className="hint" role="status" aria-live="polite">
        {saved}
      </p>
    </SheetForm>
  );
}

/** Hoja global para anotar o editar un movimiento. */
export function TxSheet() {
  const sheet = useSheets((s) => s.tx);
  const close = useSheets((s) => s.closeTx);
  const shown = useLinger(sheet);
  const title = shown?.id
    ? "Editar movimiento"
    : shown?.preset?.type === "income"
      ? "Registrar ingreso"
      : "Anotar movimiento";
  return (
    <Sheet open={sheet != null} onClose={close} title={title}>
      {shown ? (
        <TxForm
          key={shown.id ?? `nuevo-${shown.preset?.type ?? ""}-${shown.preset?.recurringId ?? ""}`}
          id={shown.id}
          preset={shown.preset}
          onDone={close}
        />
      ) : null}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Cuenta                                                              */
/* ------------------------------------------------------------------ */

export type AccountEdit = { id?: string; type?: AccountType };

function AccountForm({ edit, onDone }: { edit: AccountEdit; onDone: () => void }) {
  const data = useData();
  const existing = edit.id ? data.accounts.find((a) => a.id === edit.id) : undefined;
  const current = existing ? (balances(data).get(existing.id) ?? 0) : 0;
  const startType = existing?.type ?? edit.type ?? "checking";
  const debtMode = startType === "credit" || startType === "loan";
  const typeOptions = ACCOUNT_TYPES.filter((t) => (t.value === "credit" || t.value === "loan") === debtMode);

  const [name, setName] = useState(existing?.name ?? "");
  const [type, setType] = useState<AccountType>(startType);
  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? data.settings.base);
  const [balance, setBalance] = useState(Math.abs(current));
  const [apr, setApr] = useState(existing?.apr != null ? String(existing.apr).replace(".", ",") : "");
  const [minPayment, setMinPayment] = useState(existing?.minPayment ?? 0);
  const [primary, setPrimary] = useState(Boolean(existing?.primary));
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  const save = () => {
    if (!name.trim()) return setError(debtMode ? "Ponle un nombre, por ejemplo Tarjeta BAC." : "Ponle un nombre a la cuenta.");
    const rate = Number(apr.replace(",", "."));
    if (debtMode && apr && !(rate >= 0 && rate < 200)) return setError("La tasa anual debe estar entre 0 y 200.");
    const signed = debtMode ? -balance : balance;
    const fields = {
      name: name.trim(),
      type,
      currency,
      apr: debtMode && apr ? rate : undefined,
      minPayment: debtMode && minPayment ? minPayment : undefined,
    };
    const store = useStore.getState();
    if (existing) {
      store.updateAccount(existing.id, fields);
      if (primary && !existing.primary) store.setPrimary(existing.id);
      const diff = signed - current;
      if (diff !== 0) {
        store.addTx({
          date: today(),
          type: diff > 0 ? "income" : "expense",
          amount: Math.abs(diff),
          accountId: existing.id,
          note: "Ajuste de saldo",
        });
      }
    } else {
      store.addAccount({ ...fields, opening: signed });
    }
    onDone();
  };

  return (
    <SheetForm
      onSubmit={save}
      footer={
        <>
          <Button variant="primary" type="submit" className="flex-1">
            {existing ? "Guardar cambios" : debtMode ? "Agregar deuda" : "Crear cuenta"}
          </Button>
          {existing ? (
            <ConfirmButton
              label="Borrar"
              onConfirm={() => {
                if (useStore.getState().deleteAccount(existing.id)) onDone();
                else setBlocked(true);
              }}
            />
          ) : null}
        </>
      }
    >
      <Field label="Nombre" error={error}>
        <input
          className="input"
          value={name}
          data-autofocus={existing ? undefined : ""}
          maxLength={40}
          placeholder={debtMode ? "Ej. Tarjeta BAC" : "Ej. Ahorros BN"}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
      </Field>
      <div className="field">
        <span className="label">{debtMode ? "Tipo de deuda" : "Tipo"}</span>
        <Segmented
          label={debtMode ? "Tipo de deuda" : "Tipo de cuenta"}
          options={typeOptions.map((t) => ({ value: t.value, label: t.label }))}
          value={type}
          onChange={setType}
        />
      </div>
      {!existing ? (
        <div className="field">
          <span className="label">Moneda</span>
          <Segmented label="Moneda" options={CURRENCIES} value={currency} onChange={setCurrency} />
        </div>
      ) : null}
      <Field
        label={debtMode ? "Cuánto debes hoy" : "Saldo de hoy"}
        hint={existing ? "Si lo cambias, se anota un ajuste de saldo con la diferencia." : undefined}
      >
        <MoneyInput value={balance} onChange={setBalance} currency={currency} />
      </Field>
      {debtMode ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tasa de interés anual (%)" hint="Opcional. Sirve para calcular los intereses.">
            <input className="input num" inputMode="decimal" value={apr} placeholder="Ej. 34" onChange={(e) => setApr(e.target.value)} />
          </Field>
          <Field label="Pago mínimo al mes" hint="Opcional.">
            <MoneyInput value={minPayment} onChange={setMinPayment} currency={currency} />
          </Field>
        </div>
      ) : null}
      {existing && !debtMode ? (
        <label className="check">
          <input type="checkbox" checked={primary} disabled={Boolean(existing.primary)} onChange={(e) => setPrimary(e.target.checked)} />
          <span>Cuenta principal: los movimientos se anotan aquí sin preguntar</span>
        </label>
      ) : null}
      {blocked ? (
        <p className="error" role="alert">
          Esta cuenta tiene movimientos o pagos recurrentes. Bórralos o muévelos antes de borrar la cuenta.
        </p>
      ) : null}
    </SheetForm>
  );
}

export function AccountSheet({ value, onClose }: { value: AccountEdit | null; onClose: () => void }) {
  const title = (v: AccountEdit) =>
    v.id ? "Editar cuenta" : v.type === "credit" || v.type === "loan" ? "Agregar deuda" : "Nueva cuenta";
  return (
    <FormSheet value={value} onClose={onClose} title={title}>
      {(v) => <AccountForm key={v.id ?? `nueva-${v.type ?? ""}`} edit={v} onDone={onClose} />}
    </FormSheet>
  );
}

/* ------------------------------------------------------------------ */
/* Meta                                                                */
/* ------------------------------------------------------------------ */

export const GOAL_KINDS: { value: GoalKind; label: string; icon: string }[] = [
  { value: "emergency", label: "Fondo de emergencia", icon: "shield" },
  { value: "travel", label: "Viaje", icon: "plane" },
  { value: "purchase", label: "Compra", icon: "bag" },
  { value: "home", label: "Casa", icon: "home" },
  { value: "education", label: "Educación", icon: "school" },
  { value: "other", label: "Otra", icon: "target" },
];
export const goalIcon = (kind: GoalKind) => GOAL_KINDS.find((k) => k.value === kind)?.icon ?? "target";

function GoalForm({ id, onDone }: { id?: string; onDone: () => void }) {
  const data = useData();
  const existing = id ? data.goals.find((g) => g.id === id) : undefined;
  const [name, setName] = useState(existing?.name ?? "");
  const [kind, setKind] = useState<GoalKind>(existing?.kind ?? "emergency");
  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? data.settings.base);
  const [target, setTarget] = useState(existing?.target ?? 0);
  const [deadline, setDeadline] = useState(existing?.deadline ?? "");
  const [initial, setInitial] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!name.trim()) return setError("Ponle un nombre a la meta.");
    if (!(target > 0)) return setError("Escribe cuánto necesitas reunir.");
    const fields = { name: name.trim(), kind, currency, target, deadline: deadline || undefined };
    const store = useStore.getState();
    if (existing) store.updateGoal(existing.id, fields);
    else store.addGoal(fields, initial);
    onDone();
  };

  return (
    <SheetForm
      onSubmit={save}
      footer={
        <>
          <Button variant="primary" type="submit" className="flex-1">
            {existing ? "Guardar cambios" : "Crear meta"}
          </Button>
          {existing ? (
            <ConfirmButton
              label="Borrar"
              onConfirm={() => {
                useStore.getState().deleteGoal(existing.id);
                onDone();
              }}
            />
          ) : null}
        </>
      }
    >
      <Field label="Nombre" error={error}>
        <input
          className="input"
          value={name}
          data-autofocus={existing ? undefined : ""}
          maxLength={40}
          placeholder="Ej. Fondo de emergencia"
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
      </Field>
      <Field label="Tipo de meta">
        <select className="select" value={kind} onChange={(e) => setKind(e.target.value as GoalKind)}>
          {GOAL_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </Field>
      {!existing ? (
        <div className="field">
          <span className="label">Moneda</span>
          <Segmented label="Moneda" options={CURRENCIES} value={currency} onChange={setCurrency} />
        </div>
      ) : null}
      <Field label="Cuánto necesitas">
        <MoneyInput value={target} onChange={setTarget} currency={currency} />
      </Field>
      {!existing ? (
        <Field label="Cuánto llevas ahorrado" hint="Opcional. Se anota como saldo inicial de la meta.">
          <MoneyInput value={initial} onChange={setInitial} currency={currency} />
        </Field>
      ) : null}
      <Field label="Fecha objetivo" hint="Opcional. Con fecha, la app calcula cuánto aportar cada mes.">
        <input className="input" type="date" value={deadline} min={today()} onChange={(e) => setDeadline(e.target.value)} />
      </Field>
    </SheetForm>
  );
}

export function GoalSheet({ value, onClose }: { value: { id?: string } | null; onClose: () => void }) {
  return (
    <FormSheet value={value} onClose={onClose} title={(v) => (v.id ? "Editar meta" : "Nueva meta")}>
      {(v) => <GoalForm key={v.id ?? "nueva"} id={v.id} onDone={onClose} />}
    </FormSheet>
  );
}

function ContributionForm({ goal, onDone }: { goal: Goal; onDone: () => void }) {
  const [mode, setMode] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!(amount > 0)) return setError("Escribe un monto mayor que cero.");
    useStore.getState().addContribution(goal.id, {
      date,
      amount: mode === "in" ? amount : -amount,
      note: note.trim() || undefined,
    });
    onDone();
  };

  return (
    <SheetForm
      onSubmit={save}
      footer={
        <Button variant="primary" type="submit" className="flex-1">
          {mode === "in" ? "Guardar aporte" : "Guardar retiro"}
        </Button>
      }
    >
      <Segmented
        label="Tipo"
        options={[
          { value: "in", label: "Aportar" },
          { value: "out", label: "Retirar" },
        ]}
        value={mode}
        onChange={setMode}
        wide
      />
      <Field label="Monto" error={error}>
        <MoneyInput
          value={amount}
          onChange={(v) => {
            setAmount(v);
            setError(null);
          }}
          currency={goal.currency}
          large
          autoFocus
          invalid={Boolean(error)}
        />
      </Field>
      <Field label="Fecha">
        <input className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Nota">
        <input className="input" value={note} maxLength={60} placeholder="Opcional" onChange={(e) => setNote(e.target.value)} />
      </Field>
      <p className="hint">El aporte queda apartado dentro de la meta. No mueve dinero entre tus cuentas.</p>
    </SheetForm>
  );
}

export function ContributionSheet({ value, onClose }: { value: Goal | null; onClose: () => void }) {
  return (
    <FormSheet value={value} onClose={onClose} title={(g) => g.name}>
      {(g) => <ContributionForm key={g.id} goal={g} onDone={onClose} />}
    </FormSheet>
  );
}

/* ------------------------------------------------------------------ */
/* Pago o ingreso recurrente                                           */
/* ------------------------------------------------------------------ */

export type RecurringEdit = { id?: string; preset?: Partial<Recurring> };

function RecurringForm({ edit, onDone }: { edit: RecurringEdit; onDone: () => void }) {
  const data = useData();
  const existing = edit.id ? data.recurring.find((r) => r.id === edit.id) : undefined;
  const init: Partial<Recurring> = existing ?? edit.preset ?? {};
  const accounts = data.accounts.filter((a) => !a.archived || a.id === init.accountId);
  const many = accounts.length > 1;

  const [name, setName] = useState(init.name ?? "");
  const [type, setType] = useState<Recurring["type"]>(init.type ?? "expense");
  const [amount, setAmount] = useState(init.amount ?? 0);
  const [accountId, setAccountId] = useState(init.accountId ?? defaultAccountId(data.accounts));
  const [categoryId, setCategoryId] = useState(init.categoryId ?? "");
  const [frequency, setFrequency] = useState<Frequency>(init.frequency ?? "monthly");
  const [nextDate, setNextDate] = useState(init.nextDate ?? today());
  const [subscription, setSubscription] = useState(init.subscription ?? false);
  const [active, setActive] = useState(init.active ?? true);
  const [error, setError] = useState<string | null>(null);

  const account = data.accounts.find((a) => a.id === accountId);
  const categories = data.categories.filter((c) => !c.archived && c.kind === type);

  const save = () => {
    if (!name.trim()) return setError(type === "income" ? "Ponle un nombre, por ejemplo Quincena." : "Ponle un nombre, por ejemplo Alquiler.");
    if (!(amount > 0)) return setError("Escribe un monto mayor que cero.");
    if (!account) return setError("Crea una cuenta en la sección Cuentas primero.");
    const fields = {
      name: name.trim(),
      type,
      amount,
      accountId,
      categoryId: categoryId || undefined,
      frequency,
      nextDate,
      active,
      subscription: type === "expense" ? subscription : false,
    };
    const store = useStore.getState();
    if (existing) store.updateRecurring(existing.id, fields);
    else store.addRecurring(fields);
    onDone();
  };

  return (
    <SheetForm
      onSubmit={save}
      footer={
        <>
          <Button variant="primary" type="submit" className="flex-1">
            {existing ? "Guardar cambios" : "Guardar"}
          </Button>
          {existing ? (
            <ConfirmButton
              label="Borrar"
              onConfirm={() => {
                useStore.getState().deleteRecurring(existing.id);
                onDone();
              }}
            />
          ) : null}
        </>
      }
    >
      <Segmented
        label="Tipo"
        options={[
          { value: "expense", label: "Pago" },
          { value: "income", label: "Ingreso" },
        ]}
        value={type}
        onChange={(v) => {
          setType(v);
          setCategoryId("");
        }}
        wide
      />
      <Field label="Nombre" error={error}>
        <input
          className="input"
          value={name}
          data-autofocus={existing ? undefined : ""}
          maxLength={40}
          placeholder={type === "income" ? "Ej. Quincena" : "Ej. Alquiler"}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Monto">
          <MoneyInput value={amount} onChange={setAmount} currency={account?.currency ?? data.settings.base} />
        </Field>
        <Field label="Frecuencia">
          <select className="select" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Próxima fecha">
          <input className="input" type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
        </Field>
        {many ? (
          <Field label={type === "income" ? "Entra a" : "Se paga con"}>
            <select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>
      <div className="field">
        <span className="label">Categoría</span>
        <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
      </div>
      {type === "expense" ? (
        <label className="check">
          <input type="checkbox" checked={subscription} onChange={(e) => setSubscription(e.target.checked)} />
          <span>Es una suscripción (música, video, gimnasio)</span>
        </label>
      ) : null}
      {existing ? (
        <label className="check">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span>Activo</span>
        </label>
      ) : null}
    </SheetForm>
  );
}

export function RecurringSheet({ value, onClose }: { value: RecurringEdit | null; onClose: () => void }) {
  const title = (v: RecurringEdit) =>
    v.id ? "Editar recurrente" : v.preset?.type === "income" ? "Programar ingreso" : "Nuevo recurrente";
  return (
    <FormSheet value={value} onClose={onClose} title={title}>
      {(v) => <RecurringForm key={v.id ?? `nuevo-${v.preset?.type ?? ""}`} edit={v} onDone={onClose} />}
    </FormSheet>
  );
}

/* ------------------------------------------------------------------ */
/* Categoría                                                           */
/* ------------------------------------------------------------------ */

function CategoryForm({ id, onDone }: { id?: string; onDone: () => void }) {
  const data = useData();
  const existing = id ? data.categories.find((c) => c.id === id) : undefined;
  const [name, setName] = useState(existing?.name ?? "");
  const [kind, setKind] = useState<Category["kind"]>(existing?.kind ?? "expense");
  const [group, setGroup] = useState<NonNullable<Category["group"]>>(existing?.group ?? "wants");
  const [icon, setIcon] = useState(existing?.icon ?? "dots");
  const [hue, setHue] = useState(existing?.hue ?? 0);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!name.trim()) return setError("Ponle un nombre a la categoría.");
    const fields = { name: name.trim(), kind, group: kind === "expense" ? group : undefined, icon, hue };
    const store = useStore.getState();
    if (existing) store.updateCategory(existing.id, fields);
    else store.addCategory(fields);
    onDone();
  };

  return (
    <SheetForm
      onSubmit={save}
      footer={
        <>
          <Button variant="primary" type="submit" className="flex-1">
            {existing ? "Guardar cambios" : "Crear categoría"}
          </Button>
          {existing ? (
            <Button
              onClick={() => {
                useStore.getState().updateCategory(existing.id, { archived: !existing.archived });
                onDone();
              }}
            >
              {existing.archived ? "Reactivar" : "Archivar"}
            </Button>
          ) : null}
        </>
      }
    >
      <Field label="Nombre" error={error}>
        <input
          className="input"
          value={name}
          data-autofocus={existing ? undefined : ""}
          maxLength={32}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
      </Field>
      {!existing ? (
        <Segmented
          label="Tipo"
          options={[
            { value: "expense", label: "Gasto" },
            { value: "income", label: "Ingreso" },
          ]}
          value={kind}
          onChange={setKind}
        />
      ) : null}
      {kind === "expense" ? (
        <div className="field">
          <span className="label">Para la regla 50/30/20 cuenta como</span>
          <Segmented
            label="Grupo"
            options={[
              { value: "needs", label: "Necesidad" },
              { value: "wants", label: "Gusto" },
            ]}
            value={group}
            onChange={setGroup}
          />
        </div>
      ) : null}
      <div className="field">
        <span className="label">Icono</span>
        <div className="swatches" role="radiogroup" aria-label="Icono">
          {CATEGORY_ICONS.map((n) => (
            <button key={n} type="button" role="radio" aria-checked={icon === n} aria-label={n} onClick={() => setIcon(n)}>
              <Icon name={n} />
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="label">Color</span>
        <div className="swatches" role="radiogroup" aria-label="Color">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((h) => (
            <button key={h} type="button" role="radio" aria-checked={hue === h} aria-label={`Color ${h + 1}`} onClick={() => setHue(h)}>
              <Bullet hue={h} size="sm" />
            </button>
          ))}
        </div>
      </div>
    </SheetForm>
  );
}

export function CategorySheet({ value, onClose }: { value: { id?: string } | null; onClose: () => void }) {
  return (
    <FormSheet value={value} onClose={onClose} title={(v) => (v.id ? "Editar categoría" : "Nueva categoría")}>
      {(v) => <CategoryForm key={v.id ?? "nueva"} id={v.id} onDone={onClose} />}
    </FormSheet>
  );
}
