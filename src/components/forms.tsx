"use client";

import { useMemo, useState } from "react";
import { today } from "@/lib/dates";
import { balances } from "@/lib/engine";
import { convert, fmt } from "@/lib/money";
import { useSheets } from "@/lib/sheets";
import { useData, useStore } from "@/lib/store";
import {
  isLiability,
  type Account,
  type AccountType,
  type Category,
  type Currency,
  type Frequency,
  type Goal,
  type GoalKind,
  type Recurring,
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
  { value: "cash", label: "Efectivo", icon: "wallet" },
  { value: "checking", label: "Cuenta corriente", icon: "bank" },
  { value: "savings", label: "Ahorros", icon: "piggy" },
  { value: "investment", label: "Inversión", icon: "trending" },
  { value: "credit", label: "Tarjeta de crédito", icon: "card" },
  { value: "loan", label: "Préstamo", icon: "loan" },
];

export const accountIcon = (type: AccountType) =>
  ACCOUNT_TYPES.find((t) => t.value === type)?.icon ?? "wallet";
export const accountTypeLabel = (type: AccountType) =>
  ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? "";

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "weekly", label: "Cada semana" },
  { value: "semimonthly", label: "Cada quincena (15 y fin de mes)" },
  { value: "monthly", label: "Cada mes" },
  { value: "yearly", label: "Cada año" },
];

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "CRC", label: "Colones ₡" },
  { value: "USD", label: "Dólares $" },
];

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

