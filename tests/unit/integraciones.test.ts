// Adaptadores de HubSpot y Slack contra una API simulada (sin llamadas reales), firma de Slack y endpoints.
import { describe, expect, it } from "vitest";
import { crearManejadorLeads } from "@/api/leads";
import { crearManejadorInteracciones } from "@/api/slack-interacciones";
import { crearCrmHubspot } from "@/crm/hubspot";
import { crearCrmMemoria } from "@/crm/memoria";
import { crearModeloGrabado } from "@/ia/gemini";
import { ErrorApi, pedirJson } from "@/integraciones/http";
import { crearRegistroMemoria } from "@/pipeline/registro";
import { crearAvisadorLocal, crearAvisadorSlack } from "@/slack/cliente";
import { firmarSlack, verificarFirmaSlack } from "@/slack/firma";
import { escaparMrkdwn, mensajeLead, mensajeResuelto } from "@/slack/mensaje";
import { fixtures } from "../fixtures/cargar";
import { cargarGrabaciones, claveGrabacion } from "../fixtures/grabaciones";

type Llamada = { metodo: string; url: string; cuerpo?: unknown };
const sinEspera = { esperar: async () => {} };

/** fetch falso: cada respuesta es una función de la llamada (o un Response fijo). */
function apiFalsa(respuestas: ((l: Llamada) => Response)[]) {
  const llamadas: Llamada[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    const l = { metodo: init?.method ?? "GET", url, cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined };
    llamadas.push(l);
    const r = respuestas[llamadas.length - 1];
    if (!r) throw new Error(`llamada de más: ${l.metodo} ${url}`);
    return r(l);
  }) as typeof fetch;
  return { f, llamadas };
}
const json = (cuerpo: unknown, status = 200, headers: Record<string, string> = {}) => () => new Response(JSON.stringify(cuerpo), { status, headers });

describe("pedirJson (errores tipados y reintentos)", () => {
  it("429 con Retry-After: espera y reintenta", async () => {
    const esperas: number[] = [];
    const api = apiFalsa([json({}, 429, { "retry-after": "2" }), json({ ok: 1 })]);
    const r = await pedirJson("X", "https://x.example.com", {}, { fetch: api.f, esperar: async (ms) => void esperas.push(ms) });
    expect(r).toEqual({ ok: 1 });
    expect(esperas).toEqual([2000]);
  });

  it("401 no se reintenta y avisa de token o scopes", async () => {
    const api = apiFalsa([json({ message: "no" }, 401)]);
    await expect(pedirJson("HubSpot", "https://x.example.com", {}, { fetch: api.f, ...sinEspera })).rejects.toMatchObject({ tipo: "auth", status: 401 });
    expect(api.llamadas).toHaveLength(1);
  });

  it("503 y error de red se reintentan; un 400 de negocio no", async () => {
    const api = apiFalsa([() => new Response("", { status: 503 }), () => { throw new TypeError("fetch failed"); }, json({ ok: 2 })]);
    expect(await pedirJson("X", "https://x.example.com", {}, { fetch: api.f, ...sinEspera })).toEqual({ ok: 2 });
    const api2 = apiFalsa([json({ message: "Property values were not valid" }, 400)]);
    await expect(pedirJson("X", "https://x.example.com", {}, { fetch: api2.f, ...sinEspera })).rejects.toBeInstanceOf(ErrorApi);
    expect(api2.llamadas).toHaveLength(1);
  });
});

