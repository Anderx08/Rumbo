"use client";

import { create } from "zustand";
import type { Tx } from "./types";

interface TxSheet {
  /** Movimiento a editar; sin id es uno nuevo. */
  id?: string;
  preset?: Partial<Tx>;
}

interface Sheets {
  tx: TxSheet | null;
  openTx: (sheet?: TxSheet) => void;
  closeTx: () => void;
}

/** Estado de la hoja global para anotar o editar un movimiento. */
export const useSheets = create<Sheets>((set) => ({
  tx: null,
  openTx: (sheet = {}) => set({ tx: sheet }),
  closeTx: () => set({ tx: null }),
}));
