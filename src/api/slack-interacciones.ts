// POST /api/slack/interacciones: los botones "Tomar lead" y "Descartar" del mensaje de Slack.
// Verifica la firma de Slack sobre el cuerpo crudo, responde 200 enseguida y actualiza el mensaje en segundo plano.
import type { Registro } from "@/pipeline/registro";
import { verificarFirmaSlack } from "@/slack/firma";
import { mensajeResuelto, type Bloque } from "@/slack/mensaje";

interface Interaccion {
  type: string;
  user?: { id: string };
  response_url?: string;
  actions?: { action_id: string; value?: string }[];
  message?: { blocks?: Bloque[]; text?: string };
}

export function crearManejadorInteracciones(opciones: {
  secreto: () => string | undefined;
  registro: () => Registro;
  responder: (url: string, cuerpo: unknown) => Promise<void>;
  enSegundoPlano: (tarea: () => Promise<void>) => void;
  ahora: () => string;
}) {
  return async function POST(req: Request): Promise<Response> {
    const cuerpo = await req.text();
    const secreto = opciones.secreto();
    if (!secreto || !verificarFirmaSlack({ cuerpo, timestamp: req.headers.get("x-slack-request-timestamp"), firma: req.headers.get("x-slack-signature"), secreto })) {
      return new Response("firma inválida", { status: 401 });
    }
    let payload: Interaccion;
    try {
      payload = JSON.parse(new URLSearchParams(cuerpo).get("payload") ?? "");
    } catch {
      return new Response("payload inválido", { status: 400 });
    }
    const accion = payload.actions?.[0];
    if (payload.type !== "block_actions" || !accion || !["tomar_lead", "descartar_lead"].includes(accion.action_id) || !accion.value) return new Response(null, { status: 200 });

    const idAccion = accion.action_id as "tomar_lead" | "descartar_lead";
    const leadId = accion.value;
    const usuario = payload.user?.id ?? "alguien";
    opciones.enSegundoPlano(async () => {
      const resultado = await opciones.registro().marcar(leadId, idAccion === "tomar_lead" ? "tomado" : "descartado", opciones.ahora());
      if (payload.response_url && payload.message?.blocks) {
        // Si otra persona ya lo resolvió, el mensaje queda como estaba. Si el registro no lo tiene (otra instancia en
        // producción), manda el mensaje de Slack: todavía tenía los botones, así que se marca como resuelto.
        const blocks = resultado === "ya_resuelto" ? payload.message.blocks : mensajeResuelto(payload.message.blocks, idAccion, usuario);
        await opciones.responder(payload.response_url, { replace_original: true, text: payload.message.text ?? "Lead", blocks });
      }
    });
    return new Response(null, { status: 200 });
  };
}