describe("adaptador de HubSpot (API simulada)", () => {
  const datos = { email: "laura.gomez@andina-logistica.example.com", nombre: "Laura", apellido: "Gómez", empresa: "Andina Logística", pais: "AR", tier: "A" as const, score: 90, owner: "Martín Ojeda" };

  it("contacto nuevo: busca por email y, si no está, lo crea con demo_source", async () => {
    const api = apiFalsa([json({ total: 0, results: [] }), json({ id: "101" }, 201)]);
    const r = await crearCrmHubspot("tok", { fetch: api.f, ...sinEspera }).upsertContacto(datos);
    expect(r).toEqual({ id: "101", creado: true });
    expect(api.llamadas[0]).toMatchObject({ metodo: "POST", url: "https://api.hubapi.com/crm/v3/objects/contacts/search", cuerpo: { filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: datos.email }] }] } });
    expect(api.llamadas[1]).toMatchObject({ metodo: "POST", url: "https://api.hubapi.com/crm/v3/objects/contacts", cuerpo: { properties: { email: datos.email, demo_source: "embudo", demo_tier: "A" } } });
  });

  it("contacto que ya existe: lo actualiza (PATCH), no crea otro", async () => {
    const api = apiFalsa([json({ total: 1, results: [{ id: "101" }] }), json({ id: "101" })]);
    const r = await crearCrmHubspot("tok", { fetch: api.f, ...sinEspera }).upsertContacto(datos);
    expect(r).toEqual({ id: "101", creado: false });
    expect(api.llamadas.map((l) => l.metodo)).toEqual(["POST", "PATCH"]);
  });

  it("deal en el pipeline de la demo, con la etapa del tier y asociado a contacto y empresa", async () => {
    const pipelines = { results: [{ id: "p9", label: "Demo Embudo", stages: [{ id: "sA", label: "Tier A" }, { id: "sB", label: "Tier B" }, { id: "sC", label: "Tier C" }] }] };
    const api = apiFalsa([json(pipelines), json({ id: "d1" }, 201)]);
    const id = await crearCrmHubspot("tok", { fetch: api.f, ...sinEspera }).crearDeal({ nombre: "Andina", tier: "B", presupuesto: "3k-10k", owner: "Martín", contactoId: "101", empresaId: "202" });
    expect(id).toBe("d1");
    expect(api.llamadas[1].cuerpo).toMatchObject({
      properties: { pipeline: "p9", dealstage: "sB", demo_source: "embudo" },
      associations: [{ to: { id: "101" }, types: [{ associationTypeId: 3 }] }, { to: { id: "202" }, types: [{ associationTypeId: 341 }] }],
    });
  });

  it("sin el pipeline de la demo, explica qué correr", async () => {
    const api = apiFalsa([json({ results: [] })]);
    await expect(crearCrmHubspot("tok", { fetch: api.f, ...sinEspera }).crearDeal({ nombre: "x", tier: "A", presupuesto: "10k+", owner: "y", contactoId: "1" })).rejects.toThrow(/hubspot:preparar/);
  });

  it("la tarea lleva el prefijo de la demo, el vencimiento y la prioridad", async () => {
    const api = apiFalsa([json({ id: "t1" }, 201)]);
    await crearCrmHubspot("tok", { fetch: api.f, ...sinEspera }).crearTarea({ asunto: "Primer contacto", cuerpo: "c", venceIso: "2026-11-02T15:00:00.000Z", prioridad: "HIGH", contactoId: "101", dealId: "d1" });
    expect(api.llamadas[0].cuerpo).toMatchObject({ properties: { hs_task_subject: "Embudo: Primer contacto", hs_timestamp: "2026-11-02T15:00:00.000Z", hs_task_priority: "HIGH" }, associations: [{ types: [{ associationTypeId: 204 }] }, { types: [{ associationTypeId: 216 }] }] });
  });
});

describe("Slack", () => {
  it("firma v0: válida, alterada y vieja", () => {
    const cuerpo = "payload=%7B%7D";
    const ts = "1793400000";
    const firma = firmarSlack(cuerpo, ts, "secreto");
    expect(verificarFirmaSlack({ cuerpo, timestamp: ts, firma, secreto: "secreto", ahoraSegundos: 1793400060 })).toBe(true);
    expect(verificarFirmaSlack({ cuerpo: cuerpo + "x", timestamp: ts, firma, secreto: "secreto", ahoraSegundos: 1793400060 })).toBe(false);
    expect(verificarFirmaSlack({ cuerpo, timestamp: ts, firma, secreto: "otro", ahoraSegundos: 1793400060 })).toBe(false);
    expect(verificarFirmaSlack({ cuerpo, timestamp: ts, firma, secreto: "secreto", ahoraSegundos: 1793400000 + 301 })).toBe(false);
  });

  it("chat.postMessage: {ok:false} de Slack se convierte en error", async () => {
    const api = apiFalsa([json({ ok: false, error: "channel_not_found" })]);
    await expect(crearAvisadorSlack({ token: "x", canal: "C1", http: { fetch: api.f, ...sinEspera } }).publicar({ text: "t", blocks: [] })).rejects.toThrow("channel_not_found");
  });

  it("lo que escribe el lead (o la IA) no puede meter menciones ni links en Slack", () => {
    const m = mensajeLead({
      leadId: "x",
      lead: { nombre: "<!channel> Hola", empresa: "ACME", pais: "AR", tamano: "1-10", presupuesto: "<1k", necesidad: "n" },
      calificacion: { score: 50, tier: "B", motivos: ["<https://malo.example.com|clic> & más"], siguiente_paso: "<@U1> llamar", resumen: "<!here> resumen" },
      owner: "Martín",
      venceTexto: "lunes",
      duplicado: "nuevo",
    });
    const json = JSON.stringify(m.blocks);
    expect(json).not.toMatch(/<!channel>|<!here>|<@U1>|<https:/);
    expect(json).toContain("&lt;!channel&gt; Hola");
    expect(escaparMrkdwn("a & <b>")).toBe("a &amp; &lt;b&gt;");
  });

  it("el error de una API no incluye el detalle del proveedor (puede traer datos del lead)", async () => {
    const api = apiFalsa([json({ message: "Property values were not valid: email ana@x.example.com" }, 400)]);
    const e = (await pedirJson("HubSpot", "https://x.example.com", {}, { fetch: api.f, ...sinEspera }).catch((x: unknown) => x)) as ErrorApi;
    expect(e.message).toBe("HubSpot: respondió 400");
    expect(e.detalle).toContain("ana@x.example.com");
  });

  it("al resolver, los botones se reemplazan por quién lo tomó", () => {
    const b = mensajeResuelto([{ type: "header" }, { type: "actions" }], "tomar_lead", "U123");
    expect(b).toEqual([{ type: "header" }, { type: "context", elements: [{ type: "mrkdwn", text: "✅ Lo tomó <@U123>" }] }]);
  });
});

