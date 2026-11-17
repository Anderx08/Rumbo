"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { AccountType, Currency, Mode, World } from "@/lib/types";
import { ACCOUNT_TYPES } from "./forms";
import { Button, Field, Logo, MoneyInput, Segmented } from "./ui";

/* Las miniaturas usan colores fijos porque retratan cada mundo, no el activo. */
const PREVIEWS: Record<World, React.ReactNode> = {
  rutas: (
    <svg viewBox="0 0 120 72" aria-hidden="true">
      <rect width="120" height="72" fill="#f3f4f5" />
      <rect x="8" y="8" width="104" height="56" rx="4" fill="#fff" stroke="#d5d8dc" />
      <path d="M18 26h52" stroke="#111315" strokeWidth="4" strokeLinecap="round" />
      <path d="M78 26h24" stroke="#111315" strokeWidth="4" strokeDasharray="1 7" strokeLinecap="round" />
      <circle cx="70" cy="26" r="5" fill="#fff" stroke="#111315" strokeWidth="3" />
      <path d="M18 42h30" stroke="#d93a2b" strokeWidth="4" strokeLinecap="round" />
      <path d="M18 54h46" stroke="#1463d9" strokeWidth="4" strokeLinecap="round" />
    </svg>
  ),
  mosaicos: (
    <svg viewBox="0 0 120 72" aria-hidden="true">
      <rect width="120" height="72" fill="#000" />
      <rect x="8" y="8" width="52" height="26" fill="#1ba1e2" />
      <rect x="63" y="8" width="23" height="26" fill="#d80073" />
      <rect x="89" y="8" width="23" height="26" fill="#60a917" />
      <rect x="8" y="37" width="23" height="27" fill="#fa6800" />
      <rect x="34" y="37" width="78" height="27" fill="#aa00ff" />
    </svg>
  ),
  senal: (
    <svg viewBox="0 0 120 72" aria-hidden="true">
      <rect width="120" height="72" fill="#ededea" />
      <rect width="120" height="30" fill="#ffd21f" />
      <path d="M14 15h40m0 0-8-7m8 7-8 7" stroke="#0b0b0b" strokeWidth="4" fill="none" />
      <rect x="70" y="9" width="38" height="12" fill="#0b0b0b" />
      <rect x="12" y="40" width="12" height="12" fill="#0b0b0b" />
      <rect x="30" y="43" width="60" height="6" fill="#0b0b0b" />
      <rect x="12" y="56" width="12" height="8" fill="#0b0b0b" />
      <rect x="30" y="57" width="44" height="6" fill="#0b0b0b" />
    </svg>
  ),
  clasico: (
    <svg viewBox="0 0 120 72" aria-hidden="true">
      <rect width="120" height="72" fill="#f6f7f9" />
      <rect x="8" y="8" width="48" height="24" rx="6" fill="#fff" stroke="#e2e6eb" />
      <rect x="64" y="8" width="48" height="24" rx="6" fill="#fff" stroke="#e2e6eb" />
      <rect x="8" y="38" width="104" height="26" rx="6" fill="#fff" stroke="#e2e6eb" />
      <rect x="14" y="14" width="20" height="4" rx="2" fill="#5b6779" />
      <rect x="14" y="22" width="30" height="5" rx="2" fill="#0f172a" />
      <rect x="16" y="48" width="88" height="6" rx="3" fill="#e2e6eb" />
      <rect x="16" y="48" width="54" height="6" rx="3" fill="#087f5b" />
    </svg>
  ),
};

export const WORLDS: { value: World; name: string; blurb: string }[] = [
  { value: "rutas", name: "Rutas", blurb: "Tu dinero como un diagrama de líneas con estaciones y fecha de llegada." },
  { value: "mosaicos", name: "Mosaicos", blurb: "Color plano y cifras enormes, sin bordes ni adornos." },
  { value: "senal", name: "Señalética", blurb: "Bandas amarillas y flechas: cada pantalla dice a dónde ir." },
  { value: "clasico", name: "Clásico", blurb: "Tarjetas limpias y calmadas, lo conocido bien hecho." },
];

