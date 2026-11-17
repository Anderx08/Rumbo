# Rumbo

Finanzas personales con fecha de llegada: registra ingresos, gastos y transferencias en colones y dólares, y mira cuánto te queda este mes, cuándo cumples cada meta, cuándo quedas sin deudas y cuánto falta para vivir de tus inversiones.

Los datos se guardan solo en el navegador (localStorage). No hay cuenta ni servidor.

**Publicada en <https://rumbo-orpin-five.vercel.app>** (Vercel, equipo EspTeam). Cada push a `main` despliega una versión nueva.

## Uso

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>. Para probar sin datos propios: <http://localhost:3000/?ejemplo=1>.

Otros comandos:

```bash
npm test          # pruebas del motor financiero
npm run lint
npm run build     # compilación de producción
```

## Instalar y usar sin conexión

La versión de producción registra un service worker (`public/sw.js`) que guarda todas las pantallas. Después de abrirla una vez con conexión, funciona sin red y se puede instalar como app desde el navegador. En Ajustes hay un panel con el estado.

```bash
npm run build
npm start
```

- Solo se activa en producción y en un contexto seguro: `localhost` o un sitio con HTTPS. Para instalarla en el celular hay que publicarla (por ejemplo en Vercel); abrirla por la IP de la red local no basta.
- En `npm run dev` no se registra, y si había uno de una compilación anterior se retira para no servir código viejo.
- Cada dispositivo guarda sus propios datos. Para pasarlos de uno a otro, descarga el respaldo en Ajustes y cárgalo en el otro.
- Si agregas una pantalla nueva, añádela también a `ROUTES` en `public/sw.js` (una prueba lo verifica).

## Módulos

| Ruta | Qué hace |
| --- | --- |
| `/` | Panel: lo que queda del mes, aviso de quincena, próximos pagos, las líneas hacia gastos, metas, deudas y largo plazo, salud financiera |
| `/movimientos` | Registro con búsqueda y filtros. Tecla `N` para anotar desde cualquier pantalla |
| `/presupuesto` | Tope mensual por categoría, ritmo frente al día del mes, regla 50/30/20 |
| `/metas` | Metas de ahorro con aportes y fecha de llegada proyectada |
| `/cuentas` | Cuentas, deudas y patrimonio neto en el tiempo |
| `/deudas` | Plan de pago avalancha o bola de nieve, con pago extra |
| `/recurrentes` | Pagos e ingresos que se repiten, y costo anual de suscripciones |
| `/plan` | Capital objetivo y fecha de independencia financiera |
| `/reportes` | Ingresos, gastos y tasa de ahorro por periodo; exporta CSV |
| `/ajustes` | Mundo visual, modo claro u oscuro, monedas, categorías, respaldo |

## Estructura

- `src/lib/engine.ts`: cálculos puros (saldos, flujo, presupuesto, metas, deudas, proyección). Probados en `engine.test.ts`.
- `src/lib/store.ts`: estado con Zustand, persistido en `localStorage` bajo `rumbo:v1`.
- `src/app/globals.css`: tokens de la apariencia Clásica, con modo claro y oscuro.
- `src/components/`: componentes compartidos; `forms.tsx` tiene los formularios y `hero.tsx` la cabecera del panel.

Los montos se guardan como enteros en unidades menores (céntimos) para evitar errores de redondeo.

Las proyecciones son estimaciones con supuestos editables. No son asesoría financiera.
