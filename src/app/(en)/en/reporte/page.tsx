import type { Metadata } from "next";
import { Reporte } from "@/components/reporte";
import { TEXTOS } from "@/i18n";

// Reads the log on every request (not prerendered).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: TEXTOS.en.reporte.tituloPagina, description: TEXTOS.en.reporte.descripcion, alternates: { languages: { "es-AR": "/reporte" } } };

export default function ReportPage() {
  return <Reporte idioma="en" />;
}
