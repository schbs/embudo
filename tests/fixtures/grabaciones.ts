// Respuestas reales de Gemini grabadas con `npm run calificar:grabar`, indexadas por un hash del texto del lead.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { RespuestaJson } from "@/ia/gemini";

export const RUTA_GRABACIONES = path.join(import.meta.dirname, "grabaciones-ia.json");

export interface ArchivoGrabaciones {
  modelo: string;
  versionPrompt: string;
  grabadoEl: string;
  respuestas: Record<string, RespuestaJson>;
}

export const claveGrabacion = (textoDelLead: string) => crypto.createHash("sha256").update(textoDelLead).digest("hex").slice(0, 16);

export function cargarGrabaciones(): ArchivoGrabaciones {
  return JSON.parse(fs.readFileSync(RUTA_GRABACIONES, "utf8")) as ArchivoGrabaciones;
}
