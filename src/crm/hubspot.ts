// Adaptador de HubSpot (CRM API v3 y asociaciones v4) con un token de Private App.
// Idempotente: busca por email y por dominio antes de crear. Todo lo que crea lleva demo_source=embudo.
// IDs de asociación definidos por HubSpot (confirmados en developers.hubspot.com el día de la prueba real):
// deal→contacto 3, deal→empresa 341, tarea→contacto 204, tarea→deal 216.
import { pedirJson, type OpcionesHttp } from "@/integraciones/http";
import type { Tier } from "@/lead/routing";
import { DEMO_SOURCE, type Crm, type DatosContacto, type DatosDeal, type DatosEmpresa, type DatosTarea, type Upsert } from "./tipos";

const BASE = "https://api.hubapi.com";
const ASOC = { dealContacto: 3, dealEmpresa: 341, tareaContacto: 204, tareaDeal: 216 } as const;
/** Pipeline de deals de la demo y sus etapas (las crea scripts/hubspot-preparar.ts). */
export const PIPELINE = { nombre: "Demo Embudo", etapas: { A: "Tier A", B: "Tier B", C: "Tier C" } as Record<Tier, string> };
export const PREFIJO_TAREA = "Embudo:";

interface Busqueda {
  total: number;
  results: { id: string; properties?: Record<string, string | null> }[];
}

const asociacion = (id: string, tipo: number) => ({ to: { id }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: tipo }] });

export function crearCrmHubspot(token: string, opciones: OpcionesHttp = {}): Crm {
  const pedir = <T>(metodo: string, ruta: string, cuerpo?: unknown) =>
    pedirJson<T>("HubSpot", `${BASE}${ruta}`, { method: metodo, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined }, opciones);

  const buscar = (objeto: string, filtros: { propertyName: string; operator: string; value?: string }[], limite = 1) =>
    pedir<Busqueda>("POST", `/crm/v3/objects/${objeto}/search`, { filterGroups: [{ filters: filtros }], properties: ["hs_object_id"], limit: limite });

  let etapas: Promise<{ pipeline: string; etapas: Record<Tier, string> }> | null = null;
  const etapasDemo = () =>
    (etapas ??= pedir<{ results: { id: string; label: string; stages: { id: string; label: string }[] }[] }>("GET", "/crm/v3/pipelines/deals").then((r) => {
      const p = r.results.find((x) => x.label === PIPELINE.nombre);
      if (!p) throw new Error(`No existe el pipeline "${PIPELINE.nombre}" en HubSpot: correr npm run hubspot:preparar`);
      const id = (tier: Tier) => {
        const s = p.stages.find((x) => x.label === PIPELINE.etapas[tier]);
        if (!s) throw new Error(`Falta la etapa "${PIPELINE.etapas[tier]}" en el pipeline de la demo`);
        return s.id;
      };
      return { pipeline: p.id, etapas: { A: id("A"), B: id("B"), C: id("C") } };
    }));

  return {
    nombre: "HubSpot",

    async upsertContacto(d: DatosContacto): Promise<Upsert> {
      const propiedades = { email: d.email, firstname: d.nombre, lastname: d.apellido, company: d.empresa, country: d.pais, demo_source: DEMO_SOURCE, demo_tier: d.tier, demo_score: String(d.score), demo_owner: d.owner };
      const existente = await buscar("contacts", [{ propertyName: "email", operator: "EQ", value: d.email }]);
      if (existente.results[0]) {
        const id = existente.results[0].id;
        await pedir("PATCH", `/crm/v3/objects/contacts/${id}`, { properties: propiedades });
        return { id, creado: false };
      }
      const nuevo = await pedir<{ id: string }>("POST", "/crm/v3/objects/contacts", { properties: propiedades });
      return { id: nuevo.id, creado: true };
    },

    async upsertEmpresa(d: DatosEmpresa): Promise<Upsert> {
      const existente = await buscar("companies", [{ propertyName: "domain", operator: "EQ", value: d.dominio }]);
      if (existente.results[0]) return { id: existente.results[0].id, creado: false };
      const nueva = await pedir<{ id: string }>("POST", "/crm/v3/objects/companies", { properties: { domain: d.dominio, name: d.nombre, country: d.pais, demo_source: DEMO_SOURCE, demo_tamano: d.tamano } });
      return { id: nueva.id, creado: true };
    },

    async asociarContactoEmpresa(contactoId, empresaId) {
      await pedir("PUT", `/crm/v4/objects/contact/${contactoId}/associations/default/company/${empresaId}`);
    },

    async dealAbiertoDe(contactoId) {
      const r = await buscar("deals", [
        { propertyName: "associations.contact", operator: "EQ", value: contactoId },
        { propertyName: "demo_source", operator: "EQ", value: DEMO_SOURCE },
        { propertyName: "hs_is_closed", operator: "EQ", value: "false" },
      ]);
      return r.results[0]?.id ?? null;
    },

    async crearDeal(d: DatosDeal) {
      const { pipeline, etapas: e } = await etapasDemo();
      const asociaciones = [asociacion(d.contactoId, ASOC.dealContacto), ...(d.empresaId ? [asociacion(d.empresaId, ASOC.dealEmpresa)] : [])];
      const deal = await pedir<{ id: string }>("POST", "/crm/v3/objects/deals", {
        properties: { dealname: d.nombre, pipeline, dealstage: e[d.tier], demo_source: DEMO_SOURCE, demo_tier: d.tier, demo_owner: d.owner, demo_presupuesto: d.presupuesto },
        associations: asociaciones,
      });
      return deal.id;
    },

    async crearTarea(d: DatosTarea) {
      const asociaciones = [asociacion(d.contactoId, ASOC.tareaContacto), ...(d.dealId ? [asociacion(d.dealId, ASOC.tareaDeal)] : [])];
      const tarea = await pedir<{ id: string }>("POST", "/crm/v3/objects/tasks", {
        properties: { hs_task_subject: `${PREFIJO_TAREA} ${d.asunto}`, hs_task_body: d.cuerpo, hs_timestamp: d.venceIso, hs_task_status: "NOT_STARTED", hs_task_priority: d.prioridad, hs_task_type: "TODO" },
        associations: asociaciones,
      });
      return tarea.id;
    },

    async contarDemo() {
      const total = async (objeto: string, filtro: { propertyName: string; operator: string; value?: string }) => (await buscar(objeto, [filtro])).total;
      const demo = { propertyName: "demo_source", operator: "EQ", value: DEMO_SOURCE };
      return {
        contactos: await total("contacts", demo),
        empresas: await total("companies", demo),
        deals: await total("deals", demo),
        tareas: await total("tasks", { propertyName: "hs_task_subject", operator: "CONTAINS_TOKEN", value: "Embudo" }),
      };
    },
  };
}
