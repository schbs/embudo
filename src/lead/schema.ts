// Contrato de datos del lead que llega del formulario (y de cualquier otra fuente). Todo pasa por acá antes de n8n.
import { z } from "zod";
import { FUENTES, PRESUPUESTOS, TAMANOS } from "@/config/agencia";

const textoLimpio = (min: number, max: number, mensaje: string) =>
  z
    .string(mensaje)
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(min, mensaje).max(max, `Máximo ${max} caracteres.`));

export const leadSchema = z.object({
  nombre: textoLimpio(2, 80, "Escribí tu nombre."),
  email: z
    .string("Escribí tu email.")
    .trim()
    .toLowerCase()
    .pipe(z.email("Revisá el email.")),
  empresa: textoLimpio(2, 120, "Escribí el nombre de la empresa."),
  /** Sitio web de la empresa; opcional (hay consultas de empresas sin sitio). */
  sitio: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((s) => (s ? s : undefined)),
  /** ISO 3166-1 alfa-2 ("AR", "US"). */
  pais: z
    .string("Elegí el país.")
    .trim()
    .toUpperCase()
    .pipe(z.string().regex(/^[A-Z]{2}$/, "Elegí el país.")),
  tamano: z.enum(TAMANOS, "Elegí el tamaño de la empresa."),
  presupuesto: z.enum(PRESUPUESTOS, "Elegí un rango de presupuesto."),
  necesidad: textoLimpio(10, 1000, "Contanos qué necesitás (al menos 10 caracteres)."),
  fuente: z.enum(FUENTES).default("web"),
  consentimiento: z.literal(true, "Necesitamos tu consentimiento para contactarte."),
});

/** Lo que llega (antes de validar). */
export type LeadEntrada = z.input<typeof leadSchema>;
/** El lead ya validado y limpio. */
export type Lead = z.output<typeof leadSchema>;

export type ResultadoValidacion = { ok: true; lead: Lead } | { ok: false; errores: Record<string, string> };

/** Valida un lead y devuelve los errores por campo (para mostrarlos junto a cada campo del formulario). */
export function validarLead(datos: unknown): ResultadoValidacion {
  const r = leadSchema.safeParse(datos);
  if (r.success) return { ok: true, lead: r.data };
  const errores: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const campo = String(issue.path[0] ?? "formulario");
    errores[campo] ??= issue.message;
  }
  return { ok: false, errores };
}
