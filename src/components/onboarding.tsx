"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Mode } from "@/lib/types";
import { Button, Field, Logo, MoneyInput, Segmented } from "./ui";

export const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "system", label: "Como el sistema" },
];

export function ModePicker() {
  const mode = useStore((s) => s.ui.mode);
  const setMode = useStore((s) => s.setMode);
  return <Segmented label="Modo de color" options={MODE_OPTIONS} value={mode} onChange={setMode} />;
}

export function Onboarding() {
  const [name, setName] = useState("");
  const [balance, setBalance] = useState(0);
  const [quincena, setQuincena] = useState(0);

  const start = () => useStore.getState().startEmpty({ name: name.trim(), balance, quincena });

  return (
    <main className="onboard">
      <div className="brand">
        <Logo />
        Rumbo
      </div>

      <header className="onboard-head">
        <h1 className="h-page">Lleva la cuenta de tu dinero y mira cuándo llegas</h1>
        <p className="pagehead-sub">
          Anota lo que entra y lo que sale. Rumbo calcula cuánto te queda este mes, cuándo cumples cada meta, cuándo
          quedas sin deudas y cuánto falta para vivir de tus inversiones. Todo se guarda solo en este dispositivo.
        </p>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <form
          className="panel grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
        >
          <h2 className="h-section">Empezar con mis datos</h2>
          <p className="muted">Tres datos y listo. Todo es opcional y lo puedes cambiar después.</p>
          <Field label="¿Cómo te llamas?">
            <input className="input" value={name} maxLength={30} autoComplete="given-name" onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="¿Cuánto dinero tienes hoy?" hint="Lo que tienes entre tus cuentas y efectivo, en colones.">
            <MoneyInput value={balance} onChange={setBalance} currency="CRC" label="¿Cuánto dinero tienes hoy?" />
          </Field>
          <Field
            label="¿Cuánto recibes cada quincena?"
            hint="Cada 15 y fin de mes te recordamos registrarla con un toque. Déjalo vacío si no cobras por quincena."
          >
            <MoneyInput value={quincena} onChange={setQuincena} currency="CRC" label="¿Cuánto recibes cada quincena?" />
          </Field>
          <div>
            <Button variant="primary" type="submit">
              Empezar
            </Button>
          </div>
        </form>

        <section className="panel grid gap-3">
          <h2 className="h-section">Explorar con datos de ejemplo</h2>
          <p className="muted">
            Seis meses ficticios de una persona asalariada en Costa Rica: quincenas, alquiler, tarjeta, un préstamo y tres
            metas. La app los marca como ejemplo y se borran con un clic.
          </p>
          <div>
            <Button onClick={() => useStore.getState().startDemo(name.trim())}>Ver el ejemplo</Button>
          </div>
        </section>
      </div>
    </main>
  );
}
