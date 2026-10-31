// POST /api/leads: procesa un lead de punta a punta. Lo llama el workflow de n8n (con el token del proyecto).
// 200 con la fila del registro (n8n la agrega a Google Sheets) · 400 con los errores por campo · 401 sin token válido.
import { procesarLead, type DepsPipeline } from "@/pipeline/procesar";
import { tokenDelPedido, tokenValido } from "@/pipeline/token";

export function crearManejadorLeads(opciones: { token: () => string | undefined; deps: () => DepsPipeline }) {
  return async function POST(req: Request): Promise<Response> {
    if (!tokenValido(tokenDelPedido(req.headers), opciones.token())) return Response.json({ ok: false, error: "no autorizado" }, { status: 401 });
    let cuerpo: unknown;
    try {
      cuerpo = await req.json();
    } catch {
      return Response.json({ ok: false, error: "JSON inválido" }, { status: 400 });
    }
    const { leadId, recibidoEn, ...lead } = (cuerpo ?? {}) as { leadId?: string; recibidoEn?: string };
    try {
      const r = await procesarLead(lead, opciones.deps(), { leadId, recibidoEn });
      return Response.json(r, { status: r.ok ? 200 : 400 });
    } catch (e) {
      // Falla de HubSpot o Slack: 502 para que n8n reintente o mande al Error Workflow. Sin datos del lead en el log.
      console.error("[embudo] no se pudo procesar el lead:", e instanceof Error ? e.message : e);
      return Response.json({ ok: false, error: "falla al procesar el lead" }, { status: 502 });
    }
  };
}

