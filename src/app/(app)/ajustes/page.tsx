"use client";

import { Download, Smartphone, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { CategorySheet } from "@/components/forms";
import { ModePicker, WorldPicker } from "@/components/onboarding";
import { Bullet, Button, Chip, ConfirmButton, Field, PageHead, Panel, Segmented } from "@/components/ui";
import { download, exportJSON, parseBackup, toCSV } from "@/lib/backup";
import { useToday } from "@/lib/hooks";
import { convert } from "@/lib/money";
import { isIos, useOffline, type OfflineStatus } from "@/lib/offline";
import { useData, useStore } from "@/lib/store";
import type { Category, Currency } from "@/lib/types";

const OFFLINE_TEXT: Record<OfflineStatus, string> = {
  ready: "Lista. La app abre y funciona sin conexión en este dispositivo.",
  installing: "Guardando la app en este dispositivo para usarla sin conexión.",
  development:
    "En modo desarrollo no se activa. Funciona con npm run build y npm start, o en la versión publicada.",
  unsupported:
    "Este navegador no lo permite aquí. Hace falta abrir la app por HTTPS (o en localhost) en un navegador actual.",
  error: "No se pudo preparar el uso sin conexión. Recarga la página con conexión para reintentarlo.",
};

function OfflinePanel() {
  const { status, installed, canInstall, persisted, install, protect } = useOffline();
  // Esta página solo se pinta en el navegador (después de leer los datos locales).
  const [ios] = useState(() => isIos());

  return (
    <Panel title="Instalar y usar sin conexión">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip state={status === "ready" ? "good" : status === "error" ? "bad" : undefined}>
            {status === "ready" ? "Sin conexión: lista" : status === "installing" ? "Preparando" : "No activa"}
          </Chip>
          <span className="hint" role="status">
            {OFFLINE_TEXT[status]}
          </span>
        </div>

        <div className="grid gap-2">
          {installed ? (
            <p className="muted">Ya la tienes instalada como app en este dispositivo.</p>
          ) : canInstall ? (
            <div>
              <Button variant="primary" onClick={() => void install()}>
                <Smartphone aria-hidden="true" />
                Instalar Rumbo
              </Button>
            </div>
          ) : ios ? (
            <p className="muted">
              En iPhone o iPad: abre la app en Safari, toca Compartir y elige «Añadir a pantalla de inicio».
            </p>
          ) : (
            <p className="muted">
              Para instalarla, usa la opción «Instalar app» o «Añadir a pantalla de inicio» del menú de tu navegador.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-4">
          {persisted ? (
            <span className="hint">
              Almacenamiento protegido: el navegador no borrará tus datos para liberar espacio.
            </span>
          ) : (
            <>
              <Button onClick={() => void protect()} disabled={persisted == null && status === "unsupported"}>
                Proteger mis datos
              </Button>
              <span className="hint">
                Pide al navegador que no borre tus datos si falta espacio. Algunos navegadores solo lo conceden a apps
                instaladas.
              </span>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

export default function AjustesPage() {
  const data = useData();
  const today = useToday();
  const { settings } = data;
  const fileRef = useRef<HTMLInputElement>(null);
  const [rate, setRate] = useState(String(settings.usdRate).replace(".", ","));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [category, setCategory] = useState<{ id?: string } | null>(null);

  const update = useStore((s) => s.updateSettings);

  const changeBase = (base: Currency) => {
    if (base === settings.base) return;
    const to = (v: number) => convert(v, settings.base, base, settings.usdRate);
    const store = useStore.getState();
    store.setBudgets(Object.fromEntries(Object.entries(data.budgets).map(([id, v]) => [id, to(v)])));
    store.updateSettings({
      base,
      debtExtra: to(settings.debtExtra),
      plan: {
        ...settings.plan,
        invested: settings.plan.invested != null ? to(settings.plan.invested) : undefined,
        monthly: settings.plan.monthly != null ? to(settings.plan.monthly) : undefined,
        annualSpend: settings.plan.annualSpend != null ? to(settings.plan.annualSpend) : undefined,
      },
    });
  };

  const importFile = async (file: File) => {
    try {
      const next = parseBackup(await file.text());
      useStore.getState().replaceData(next);
      setRate(String(next.settings.usdRate).replace(".", ","));
      setMessage({ ok: true, text: `Respaldo cargado: ${next.txs.length} movimientos y ${next.accounts.length} cuentas.` });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "No se pudo leer el archivo." });
    }
  };

  const list = (kind: Category["kind"]) =>
    data.categories
      .filter((c) => c.kind === kind)
      .map((c) => (
        <button key={c.id} type="button" className="row" style={c.archived ? { opacity: 0.55 } : undefined} onClick={() => setCategory({ id: c.id })} aria-label={`Editar ${c.name}`}>
          <Bullet hue={c.hue} icon={c.icon} size="sm" />
          <span className="row-title">{c.name}</span>
          <span className="flex gap-1.5">
            {c.kind === "expense" ? <Chip>{c.group === "needs" ? "Necesidad" : "Gusto"}</Chip> : null}
            {c.archived ? <Chip>Archivada</Chip> : null}
          </span>
        </button>
      ));

  return (
    <>
      <PageHead title="Ajustes" sub="Apariencia, monedas, categorías y tus datos." />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="grid gap-4">
          <Panel title="Apariencia">
            <div className="grid gap-4">
              <WorldPicker />
              <ModePicker />
            </div>
          </Panel>

          <Panel title="Perfil y monedas">
            <div className="grid gap-4">
              <Field label="Tu nombre" hint="Solo se usa para saludarte en el panel.">
                <input className="input" value={settings.name} maxLength={30} onChange={(e) => update({ name: e.target.value })} />
              </Field>
              <div className="field">
                <span className="label">Moneda principal</span>
                <Segmented<Currency>
                  label="Moneda principal"
                  options={[
                    { value: "CRC", label: "Colones ₡" },
                    { value: "USD", label: "Dólares $" },
                  ]}
                  value={settings.base}
                  onChange={changeBase}
                />
                <span className="hint">
                  En esta moneda se muestran los totales, el presupuesto y los reportes. Al cambiarla se convierten los montos del presupuesto.
                </span>
              </div>
              <Field label="Tipo de cambio" hint="Colones por un dólar. Se usa para convertir las cuentas en la otra moneda.">
                <input
                  className="input num"
                  inputMode="decimal"
                  value={rate}
                  onChange={(e) => {
                    setRate(e.target.value);
                    const v = Number(e.target.value.replace(",", "."));
                    if (v > 0 && v < 100_000) update({ usdRate: v });
                  }}
                />
              </Field>
            </div>
          </Panel>

          <OfflinePanel />

          <Panel title="Tus datos">
            <p className="muted mb-4">
              Todo se guarda en este navegador, sin cuenta ni servidor. Si borras los datos del navegador o cambias de
              dispositivo, se pierden: descarga un respaldo de vez en cuando.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => download(`rumbo-respaldo-${today}.json`, exportJSON(data), "application/json")}>
                <Download aria-hidden="true" />
                Descargar respaldo
              </Button>
              <Button onClick={() => fileRef.current?.click()}>
                <Upload aria-hidden="true" />
                Cargar respaldo
              </Button>
              <Button onClick={() => download(`rumbo-movimientos-${today}.csv`, toCSV(data), "text/csv;charset=utf-8")} disabled={!data.txs.length}>
                Exportar movimientos (CSV)
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importFile(file);
                  e.target.value = "";
                }}
              />
            </div>
            <p className={message?.ok === false ? "error mt-3" : "hint mt-3"} role="status" aria-live="polite">
              {message?.text ?? "Cargar un respaldo reemplaza todo lo que hay ahora."}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule pt-4">
              <ConfirmButton label="Borrar todos mis datos" confirmLabel="Sí, borrar todo" onConfirm={() => useStore.getState().resetAll()} />
              <span className="hint">No se puede deshacer. Volverás a la pantalla de inicio.</span>
            </div>
          </Panel>
        </div>

        <Panel
          title="Categorías"
          action={
            <button type="button" className="linkish" onClick={() => setCategory({})}>
              Nueva categoría
            </button>
          }
        >
          <h3 className="daygroup">Gastos</h3>
          <div className="rows">{list("expense")}</div>
          <h3 className="daygroup">Ingresos</h3>
          <div className="rows">{list("income")}</div>
        </Panel>
      </div>

      <p className="hint mt-6">Atajo: pulsa la tecla N en cualquier pantalla para anotar un movimiento.</p>

      <CategorySheet value={category} onClose={() => setCategory(null)} />
    </>
  );
}