describe("endpoints", () => {
  const deps = () => ({ crm: crearCrmMemoria(), avisador: crearAvisadorLocal(), registro: crearRegistroMemoria(), modelo: crearModeloGrabado(cargarGrabaciones().respuestas, claveGrabacion), ahora: () => "2026-11-02T13:00:00.000Z" });
  const POST = crearManejadorLeads({ token: () => "token-de-prueba", deps });
  const pedido = (cuerpo: unknown, token?: string) => new Request("http://x/api/leads", { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {}, body: JSON.stringify(cuerpo) });

  it("/api/leads: 401 sin token o con token incorrecto", async () => {
    expect((await POST(pedido(fixtures[0].lead))).status).toBe(401);
    expect((await POST(pedido(fixtures[0].lead, "otro"))).status).toBe(401);
  });

  it("/api/leads: 200 con la fila del registro; 400 con errores por campo", async () => {
    const ok = await POST(pedido({ ...fixtures[0].lead, leadId: "L01" }, "token-de-prueba"));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true, leadId: "L01", fila: { tier: "A", owner: "Martín Ojeda" } });
    const mal = await POST(pedido({ email: "x" }, "token-de-prueba"));
    expect(mal.status).toBe(400);
    expect((await mal.json()).errores.email).toBe("Revisá el email.");
  });

  it("/api/slack/interacciones: firma inválida → 401; botón válido → 200 y el lead queda tomado", async () => {
    const registro = crearRegistroMemoria();
    await registro.agregar({ leadId: "L01", estado: "nuevo" } as never);
    const respuestas: unknown[] = [];
    const tareas: Promise<void>[] = [];
    const manejar = crearManejadorInteracciones({ secreto: () => "s", registro: () => registro, responder: async (_u, c) => void respuestas.push(c), enSegundoPlano: (t) => void tareas.push(t()), ahora: () => "2026-11-02T14:00:00.000Z" });
    const payload = { type: "block_actions", user: { id: "U9" }, response_url: "https://hooks.slack.example.com/r", actions: [{ action_id: "tomar_lead", value: "L01" }], message: { text: "Lead", blocks: [{ type: "actions" }] } };
    const cuerpo = `payload=${encodeURIComponent(JSON.stringify(payload))}`;
    const ts = String(Math.floor(Date.now() / 1000));

    const malo = await manejar(new Request("http://x", { method: "POST", body: cuerpo, headers: { "x-slack-request-timestamp": ts, "x-slack-signature": "v0=mal" } }));
    expect(malo.status).toBe(401);

    const bueno = await manejar(new Request("http://x", { method: "POST", body: cuerpo, headers: { "x-slack-request-timestamp": ts, "x-slack-signature": firmarSlack(cuerpo, ts, "s") } }));
    expect(bueno.status).toBe(200);
    await Promise.all(tareas);
    expect((await registro.leer())[0]).toMatchObject({ estado: "tomado", resueltoEn: "2026-11-02T14:00:00.000Z" });
    expect(respuestas[0]).toMatchObject({ replace_original: true, blocks: [{ type: "context" }] });
  });

  it("/api/slack/interacciones: sin el lead en el registro (otra instancia de Vercel) igual resuelve el mensaje; si ya estaba resuelto, no lo cambia", async () => {
    const registro = crearRegistroMemoria();
    const respuestas: unknown[] = [];
    const tareas: Promise<void>[] = [];
    const manejar = crearManejadorInteracciones({ secreto: () => "s", registro: () => registro, responder: async (_u, c) => void respuestas.push(c), enSegundoPlano: (t) => void tareas.push(t()), ahora: () => "2026-11-02T14:00:00.000Z" });
    const enviar = async (leadId: string) => {
      const payload = { type: "block_actions", user: { id: "U9" }, response_url: "https://hooks.slack.example.com/r", actions: [{ action_id: "descartar_lead", value: leadId }], message: { text: "Lead", blocks: [{ type: "actions" }] } };
      const cuerpo = `payload=${encodeURIComponent(JSON.stringify(payload))}`;
      const ts = String(Math.floor(Date.now() / 1000));
      expect((await manejar(new Request("http://x", { method: "POST", body: cuerpo, headers: { "x-slack-request-timestamp": ts, "x-slack-signature": firmarSlack(cuerpo, ts, "s") } }))).status).toBe(200);
      await Promise.all(tareas);
    };

    await enviar("L99");
    expect(respuestas[0]).toMatchObject({ blocks: [{ type: "context" }] });

    await registro.agregar({ leadId: "L02", estado: "tomado" } as never);
    await enviar("L02");
    expect(respuestas[1]).toMatchObject({ blocks: [{ type: "actions" }] });
  });
});
