// Mensaje de Slack (Block Kit) para cada lead calificado, con los botones "Tomar lead" y "Descartar".
import type { Calificacion } from "@/lead/calificacion";
import type { Lead } from "@/lead/schema";

export type Bloque = Record<string, unknown>;

const EMOJI_TIER = { A: "🟢", B: "🟡", C: "⚪" } as const;
const recortarCrudo = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/** Slack interpreta &, < y > en mrkdwn (menciones como <!channel>, links): todo lo que viene del lead o de la IA se escapa. */
export const escaparMrkdwn = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const recortar = (s: string, max: number) => escaparMrkdwn(recortarCrudo(s, max));

export interface DatosMensaje {
  leadId: string;
  lead: Pick<Lead, "nombre" | "empresa" | "pais" | "tamano" | "presupuesto" | "necesidad">;
  calificacion: Calificacion;
  owner: string;
  venceTexto: string;
  duplicado: "email" | "dominio" | "nuevo";
  hubspotUrl?: string;
}

/** Texto plano (notificaciones y lectores de pantalla) + bloques. El tier va con texto y no solo con color. */
export function mensajeLead(d: DatosMensaje): { text: string; blocks: Bloque[] } {
  const { calificacion: c } = d;
  const titulo = `${EMOJI_TIER[c.tier]} Lead tier ${c.tier} (${c.score}/100): ${d.lead.empresa}`;
  const aviso = d.duplicado === "email" ? "Vuelve a escribir: ya estaba en el CRM." : d.duplicado === "dominio" ? "Empresa que ya estaba en el CRM: contacto nuevo." : "Lead nuevo.";
  const blocks: Bloque[] = [
    { type: "header", text: { type: "plain_text", text: recortarCrudo(titulo, 150), emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: recortar(c.resumen, 3000) } },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Contacto*\n${recortar(d.lead.nombre, 80)}` },
        { type: "mrkdwn", text: `*Owner*\n${escaparMrkdwn(d.owner)}` },
        { type: "mrkdwn", text: `*Tamaño · país*\n${escaparMrkdwn(`${d.lead.tamano} · ${d.lead.pais}`)}` },
        { type: "mrkdwn", text: `*Presupuesto*\n${escaparMrkdwn(d.lead.presupuesto)} USD/mes` },
        { type: "mrkdwn", text: `*Primer contacto antes de*\n${d.venceTexto}` },
        { type: "mrkdwn", text: `*Siguiente paso*\n${recortar(c.siguiente_paso, 200)}` },
      ],
    },
    { type: "context", elements: [{ type: "mrkdwn", text: recortar(`${aviso} Motivos: ${c.motivos.join(" · ")}`, 3000) }] },
    {
      type: "actions",
      block_id: `lead|${d.leadId}`,
      elements: [
        { type: "button", action_id: "tomar_lead", style: "primary", text: { type: "plain_text", text: "Tomar lead" }, value: d.leadId },
        { type: "button", action_id: "descartar_lead", text: { type: "plain_text", text: "Descartar" }, value: d.leadId, confirm: { title: { type: "plain_text", text: "¿Descartar el lead?" }, text: { type: "plain_text", text: "Queda registrado como descartado." }, confirm: { type: "plain_text", text: "Descartar" }, deny: { type: "plain_text", text: "Cancelar" } } },
        ...(d.hubspotUrl ? [{ type: "button", action_id: "abrir_hubspot", text: { type: "plain_text", text: "Ver en HubSpot" }, url: d.hubspotUrl }] : []),
      ],
    },
  ];
  return { text: titulo, blocks };
}

/** Cómo queda el mensaje después de que alguien toca un botón (los botones se reemplazan por quién lo resolvió). */
export function mensajeResuelto(original: Bloque[], accion: "tomar_lead" | "descartar_lead", usuario: string): Bloque[] {
  const texto = accion === "tomar_lead" ? `✅ Lo tomó <@${usuario}>` : `🗑️ Descartado por <@${usuario}>`;
  return [...original.filter((b) => b.type !== "actions"), { type: "context", elements: [{ type: "mrkdwn", text: texto }] }];
}