export const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "system", label: "Como el sistema" },
];

export function WorldPicker() {
  const world = useStore((s) => s.ui.world);
  const setWorld = useStore((s) => s.setWorld);
  return (
    <div className="worlds" role="radiogroup" aria-label="Mundo visual">
      {WORLDS.map((w) => (
        <button
          key={w.value}
          type="button"
          role="radio"
          aria-checked={w.value === world}
          onClick={() => setWorld(w.value)}
        >
          {PREVIEWS[w.value]}
          <span className="worlds-name">{w.name}</span>
          <span className="worlds-blurb">{w.blurb}</span>
        </button>
      ))}
    </div>
  );
}

export function ModePicker() {
  const mode = useStore((s) => s.ui.mode);
  const setMode = useStore((s) => s.setMode);
  return <Segmented label="Modo de color" options={MODE_OPTIONS} value={mode} onChange={setMode} />;
}

export function Onboarding() {
  const [name, setName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [currency, setCurrency] = useState<Currency>("CRC");
  const [balance, setBalance] = useState(0);
  const [rate, setRate] = useState("505");

  const start = () => {
    const debt = type === "credit" || type === "loan";
    const usdRate = Number(rate.replace(",", ".")) || 505;
    useStore.getState().startEmpty(
      name.trim(),
      {
        name: accountName.trim() || ACCOUNT_TYPES.find((t) => t.value === type)!.label,
        type,
        currency,
        opening: debt ? -balance : balance,
      },
      { base: "CRC", usdRate },
    );
  };

  return (
    <main className="onboard">
      <div className="brand">
        <Logo />
        Rumbo
      </div>

      <header className="onboard-head">
        <h1 className="h-page">Lleva la cuenta de tu dinero y mira cuándo llegas</h1>
        <p className="pagehead-sub">
          Anota lo que entra y lo que sale. Rumbo calcula cuánto te queda este mes, cuándo cumples cada meta,
          cuándo quedas sin deudas y cuánto falta para vivir de tus inversiones. Todo se guarda solo en este
          dispositivo.
        </p>
      </header>

      <section className="grid gap-4">
        <h2 className="h-section">Elige cómo se ve</h2>
        <WorldPicker />
        <ModePicker />
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <form
          className="panel grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
        >
          <h2 className="h-section">Empezar con mis datos</h2>
          <Field label="¿Cómo te llamas?" hint="Opcional. Solo se usa para saludarte.">
            <input className="input" value={name} maxLength={30} autoComplete="given-name" onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tu primera cuenta">
              <select className="select" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nombre de la cuenta" hint="Opcional.">
              <input className="input" value={accountName} maxLength={40} placeholder="Ej. Cuenta del banco" onChange={(e) => setAccountName(e.target.value)} />
            </Field>
          </div>
          <div className="field">
            <span className="label">Moneda de la cuenta</span>
            <Segmented
              label="Moneda de la cuenta"
              options={[
                { value: "CRC", label: "Colones ₡" },
                { value: "USD", label: "Dólares $" },
              ]}
              value={currency}
              onChange={setCurrency}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={type === "credit" || type === "loan" ? "Cuánto debes hoy" : "Saldo de hoy"}>
              <MoneyInput value={balance} onChange={setBalance} currency={currency} />
            </Field>
            <Field label="Tipo de cambio" hint="Colones por dólar. Lo cambias cuando quieras.">
              <input className="input num" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
            </Field>
          </div>
          <div>
            <Button variant="primary" type="submit">
              Crear y empezar
            </Button>
          </div>
        </form>

        <section className="panel grid gap-3">
          <h2 className="h-section">Explorar con datos de ejemplo</h2>
          <p className="muted">
            Seis meses ficticios de una persona asalariada en Costa Rica: quincenas, alquiler, tarjeta, un préstamo y
            tres metas. La app los marca como ejemplo y se borran con un clic.
          </p>
          <div>
            <Button onClick={() => useStore.getState().startDemo(name.trim())}>Ver el ejemplo</Button>
          </div>
        </section>
      </div>
    </main>
  );
}
