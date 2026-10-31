import type { Metadata } from "next";
import { Reporte } from "@/components/reporte";
import { TEXTOS } from "@/i18n";

// Lee el registro en cada pedido (no se prerenderiza).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: TEXTOS.es.reporte.tituloPagina, description: TEXTOS.es.reporte.descripcion, alternates: { languages: { en: "/en/reporte" } } };

export default function PaginaReporte() {
  return <Reporte idioma="es" />;
}
