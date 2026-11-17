"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { today } from "./dates";
import { advance, nextPayday, postingDate } from "./engine";
import { demoData, emptyData, uid } from "./seed";
import type {
  Account,
  Category,
  Contribution,
  Data,
  Goal,
  Mode,
  Money,
  Recurring,
  Settings,
  Tx,
  UiPrefs,
} from "./types";

const UI_KEY = "rumbo:ui";
const DEFAULT_UI: UiPrefs = { mode: "system" };
const MODES: Mode[] = ["light", "dark", "system"];

function readUi(): UiPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(UI_KEY) ?? "null");
    if (MODES.includes(raw?.mode)) return { mode: raw.mode };
  } catch {
    /* almacenamiento bloqueado: se usa el valor por defecto */
  }
  return DEFAULT_UI;
}

/** Aplica el modo claro u oscuro al documento y lo recuerda. */
export function applyUi(ui: UiPrefs) {
  const root = document.documentElement;
  const dark =
    ui.mode === "dark" ||
    (ui.mode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  delete root.dataset.world;
  root.dataset.mode = dark ? "dark" : "light";
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(ui));
  } catch {
    /* sin almacenamiento, el cambio dura solo esta sesión */
  }
}

type NewTx = Omit<Tx, "id" | "createdAt">;

export interface StartOptions {
  name: string;
  /** Lo que la persona tiene hoy, en colones. */
  balance: Money;
  /** Lo que recibe cada quincena; 0 si no aplica. */
  quincena: Money;
}

interface State {
  data: Data;
  ui: UiPrefs;
  hydrated: boolean;

  hydrate: () => void;
  setMode: (mode: Mode) => void;

  /** Crea la cuenta principal y, si hay quincena, el ingreso que se repite. */
  startEmpty: (opts: StartOptions) => void;
  startDemo: (name: string) => void;
  replaceData: (data: Data) => void;
  resetAll: () => void;

  addTx: (tx: NewTx) => void;
  updateTx: (id: string, patch: Partial<NewTx>) => void;
  deleteTx: (id: string) => void;

  addAccount: (a: Omit<Account, "id">) => void;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  /** Marca una cuenta como la principal y desmarca las demás. */
  setPrimary: (id: string) => void;
  /** Devuelve false si la cuenta tiene movimientos y no se puede borrar. */
  deleteAccount: (id: string) => boolean;

  addCategory: (c: Omit<Category, "id">) => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;

  setBudget: (categoryId: string, amount: number) => void;
  setBudgets: (budgets: Record<string, number>) => void;

  addGoal: (g: Omit<Goal, "id" | "createdAt" | "contributions">, initial?: number) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  addContribution: (goalId: string, c: Omit<Contribution, "id">) => void;
  deleteContribution: (goalId: string, id: string) => void;

  addRecurring: (r: Omit<Recurring, "id">) => void;
  updateRecurring: (id: string, patch: Partial<Recurring>) => void;
  deleteRecurring: (id: string) => void;
  /** Crea el movimiento de la ocurrencia pendiente y avanza la fecha. */
  postRecurring: (id: string) => void;
  /** Avanza la fecha sin registrar movimiento. */
  skipRecurring: (id: string) => void;

  updateSettings: (patch: Partial<Settings>) => void;
}

