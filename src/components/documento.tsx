// Documento HTML de los dos layouts raíz (español e inglés): fuentes de la dirección A, colores y lang.
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import { TEXTOS, type Idioma } from "@/i18n";
import "../app/globals.css";

const titulo = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], weight: ["500", "700"], display: "swap" });
const texto = IBM_Plex_Sans({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "600"], display: "swap" });

// Solo el color de la barra del navegador: el zoom nunca se bloquea.
export const viewport: Viewport = { themeColor: "#f5f6f2" };

export const metadataDe = (idioma: Idioma): Metadata => ({
  metadataBase: new URL("http://localhost:3202"),
  title: { default: TEXTOS[idioma].landing.tituloPagina, template: `%s · ${TEXTOS[idioma].marca}` },
  description: TEXTOS[idioma].landing.descripcion,
});

export function Documento({ idioma, children }: Readonly<{ idioma: Idioma; children: React.ReactNode }>) {
  return (
    <html lang={idioma === "en" ? "en" : "es-AR"} className={`${titulo.variable} ${texto.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-fondo font-sans text-tinta">{children}</body>
    </html>
  );
}
