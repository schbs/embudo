// Califica un lead: el spam obvio se resuelve con reglas (sin gastar IA); el resto va a Gemini con salida estructurada.
// Si el modelo falla, el lead no se pierde: queda en tier B "a revisar" para que lo mire una persona.
import { calificacionJsonSchema, interpretarCalificacion, type Calificacion } from "@/lead/calificacion";
import type { Lead } from "@/lead/schema";
import { detectarSpam } from "@/lead/spam";
import type { ModeloJson, Uso } from "./gemini";
import { SISTEMA, textoDelLead } from "./prompt";

export type Origen = "reglas" | "ia" | "respaldo";

export interface ResultadoCalificador {
  calificacion: Calificacion;
  origen: Origen;
  spam: boolean;
  tierCorregido: boolean;
  uso: Uso;
  ms: number;
  error?: string;
}

export async function calificarLead(lead: Lead, modelo: ModeloJson): Promise<ResultadoCalificador> {
  const t0 = Date.now();
  const spam = detectarSpam(lead);
  if (spam.spam) {
    return {
      calificacion: { score: 0, tier: "C", motivos: spam.motivos.map((m) => `Spam: ${m}`), siguiente_paso: "Descartar sin responder.", resumen: `Descartado por reglas (${spam.motivos.join(", ")}).` },
      origen: "reglas",
      spam: true,
      tierCorregido: false,
      uso: { entrada: 0, salida: 0 },
      ms: Date.now() - t0,
    };
  }
  try {
    const r = await modelo.generar({ sistema: SISTEMA, usuario: textoDelLead(lead), schema: calificacionJsonSchema as Record<string, unknown> });
    const interpretada = interpretarCalificacion(r.json);
    if (!interpretada.ok) throw new Error(`Respuesta fuera del contrato: ${interpretada.error}`);
    return { calificacion: interpretada.calificacion, origen: "ia", spam: false, tierCorregido: interpretada.tierCorregido, uso: r.uso, ms: Date.now() - t0 };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return {
      calificacion: { score: 50, tier: "B", motivos: ["La IA no pudo calificarlo: revisar a mano"], siguiente_paso: "Revisar el lead y calificarlo a mano.", resumen: "Lead sin calificar por una falla técnica; queda para revisión." },
      origen: "respaldo",
      spam: false,
      tierCorregido: false,
      uso: { entrada: 0, salida: 0 },
      ms: Date.now() - t0,
      error,
    };
  }
}
