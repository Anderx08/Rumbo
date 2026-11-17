import type { Metadata, Viewport } from "next";
import { Barlow, Geist, Hind, Open_Sans } from "next/font/google";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});
const openSans = Open_Sans({
  variable: "--font-opensans",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const hind = Hind({
  variable: "--font-hind",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: { default: "Rumbo", template: "%s · Rumbo" },
  description:
    "Finanzas personales con fecha de llegada: gastos, presupuesto, metas, deudas y largo plazo, en colones y dólares.",
  applicationName: "Rumbo",
  appleWebApp: { capable: true, title: "Rumbo", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f4f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0d0f" },
  ],
};

/** Aplica mundo visual y modo antes del primer pintado para evitar parpadeo. */
const themeScript = `(function(){try{var u=JSON.parse(localStorage.getItem("rumbo:ui")||"null")||{};var r=document.documentElement;var w=u.world||"rutas";var m=u.mode||"system";var d=m==="dark"||(m==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);r.setAttribute("data-world",w);r.setAttribute("data-mode",d?"dark":"light")}catch(e){}})()`;

const contract = `<!--
THESIS: cada cifra se lee como posición en una ruta con fecha de llegada; se rechaza la rejilla de tarjetas KPI con dona como única lectura del dinero.
OWN-WORLD: cuatro mundos intercambiables sobre los mismos tokens. Rutas (por defecto): rótulo esmaltado blanco sobre gris andén, líneas de 6px con estaciones circulares y tramo futuro punteado, Barlow. Mosaicos: color plano sobre negro, minúscula ligera gigante. Señalética: bandas amarillas, pictogramas en cuadros negros, cifras monumentales. Clásico: tarjetas fintech.
STORY: abro, veo cuánto me queda este mes, qué pagos vienen y cuándo llego a cada meta; anoto un gasto en segundos.
FIRST VIEWPORT: encabezado con mes y patrimonio; la ruta del mes de lado a lado con HOY y lo disponible; debajo las cuatro líneas (gastos, metas, deudas, largo plazo) con su terminal fechado. Acción primaria Anotar movimiento arriba a la derecha.
FORM: diagrama de líneas de transporte, candidato 7 de 7; seed 30f6399b.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-CR"
      data-world="rutas"
      data-mode="light"
      suppressHydrationWarning
      className={`${barlow.variable} ${openSans.variable} ${hind.variable} ${geist.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <div hidden dangerouslySetInnerHTML={{ __html: contract }} />
        {children}
      </body>
    </html>
  );
}
