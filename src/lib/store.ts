"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { today } from "./dates";
import { advance } from "./engine";
import { demoData, emptyData, uid } from "./seed";
import type {
  Account,
  Category,
  Contribution,
  Data,
  Goal,
  Mode,
  Recurring,
  Settings,
  Tx,
  UiPrefs,
  World,
} from "./types";

const UI_KEY = "rumbo:ui";
const DEFAULT_UI: UiPrefs = { world: "rutas", mode: "system" };

function readUi(): UiPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(UI_KEY) ?? "null");
    if (raw?.world && raw?.mode) return raw as UiPrefs;
  } catch {
    /* almacenamiento bloqueado: se usa el valor por defecto */
  }
  return DEFAULT_UI;
}

/** Aplica el mundo visual y el modo al documento, y los recuerda. */
export function applyUi(ui: UiPrefs) {
  const root = document.documentElement;
  const dark =
    ui.mode === "dark" ||
    (ui.mode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.world = ui.world;
  root.dataset.mode = dark ? "dark" : "light";
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(ui));
  } catch {
    /* sin almacenamiento, el cambio dura solo esta sesión */
  }
}

type NewTx = Omit<Tx, "id" | "createdAt">;

interface State {
  data: Data;
  ui: UiPrefs;
  hydrated: boolean;

  hydrate: () => void;
  setWorld: (world: World) => void;
  setMode: (mode: Mode) => void;

  startEmpty: (name: string, account: Omit<Account, "id">, settings: Partial<Settings>) => void;
  startDemo: (name: string) => void;
  replaceData: (data: Data) => void;
  resetAll: () => void;

  addTx: (tx: NewTx) => void;
  updateTx: (id: string, patch: Partial<NewTx>) => void;
  deleteTx: (id: string) => void;

  addAccount: (a: Omit<Account, "id">) => void;
  updateAccount: (id: string, patch: Partial<Account>) => void;
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
          // Enlaces de demostración: /?ejemplo=1&mundo=mosaicos&modo=dark
          const query = new URLSearchParams(window.location.search);
          const world = query.get("mundo") as World | null;
          const mode = query.get("modo") as Mode | null;
          if (world && ["rutas", "mosaicos", "senal", "clasico"].includes(world)) ui = { ...ui, world };
          if (mode && ["light", "dark", "system"].includes(mode)) ui = { ...ui, mode };
          applyUi(ui);
          void Promise.resolve(useStore.persist.rehydrate()).then(() => {
            set({ ui, hydrated: true });
            // El ejemplo solo se carga si todavía no hay datos propios.
            if (query.has("ejemplo") && !get().data.onboarded) {
              set({ data: demoData(today(), "") });
            }
          });
        },
        setWorld: (world) => {
          const ui = { ...get().ui, world };
          applyUi(ui);
          set({ ui });
        },
        setMode: (mode) => {
          const ui = { ...get().ui, mode };
          applyUi(ui);
          set({ ui });
        },

        startEmpty: (name, account, settings) =>
          set(() => {
            const d = emptyData();
            return {
              data: {
                ...d,
                onboarded: true,
                accounts: [{ ...account, id: uid() }],
                settings: { ...d.settings, ...settings, name },
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

        addAccount: (a) => mutate((d) => ({ accounts: [...d.accounts, { ...a, id: uid() }] })),
        updateAccount: (id, patch) =>
          mutate((d) => ({
            accounts: d.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
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
              date: r.nextDate,
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