function TxForm({ id, preset, onDone }: { id?: string; preset?: Record<string, unknown>; onDone: () => void }) {
  const data = useData();
  const existing = id ? data.txs.find((t) => t.id === id) : undefined;
  const init = (existing ?? preset ?? {}) as Partial<NonNullable<typeof existing>>;
  const bal = useMemo(() => balances(data), [data]);

  const lastAccount = useMemo(() => {
    const last = [...data.txs].sort((a, b) => b.createdAt - a.createdAt)[0];
    return last?.accountId ?? data.accounts[0]?.id ?? "";
  }, [data]);

  const [type, setType] = useState<TxType>(init.type ?? "expense");
  const [amount, setAmount] = useState(init.amount ?? 0);
  const [accountId, setAccountId] = useState(init.accountId ?? lastAccount);
  const [toAccountId, setToAccountId] = useState(init.toAccountId ?? "");
  const [toAmount, setToAmount] = useState<number | null>(init.toAmount ?? null);
  const [categoryId, setCategoryId] = useState(init.categoryId ?? "");
  const [date, setDate] = useState(init.date ?? today());
  const [note, setNote] = useState(init.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  const from = data.accounts.find((a) => a.id === accountId);
  const to = data.accounts.find((a) => a.id === toAccountId);
  const currency = from?.currency ?? data.settings.base;
  const crossCurrency = type === "transfer" && from && to && from.currency !== to.currency;
  const suggestedTo =
    crossCurrency && from && to
      ? convert(amount, from.currency, to.currency, data.settings.usdRate)
      : 0;
  const categories = data.categories.filter(
    (c) => !c.archived && c.kind === (type === "income" ? "income" : "expense"),
  );

  const changeType = (next: TxType) => {
    setType(next);
    setCategoryId("");
    setError(null);
  };

  const save = (another: boolean) => {
    if (!from) return setError("Elige una cuenta.");
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
    };
    const store = useStore.getState();
    if (existing) store.updateTx(existing.id, tx);
    else store.addTx(tx);
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

  return (
    <SheetForm
      onSubmit={() => save(false)}
      footer={
        <>
          <Button variant="primary" type="submit" className="flex-1">
            {existing ? "Guardar cambios" : "Guardar"}
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
            <Button onClick={() => save(true)}>Guardar y anotar otro</Button>
          )}
        </>
      }
    >
      <Segmented label="Tipo de movimiento" options={TX_TYPES} value={type} onChange={changeType} />

      <Field label="Monto" error={error}>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={type === "transfer" ? "Sale de" : type === "income" ? "Entra a" : "Pagado con"}>
          <select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {fmt(bal.get(a.id) ?? 0, a.currency)}
              </option>
            ))}
          </select>
        </Field>
        {type === "transfer" ? (
          <Field label="Llega a">
            <select className="select" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
              <option value="">Elige una cuenta</option>
              {data.accounts
                .filter((a) => a.id !== accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {fmt(bal.get(a.id) ?? 0, a.currency)}
                  </option>
                ))}
            </select>
          </Field>
        ) : null}
        <Field label="Fecha">
          <input className="input" type="date" value={date} max="2099-12-31" onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

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

      {type !== "transfer" ? (
        <div className="field">
          <span className="label">Categoría</span>
          <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
        </div>
      ) : null}

      <Field label="Nota">
        <input
          className="input"
          value={note}
          maxLength={80}
          placeholder={type === "income" ? "Ej. salario de la quincena" : type === "transfer" ? "Ej. pago de la tarjeta" : "Ej. almuerzo"}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

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
  return (
    <Sheet open={sheet != null} onClose={close} title={shown?.id ? "Editar movimiento" : "Anotar movimiento"}>
      {shown ? (
        <TxForm key={shown.id ?? "nuevo"} id={shown.id} preset={shown.preset as Record<string, unknown>} onDone={close} />
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

  const [name, setName] = useState(existing?.name ?? "");
  const [type, setType] = useState<AccountType>(existing?.type ?? edit.type ?? "checking");
  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? data.settings.base);
  const [balance, setBalance] = useState(Math.abs(current));
  const [apr, setApr] = useState(existing?.apr != null ? String(existing.apr) : "");
  const [minPayment, setMinPayment] = useState(existing?.minPayment ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  const debt = type === "credit" || type === "loan";

  const save = () => {
    if (!name.trim()) return setError("Ponle un nombre a la cuenta.");
    const rate = Number(apr.replace(",", "."));
    if (debt && apr && !(rate >= 0 && rate < 200)) return setError("La tasa anual debe estar entre 0 y 200.");
    const signed = debt ? -balance : balance;
    const fields = {
      name: name.trim(),
      type,
      currency,
      apr: debt && apr ? rate : undefined,
      minPayment: debt && minPayment ? minPayment : undefined,
    };
    const store = useStore.getState();
    if (existing) {
      store.updateAccount(existing.id, fields);
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
            {existing ? "Guardar cambios" : "Crear cuenta"}
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
          autoFocus={!existing}
          data-autofocus={existing ? undefined : ""}
          maxLength={40}
          placeholder="Ej. Cuenta corriente del banco"
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
      </Field>
      <Field label="Tipo">
        <select className="select" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
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
      <Field
        label={debt ? "Cuánto debes hoy" : "Saldo actual"}
        hint={
          existing
            ? "Si lo cambias, se anota un ajuste de saldo con la diferencia."
            : debt
              ? "El saldo pendiente, sin signo."
              : "Lo que hay en la cuenta hoy."
        }
      >
        <MoneyInput value={balance} onChange={setBalance} currency={currency} />
      </Field>
      {debt ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tasa de interés anual (%)">
            <input className="input num" inputMode="decimal" value={apr} placeholder="Ej. 34" onChange={(e) => setApr(e.target.value)} />
          </Field>
          <Field label="Pago mínimo al mes">
            <MoneyInput value={minPayment} onChange={setMinPayment} currency={currency} />
          </Field>
        </div>
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
  return (
    <FormSheet value={value} onClose={onClose} title={(v) => (v.id ? "Editar cuenta" : "Nueva cuenta")}>
      {(v) => <AccountForm key={v.id ?? "nueva"} edit={v} onDone={onClose} />}
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
          autoFocus={!existing}
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
      <p className="hint">
        El aporte queda apartado dentro de la meta. No mueve dinero entre tus cuentas.
      </p>
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
/* Pago recurrente                                                     */
/* ------------------------------------------------------------------ */

function RecurringForm({ id, onDone }: { id?: string; onDone: () => void }) {
  const data = useData();
  const existing = id ? data.recurring.find((r) => r.id === id) : undefined;
  const [name, setName] = useState(existing?.name ?? "");
  const [type, setType] = useState<Recurring["type"]>(existing?.type ?? "expense");
  const [amount, setAmount] = useState(existing?.amount ?? 0);
  const [accountId, setAccountId] = useState(existing?.accountId ?? data.accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? "");
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? "monthly");
  const [nextDate, setNextDate] = useState(existing?.nextDate ?? today());
  const [subscription, setSubscription] = useState(existing?.subscription ?? false);
  const [active, setActive] = useState(existing?.active ?? true);
  const [error, setError] = useState<string | null>(null);

  const account = data.accounts.find((a) => a.id === accountId);
  const categories = data.categories.filter((c) => !c.archived && c.kind === type);

  const save = () => {
    if (!name.trim()) return setError("Ponle un nombre, por ejemplo Alquiler.");
    if (!(amount > 0)) return setError("Escribe un monto mayor que cero.");
    if (!account) return setError("Elige una cuenta.");
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
            {existing ? "Guardar cambios" : "Crear"}
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
      />
      <Field label="Nombre" error={error}>
        <input
          className="input"
          value={name}
          autoFocus={!existing}
          data-autofocus={existing ? undefined : ""}
          maxLength={40}
          placeholder={type === "income" ? "Ej. Salario" : "Ej. Alquiler"}
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
        <Field label="Cuenta">
          <select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
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
      <label className="check">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        <span>Activo</span>
      </label>
    </SheetForm>
  );
}

export function RecurringSheet({ value, onClose }: { value: { id?: string } | null; onClose: () => void }) {
  return (
    <FormSheet value={value} onClose={onClose} title={(v) => (v.id ? "Editar recurrente" : "Nuevo recurrente")}>
      {(v) => <RecurringForm key={v.id ?? "nuevo"} id={v.id} onDone={onClose} />}
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
          autoFocus={!existing}
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
          {CATEGORY_ICONS.map((name) => (
            <button key={name} type="button" role="radio" aria-checked={icon === name} aria-label={name} onClick={() => setIcon(name)}>
              <Icon name={name} />
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

export const isDebt = (a: Account) => isLiability(a);
