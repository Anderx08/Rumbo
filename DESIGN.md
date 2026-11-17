# Design

Registro del sistema visual tal como está construido. Fuente de verdad: `src/app/globals.css`.

## Idea

Cada cifra se lee con su consecuencia y su fecha de llegada, y anotar lo que entra o sale toma segundos. Modo Operate: la tarea manda.

## Apariencia

Una sola apariencia, la **Clásica** (decisión del usuario, 16 nov 2026; antes hubo cuatro mundos visuales y se retiraron). Tiene modo claro y oscuro (`data-mode` en `<html>`), que se elige en Ajustes o sigue al sistema.

- Fondo gris claro `#f6f7f9`, tarjetas blancas con radio de 14px, borde `#e2e6eb` y sombra suave.
- Tinta `#0f172a`, texto secundario `#475569`, acento esmeralda `#087f5b` para acciones primarias y el estado activo.
- Tipografía Geist, pesos 400 a 600. Cifras tabulares solo en columnas.
- Radios: 8px (pequeño), 10px (controles), 14px (tarjetas).

## Tokens

- Superficie y tinta: `--bg`, `--panel`, `--panel-2`, `--ink`, `--ink-2`, `--ink-3`, `--rule`, `--rule-strong`.
- Acción: `--accent`, `--accent-ink`, `--focus`.
- Dominios del dinero, un color por línea: `--c-gasto`, `--c-ingreso`, `--c-meta`, `--c-deuda`, `--c-plan`, `--c-cuenta`, `--c-recur`.
- Estado, solo para texto y avisos: `--pos`, `--neg`, `--warn`.
- Categorías: `--k0` a `--k7`. Una categoría guarda un índice (`hue`), no un color.

Un elemento toma su color con `data-tone="meta"` o `data-hue="3"`, que fijan `--tone`.

## Color en gráficos

Las paletas de dominio y de categorías se validaron con el verificador de daltonismo (separación entre vecinos, banda de luminosidad, contraste) en claro y en oscuro. El texto usa tokens de tinta, nunca el color de la serie; leyenda siempre que haya dos series; barras de 24px como máximo con extremo redondeado; líneas de 2px.

## Componentes

- `Stat`: tarjeta con punto de color, etiqueta, cifra y nota.
- `Track`: barra de progreso; `pace` dibuja la marca del día del mes.
- `Bullet`: icono sobre un cuadro redondeado tintado con el color de su categoría o dominio.
- `terminal`: píldora gris con la fecha de llegada al final de una línea.
- `callout`: aviso con acción (por ejemplo, «Hoy toca: Quincena»).
- `Sheet`: hoja lateral de 460px en escritorio; en el celular ocupa toda la pantalla.
- `Segmented` con `wide`: selector grande de ancho completo (tipo de movimiento).

## Reglas

- Dentro de `.sheet-content` ningún bloque se encoge (`flex-shrink: 0`). Sin esto, el selector Gasto/Ingreso, que tiene `overflow` propio, quedaba aplastado en una línea cuando el formulario era más alto que la pantalla.
- Al abrir una hoja, el foco va al primer campo con `preventScroll` y el contenido vuelve arriba.
- Los `@keyframes` van fuera de `@layer components`: dentro, el compilador descarta las reglas que siguen.
- Campos de 16px como mínimo para que iOS no haga zoom.
- Escritorio con barra lateral desde 961px; por debajo, barra inferior con botón central para anotar.
- Movimiento: transiciones de 150 a 260 ms; se respeta `prefers-reduced-motion`.