export const useStore = create<State>()(
  persist(
    (set, get) => {
      const mutate = (fn: (d: Data) => Partial<Data>) =>
        set((s) => ({ data: { ...s.data, ...fn(s.data) } }));

      return {
        data: emptyData(),
        ui: DEFAULT_UI,
        hydrated: false,

        hydrate: () => {
          if (get().hydrated) return;
          let ui = readUi();
          // Enlaces de demostración: /?ejemplo=1&modo=dark
          const query = new URLSearchParams(window.location.search);
          const mode = query.get("modo") as Mode | null;
          if (mode && MODES.includes(mode)) ui = { mode };
          applyUi(ui);
          void Promise.resolve(useStore.persist.rehydrate()).then(() => {
            set({ ui, hydrated: true });
            // El ejemplo solo se carga si todavía no hay datos propios.
            if (query.has("ejemplo") && !get().data.onboarded) {
              set({ data: demoData(today(), "") });
            }
          });
        },
        setMode: (mode) => {
          const ui = { mode };
          applyUi(ui);
          set({ ui });
        },

        startEmpty: ({ name, balance, quincena }) =>
          set(() => {
            const d = emptyData();
            const account: Account = {
              id: uid(),
              name: "Mi dinero",
              type: "checking",
              currency: "CRC",
              opening: Math.max(0, balance),
              primary: true,
            };
            const recurring: Recurring[] =
              quincena > 0
                ? [
                    {
                      id: uid(),
                      name: "Quincena",
                      type: "income",
                      amount: quincena,
                      accountId: account.id,
                      categoryId: "salario",
                      frequency: "semimonthly",
                      nextDate: nextPayday(today()),
                      active: true,
                    },
                  ]
                : [];
            return {
              data: {
                ...d,
                onboarded: true,
                accounts: [account],
                recurring,
                settings: { ...d.settings, name },
              },
            };
          }),
        startDemo: (name) => set({ data: demoData(today(), name) }),
        replaceData: (data) => set({ data }),
        resetAll: () => set({ data: emptyData() }),

        addTx: (tx) =>
          mutate((d) => ({
            txs: [...d.txs, { ...tx, id: uid(), createdAt: Date.now() }],
          })),
        updateTx: (id, patch) =>
          mutate((d) => ({
            txs: d.txs.map((t) => (t.id === id ? { ...t, ...patch } : t)),
          })),
        deleteTx: (id) => mutate((d) => ({ txs: d.txs.filter((t) => t.id !== id) })),

        addAccount: (a) =>
          mutate((d) => ({
            accounts: [
              ...d.accounts,
              // La primera cuenta de dinero pasa a ser la principal.
              {
                ...a,
                id: uid(),
                primary:
                  a.primary ??
                  (!["credit", "loan"].includes(a.type) &&
                    !d.accounts.some((x) => !["credit", "loan"].includes(x.type))),
              },
            ],
          })),
        updateAccount: (id, patch) =>
          mutate((d) => ({
            accounts: d.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
          })),
        setPrimary: (id) =>
          mutate((d) => ({
            accounts: d.accounts.map((a) => ({ ...a, primary: a.id === id })),
          })),
        deleteAccount: (id) => {
          const d = get().data;
          const used =
            d.txs.some((t) => t.accountId === id || t.toAccountId === id) ||
            d.recurring.some((r) => r.accountId === id);
          if (used) return false;
          mutate((x) => ({ accounts: x.accounts.filter((a) => a.id !== id) }));
          return true;
        },

        addCategory: (c) =>
          mutate((d) => ({ categories: [...d.categories, { ...c, id: uid() }] })),
        updateCategory: (id, patch) =>
          mutate((d) => ({
            categories: d.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          })),

        setBudget: (categoryId, amount) =>
          mutate((d) => {
            const budgets = { ...d.budgets };
            if (amount > 0) budgets[categoryId] = amount;
            else delete budgets[categoryId];
            return { budgets };
          }),
        setBudgets: (budgets) => mutate(() => ({ budgets })),

        addGoal: (g, initial) =>
          mutate((d) => ({
            goals: [
              ...d.goals,
              {
                ...g,
                id: uid(),
                createdAt: Date.now(),
                contributions:
                  initial && initial > 0
                    ? [{ id: uid(), date: today(), amount: initial, note: "Saldo inicial", initial: true }]
                    : [],
              },
            ],
          })),
        updateGoal: (id, patch) =>
          mutate((d) => ({
            goals: d.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
          })),
        deleteGoal: (id) => mutate((d) => ({ goals: d.goals.filter((g) => g.id !== id) })),
        addContribution: (goalId, c) =>
          mutate((d) => ({
            goals: d.goals.map((g) =>
              g.id === goalId
                ? { ...g, contributions: [...g.contributions, { ...c, id: uid() }] }
                : g,
            ),
          })),
        deleteContribution: (goalId, id) =>
          mutate((d) => ({
            goals: d.goals.map((g) =>
              g.id === goalId
                ? { ...g, contributions: g.contributions.filter((c) => c.id !== id) }
                : g,
            ),
          })),

        addRecurring: (r) => mutate((d) => ({ recurring: [...d.recurring, { ...r, id: uid() }] })),
        updateRecurring: (id, patch) =>
          mutate((d) => ({
            recurring: d.recurring.map((r) => (r.id === id ? { ...r, ...patch } : r)),
          })),
        deleteRecurring: (id) =>
          mutate((d) => ({ recurring: d.recurring.filter((r) => r.id !== id) })),
        postRecurring: (id) =>
          mutate((d) => {
            const r = d.recurring.find((x) => x.id === id);
            if (!r) return {};
            const tx: Tx = {
              id: uid(),
              createdAt: Date.now(),
              date: postingDate(r.nextDate, today()),
              type: r.type,
              amount: r.amount,
              accountId: r.accountId,
              categoryId: r.categoryId,
              note: r.name,
              recurringId: r.id,
            };
            return {
              txs: [...d.txs, tx],
              recurring: d.recurring.map((x) =>
                x.id === id ? { ...x, nextDate: advance(x.nextDate, x.frequency) } : x,
              ),
            };
          }),
        skipRecurring: (id) =>
          mutate((d) => ({
            recurring: d.recurring.map((x) =>
              x.id === id ? { ...x, nextDate: advance(x.nextDate, x.frequency) } : x,
            ),
          })),

        updateSettings: (patch) =>
          mutate((d) => ({ settings: { ...d.settings, ...patch } })),
      };
    },
    {
      name: "rumbo:v1",
      version: 1,
      skipHydration: true,
      partialize: (s) => ({ data: s.data }),
    },
  ),
);

/** Atajo para leer solo los datos. */
export const useData = () => useStore((s) => s.data);
