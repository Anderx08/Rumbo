# Design

Registro del sistema visual tal como está construido. Fuente de verdad: `src/app/globals.css`.

## Idea

Cada cifra se lee como una posición en una ruta con fecha de llegada. Modo Operate: la tarea manda, la marca vive en los detalles.

## Mundos

Cuatro mundos intercambiables (`data-world` en `<html>`), cada uno con modo claro y oscuro (`data-mode`). Los componentes solo leen tokens; un mundo nuevo se agrega definiendo tokens y, si hace falta, una variante de cabecera en `src/components/hero.tsx`.

| Mundo | Carácter | Tipografía | Radio | Borde de panel |
| --- | --- | --- | --- | --- |
| `rutas` (por defecto) | Diagrama de líneas de transporte: rótulo blanco sobre gris andén, líneas de 6px, estaciones circulares, tramo futuro punteado, cápsula terminal con fecha | Barlow 400 a 800 | 4 / 6 / 8px | 1.5px |
| `mosaicos` | Color plano sobre negro puro, titulares gigantes en minúscula ligera, sin bordes | Open Sans 300 a 700 | 0 | ninguno |
| `senal` | Bandas amarillas de aeropuerto, pictogramas en cuadros negros, cifras monumentales, barra lateral antracita | Hind 400 a 700 | 2px | ninguno |
| `clasico` | Estándar fintech: tarjetas redondeadas con sombra suave, acento esmeralda | Geist | 8 / 10 / 14px | 1px |

## Tokens

- Superficie y tinta: `--bg`, `--panel`, `--panel-2`, `--ink`, `--ink-2`, `--ink-3`, `--rule`, `--rule-strong`.
- Acción: `--accent`, `--accent-ink`, `--focus`.
- Dominios del dinero, un color por línea: `--c-gasto`, `--c-ingreso`, `--c-meta`, `--c-deuda`, `--c-plan`, `--c-cuenta`, `--c-recur`, con su texto `--on-*`.
- Estado, solo para texto y avisos: `--pos`, `--neg`, `--warn`.
- Categorías: `--k0` a `--k7`. Una categoría guarda un índice (`hue`), no un color, así cambia con el mundo.
- Estructura: `--r-sm/md/lg`, `--bw`, `--shadow`, `--w-head`, `--w-strong`, `--head-case`, `--size-page`.
- Barra lateral y banda de página: `--side-*`, `--band-bg`, `--band-ink`.

Un elemento toma su color con `data-tone="meta"` o `data-hue="3"`, que fijan `--tone` y `--on-tone`.

## Color en gráficos

Las paletas de dominio y de categorías se validaron con el verificador de daltonismo (separación entre vecinos, banda de luminosidad, contraste) en claro y en oscuro. Reglas:

- El texto usa tokens de tinta, nunca el color de la serie.
- Leyenda siempre que haya dos series; las barras de categoría llevan su nombre al lado.
- Barras de 24px como máximo, extremo de dato redondeado 4px, base cuadrada; líneas de 2px; rejilla sólida de 1px.
- Cifras tabulares solo en columnas; las cifras grandes usan las proporcionales.

## Componentes

- `Track`: progreso. En Rutas es una línea con estación en el punto de avance y resto punteado; en los demás, barra. `pace` dibuja la marca de referencia del día del mes.
- `Stat`: cifra con etiqueta. En Mosaicos se vuelve mosaico de color.
- `Bullet`: marcador de categoría o sección. Círculo en Rutas, cuadro en Mosaicos y Señalética, pastilla tintada en Clásico.
- `terminal`: cápsula con la fecha de llegada al final de una línea.
- `Sheet`: hoja lateral sobre `<dialog>` (inferior en móvil) para formularios.
- Cabecera del panel por mundo: ruta del mes, mosaicos, banda con decisiones o tarjetas.

## Reglas

- Sin texto en degradado, sin vidrio, sin franjas de color laterales en tarjetas, sin etiquetas pequeñas sobre los títulos.
- Movimiento: un solo momento por mundo (la línea del mes se dibuja al cargar). Transiciones de 150 a 260 ms. Se respeta `prefers-reduced-motion`.
- Los `@keyframes` van fuera de `@layer components`: dentro, el compilador descarta las reglas que siguen.
- Escritorio con barra lateral desde 961px; por debajo, barra inferior con botón central para anotar.
