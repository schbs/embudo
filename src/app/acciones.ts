"use server";
// Envío del formulario de contacto. Protección: campo trampa, tiempo mínimo de llenado y límite por IP.
// Con N8N_WEBHOOK_URL manda el lead al workflow de n8n (con el token del proyecto); sin n8n, lo procesa acá en segundo
// plano (modo local). La respuesta no espera a la IA ni al CRM: el usuario ve el "recibimos tu consulta" enseguida.
import { after } from "next/server";
import { headers } from "next/headers";
import { validarLead } from "@/lead/schema";
import { dependencias } from "@/pipeline/dependencias";
import { procesarLead } from "@/pipeline/procesar";

export type EstadoFormulario = { estado: "inicial" } | { estado: "ok" } | { estado: "error"; campos: string[] };

const TIEMPO_MINIMO_MS = 3000;
const LIMITE_POR_MINUTO = 5;
const envios = new Map<string, number[]>();

function superaLimite(ip: string, ahora: number): boolean {
  const recientes = (envios.get(ip) ?? []).filter((t) => ahora - t < 60_000);
  recientes.push(ahora);
  envios.set(ip, recientes);
  return recientes.length > LIMITE_POR_MINUTO;
}

export async function enviarLead(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const ahora = Date.now();
  // Bots: completan el campo oculto o envían en menos de 3 s. Se les responde "ok" sin procesar nada.
  if (String(datos.get("web_alternativa") ?? "") !== "") return { estado: "ok" };
  if (ahora - Number(datos.get("t0") ?? 0) < TIEMPO_MINIMO_MS) return { estado: "ok" };

  const entrada = {
    nombre: datos.get("nombre"),
    email: datos.get("email"),
    empresa: datos.get("empresa"),
    sitio: datos.get("sitio") || undefined,
    pais: datos.get("pais"),
    tamano: datos.get("tamano"),
    presupuesto: datos.get("presupuesto"),
    necesidad: datos.get("necesidad"),
    fuente: "web",
    consentimiento: datos.get("consentimiento") === "si",
  };
  const v = validarLead(entrada);
  if (!v.ok) return { estado: "error", campos: Object.keys(v.errores) };

  // x-real-ip la pone Vercel (no la puede inventar el cliente). El límite vive en memoria de cada instancia: frena
  // ráfagas, no un ataque distribuido (para eso haría falta un KV compartido).
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "local";
  if (superaLimite(ip, ahora)) return { estado: "error", campos: ["formulario"] };

  const recibidoEn = new Date(ahora).toISOString();
  const webhook = process.env.N8N_WEBHOOK_URL;
  if (webhook) {
    try {
      const r = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-embudo-token": process.env.N8N_WEBHOOK_TOKEN ?? "" },
        body: JSON.stringify({ ...v.lead, recibidoEn }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!r.ok) throw new Error(`n8n respondió ${r.status}`);
    } catch (e) {
      console.error("[embudo] no se pudo mandar el lead a n8n:", e instanceof Error ? e.message : e);
      return { estado: "error", campos: ["formulario"] };
    }
  } else {
    after(async () => {
      try {
        await procesarLead(v.lead, dependencias(), { recibidoEn });
      } catch (e) {
        console.error("[embudo] falló el procesamiento local:", e instanceof Error ? e.message : e);
      }
    });
  }
  return { estado: "ok" };
}
