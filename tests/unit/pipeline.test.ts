// El embudo de punta a punta con los 40 leads: CRM en memoria (mismas reglas de unicidad que HubSpot), Slack en
// memoria y respuestas grabadas de Gemini.
import { describe, expect, it } from "vitest";
import { crearCrmMemoria } from "@/crm/memoria";
import { crearModeloGrabado } from "@/ia/gemini";
import { clavesDe } from "@/lead/dedupe";
import { validarLead } from "@/lead/schema";
import { procesarLead, type DepsPipeline } from "@/pipeline/procesar";
import { crearRegistroMemoria } from "@/pipeline/registro";
import { crearAvisadorLocal } from "@/slack/cliente";
import { fixtures } from "../fixtures/cargar";
import { cargarGrabaciones, claveGrabacion } from "../fixtures/grabaciones";

function armar() {
  const crm = crearCrmMemoria();
  const avisador = crearAvisadorLocal();
  const registro = crearRegistroMemoria();
  const deps: DepsPipeline = { crm, avisador, registro, modelo: crearModeloGrabado(cargarGrabaciones().respuestas, claveGrabacion), ahora: () => "2026-11-02T13:00:00.000Z" };
  return { crm, avisador, registro, deps };
}

describe("procesarLead con los 40 fixtures", () => {
  it("no crea duplicados: un contacto por email y una empresa por dominio; el spam no entra al CRM", async () => {
    const { crm, avisador, registro, deps } = armar();
    const resultados = [];
    for (const f of fixtures) resultados.push(await procesarLead(f.lead, deps, { leadId: f.id, recibidoEn: "2026-11-02T13:00:00.000Z" }));

    const noSpam = fixtures.filter((f) => !f.esperado.spam).map((f) => {
      const v = validarLead(f.lead);
      if (!v.ok) throw new Error(f.id);
      return clavesDe(v.lead);
    });
    const emails = new Set(noSpam.map((k) => k.email));
    const dominios = new Set(noSpam.map((k) => k.dominio).filter(Boolean));
    const conteo = await crm.contarDemo();
    expect(conteo.contactos).toBe(emails.size);
    expect(conteo.empresas).toBe(dominios.size);
    expect(conteo.tareas).toBe(noSpam.length);

    // Un deal por contacto A/B: Laura (L01 y L12) tiene uno solo.
    const estado = crm.estado();
    const deals = new Map<string, number>();
    for (const d of estado.deals) deals.set(d.contactoId, (deals.get(d.contactoId) ?? 0) + 1);
    expect([...deals.values()].every((n) => n === 1)).toBe(true);

    // Slack: solo A y B (C va a nutrición sin ruido).
    const ab = resultados.filter((r) => r.ok && r.calificacion.tier !== "C" && !r.fila.spam).length;
    expect(avisador.mensajes).toHaveLength(ab);

    const filas = await registro.leer();
    expect(filas).toHaveLength(40);
    expect(filas.filter((f) => f.duplicado !== "nuevo").map((f) => [f.leadId, f.duplicado])).toEqual([
      ["L12", "email"],
      ["L25", "dominio"],
      ["L40", "email"],
    ]);
    expect(filas.filter((f) => f.spam).every((f) => f.estado === "descartado")).toBe(true);
  });

  it("reenviar los duplicados no crea nada nuevo en el CRM (conteo antes y después)", async () => {
    const { crm, deps } = armar();
    for (const f of fixtures) await procesarLead(f.lead, deps, { leadId: f.id });
    const antes = await crm.contarDemo();
    for (const f of fixtures.filter((x) => x.esperado.duplicado_de)) await procesarLead(f.lead, deps, { leadId: `${f.id}-bis` });
    const despues = await crm.contarDemo();
    expect({ ...despues, tareas: antes.tareas }).toEqual(antes);
    console.log(`  CRM antes ${JSON.stringify(antes)} → después de reenviar 3 duplicados ${JSON.stringify(despues)}`);
  });

  it("un lead inválido no toca nada y devuelve los errores por campo", async () => {
    const { crm, registro, deps } = armar();
    const r = await procesarLead({ email: "no" }, deps);
    expect(r.ok).toBe(false);
    expect(await crm.contarDemo()).toEqual({ contactos: 0, empresas: 0, deals: 0, tareas: 0 });
    expect(await registro.leer()).toEqual([]);
  });

  it("el mensaje de Slack de un lead A trae tier con texto, owner, vencimiento y los dos botones", async () => {
    const { avisador, deps } = armar();
    await procesarLead(fixtures[0].lead, deps, { leadId: "L01", recibidoEn: "2026-11-02T13:00:00.000Z" });
    const m = avisador.mensajes[0];
    expect(m.text).toMatch(/^🟢 Lead tier A \(\d+\/100\): Andina Logística$/);
    const json = JSON.stringify(m.blocks);
    expect(json).toContain("Martín Ojeda");
    expect(json).toContain("lunes 2/11 12:00");
    expect(json).toContain('"action_id":"tomar_lead"');
    expect(json).toContain('"action_id":"descartar_lead"');
  });
});
