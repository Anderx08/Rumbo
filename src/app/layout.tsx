import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Rumbo", template: "%s · Rumbo" },
  description:
    "Finanzas personales con fecha de llegada: gastos, quincenas, presupuesto, metas, deudas y largo plazo, en colones y dólares.",
  applicationName: "Rumbo",
  appleWebApp: { capable: true, title: "Rumbo", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // En Android el teclado achica la página, así el botón Guardar queda visible.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f14" },
  ],
};

/** Aplica el modo claro u oscuro antes del primer pintado para evitar parpadeo. */
const themeScript = `(function(){try{var u=JSON.parse(localStorage.getItem("rumbo:ui")||"null")||{};var m=u.mode||"system";var d=m==="dark"||(m==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-mode",d?"dark":"light")}catch(e){}})()`;

const contract = `<!--
THESIS: cada cifra se lee con su consecuencia y su fecha de llegada; anotar lo que entra y sale toma segundos, sin elegir cuentas.
OWN-WORLD: apariencia Clásica única (decisión del usuario): tarjetas blancas redondeadas sobre gris claro, acento esmeralda, Geist, un color por dominio del dinero.
STORY: abro, veo cuánto me queda este mes y qué pagos vienen; registro la quincena y los gastos con un toque.
FIRST VIEWPORT: encabezado con mes, patrimonio y las acciones Registrar ingreso y Anotar gasto; aviso de quincena cuando toca; cuatro indicadores y las líneas hacia metas, deudas y largo plazo.
FORM: estándar fintech (canon elegido por el usuario); seed 30f6399b.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CR" data-mode="light" suppressHydrationWarning className={`${geist.variable} h-full antialiased`}>
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
