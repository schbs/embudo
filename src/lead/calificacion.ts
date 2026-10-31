// Salida estructurada de la IA (Gemini con JSON schema). El tier tiene que corresponder al score: si el modelo los
// contradice, se corrige con el score (la regla fija manda sobre el modelo).
import { z } from "zod";
import { tierDeScore } from "./routing";

export const calificacionSchema = z.object({
  score: z.number().int().min(0).max(100),
  tier: z.enum(["A", "B", "C"]),
  motivos: z.array(z.string().trim().min(3).max(160)).min(1).max(4),
  siguiente_paso: z.string().trim().min(5).max(200),
  resumen: z.string().trim().min(10).max(280),
});

export type Calificacion = z.infer<typeof calificacionSchema>;

/** JSON schema para el `responseSchema` de Gemini (structured output). */
export const calificacionJsonSchema = z.toJSONSchema(calificacionSchema);

export type ResultadoCalificacion = { ok: true; calificacion: Calificacion; tierCorregido: boolean } | { ok: false; error: string };

/** Valida la respuesta del modelo y alinea el tier con el score. */
export function interpretarCalificacion(respuesta: unknown): ResultadoCalificacion {
  const r = calificacionSchema.safeParse(respuesta);
  if (!r.success) return { ok: false, error: r.error.issues.map((i) => `${i.path.join(".") || "respuesta"}: ${i.message}`).join("; ") };
  const tier = tierDeScore(r.data.score);
  return { ok: true, calificacion: { ...r.data, tier }, tierCorregido: tier !== r.data.tier };
}
