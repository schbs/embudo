// Recorrido completo de un lead: validar → spam o IA → owner y SLA → CRM sin duplicados → Slack → registro.
// Lo llama /api/leads (desde n8n o el formulario) y scripts/run-fixtures.ts. Cada paso usa puertos: en los tests y en
// modo local son adaptadores en memoria o en archivo; con las cuentas, HubSpot y Slack de verdad.
import { DateTime } from "luxon";
import { ZONA_AGENCIA } from "@/config/agencia";
import type { Crm } from "@/crm/tipos";
import { calificarLead } from "@/ia/calificador";
import type { ModeloJson } from "@/ia/gemini";
import type { Calificacion } from "@/lead/calificacion";
import { clavesDe } from "@/lead/dedupe";
import { asignarOwner, vencimientoSeguimiento } from "@/lead/routing";
import { validarLead } from "@/lead/schema";
import type { Avisador } from "@/slack/cliente";
import { mensajeLead } from "@/slack/mensaje";
import type { FilaRegistro, Registro } from "./registro";

export interface DepsPipeline {
  crm: Crm;
  avisador: Avisador;
  modelo: ModeloJson;
  registro: Registro;
  ahora: () => string;
}

export type ResultadoLead =
  | { ok: false; errores: Record<string, string> }
  | {
      ok: true;
      leadId: string;
      calificacion: Calificacion;
      fila: FilaRegistro;
      crm: { contactoId?: string; contactoNuevo?: boolean; empresaId?: string; empresaNueva?: boolean; dealId?: string; tareaId?: string };
      slack: boolean;
    };

const partirNombre = (nombre: string) => {
  const [primero, ...resto] = nombre.split(" ");
  return { nombre: primero, apellido: resto.join(" ") };
};

export async function procesarLead(entrada: unknown, deps: DepsPipeline, opciones: { leadId?: string; recibidoEn?: string } = {}): Promise<ResultadoLead> {
  const t0 = Date.now();
  const v = validarLead(entrada);
  if (!v.ok) return { ok: false, errores: v.errores };
  const lead = v.lead;
  const recibidoEn = opciones.recibidoEn ?? deps.ahora();
  const leadId = opciones.leadId ?? `lead-${DateTime.fromISO(recibidoEn).toFormat("yyyyLLdd-HHmmss")}-${Math.random().toString(36).slice(2, 6)}`;

  const r = await calificarLead(lead, deps.modelo);
  const c = r.calificacion;
  const owner = asignarOwner(lead);
  const venceEn = vencimientoSeguimiento(recibidoEn, c.tier);
  const claves = clavesDe(lead);
  const crm: Extract<ResultadoLead, { ok: true }>["crm"] = {};
  let duplicado: FilaRegistro["duplicado"] = "nuevo";
  let slack = false;

  // El spam no entra al CRM ni a Slack: queda solo en el registro, con el motivo.
  if (!r.spam && claves.email) {
    const contacto = await deps.crm.upsertContacto({ email: claves.email, ...partirNombre(lead.nombre), empresa: lead.empresa, pais: lead.pais, tier: c.tier, score: c.score, owner: owner.nombre });
    crm.contactoId = contacto.id;
    crm.contactoNuevo = contacto.creado;
    if (!contacto.creado) duplicado = "email";
    if (claves.dominio) {
      const empresa = await deps.crm.upsertEmpresa({ dominio: claves.dominio, nombre: lead.empresa, pais: lead.pais, tamano: lead.tamano });
      crm.empresaId = empresa.id;
      crm.empresaNueva = empresa.creado;
      if (contacto.creado && !empresa.creado) duplicado = "dominio";
      await deps.crm.asociarContactoEmpresa(contacto.id, empresa.id);
    }

    // A y B tienen deal (uno por contacto: si vuelve a escribir, se reusa el abierto). C queda en nutrición, sin deal.
    if (c.tier !== "C") {
      crm.dealId = (await deps.crm.dealAbiertoDe(contacto.id)) ?? (await deps.crm.crearDeal({ nombre: `${lead.empresa} · ${lead.necesidad.slice(0, 60)}`, tier: c.tier, presupuesto: lead.presupuesto, owner: owner.nombre, contactoId: contacto.id, empresaId: crm.empresaId }));
    }
    crm.tareaId = await deps.crm.crearTarea({
      asunto: duplicado === "email" ? `${lead.nombre} volvió a escribir (tier ${c.tier})` : `Primer contacto con ${lead.nombre} (tier ${c.tier})`,
      cuerpo: `${c.resumen}\n\nSiguiente paso: ${c.siguiente_paso}\nMotivos: ${c.motivos.join("; ")}\nOwner: ${owner.nombre}`,
      venceIso: venceEn,
      prioridad: c.tier === "A" ? "HIGH" : c.tier === "B" ? "MEDIUM" : "LOW",
      contactoId: contacto.id,
      dealId: crm.dealId,
    });

    if (c.tier !== "C") {
      const venceTexto = DateTime.fromISO(venceEn).setZone(ZONA_AGENCIA).setLocale("es-AR").toFormat("cccc d/M HH:mm");
      await deps.avisador.publicar(mensajeLead({ leadId, lead, calificacion: c, owner: owner.nombre, venceTexto, duplicado }));
      slack = true;
    }
  }

  const fila: FilaRegistro = {
    leadId,
    recibidoEn,
    procesadoEn: deps.ahora(),
    empresa: lead.empresa,
    pais: lead.pais,
    tamano: lead.tamano,
    presupuesto: lead.presupuesto,
    fuente: lead.fuente,
    tier: c.tier,
    score: c.score,
    origen: r.origen,
    spam: r.spam,
    duplicado,
    owner: owner.nombre,
    venceEn,
    msTotal: Date.now() - t0,
    estado: r.spam ? "descartado" : "nuevo",
  };
  await deps.registro.agregar(fila);
  return { ok: true, leadId, calificacion: c, fila, crm, slack };
}
