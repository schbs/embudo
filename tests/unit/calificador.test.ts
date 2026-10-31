import { describe, expect, it } from "vitest";
import { calificarLead } from "@/ia/calificador";
import { CupoAgotado, crearModeloGemini, crearModeloGrabado, esperaBackoff, segundosDeEspera, type ModeloJson } from "@/ia/gemini";
import { textoDelLead } from "@/ia/prompt";
import { validarLead, type Lead } from "@/lead/schema";
import { fixtures } from "../fixtures/cargar";
import { cargarGrabaciones, claveGrabacion } from "../fixtures/grabaciones";

const lead = (i: number): Lead => {
  const v = validarLead(fixtures[i].lead);
  if (!v.ok) throw new Error("fixture inválido");
  return v.lead;
};

describe("calificador con las respuestas grabadas de Gemini (40 leads)", () => {
  const grabaciones = cargarGrabaciones();
  const modelo = crearModeloGrabado(grabaciones.respuestas, claveGrabacion);

  it("precisión de tier ≥ 85 % y ninguna respuesta fuera del contrato", async () => {
    let aciertos = 0;
    for (const [i, f] of fixtures.entries()) {
      const r = await calificarLead(lead(i), modelo);
      expect(r.origen).not.toBe("respaldo");
      if (r.calificacion.tier === f.esperado.tier) aciertos++;
    }
    console.log(`  precisión con ${grabaciones.modelo} (prompt ${grabaciones.versionPrompt}): ${aciertos}/40`);
    expect(aciertos / fixtures.length).toBeGreaterThanOrEqual(0.85);
  });

  it("el spam se resuelve con reglas, sin llamar al modelo", async () => {
    const espia: ModeloJson = { nombre: "espía", generar: async () => { throw new Error("no debía llamarse"); } };
    const spam = fixtures.findIndex((f) => f.esperado.spam);
    const r = await calificarLead(lead(spam), espia);
    expect(r).toMatchObject({ origen: "reglas", spam: true, calificacion: { tier: "C", score: 0 } });
  });

  it("si el modelo falla, el lead queda en B para revisar a mano (no se pierde)", async () => {
    const roto: ModeloJson = { nombre: "roto", generar: async () => { throw new Error("caído"); } };
    const r = await calificarLead(lead(0), roto);
    expect(r).toMatchObject({ origen: "respaldo", calificacion: { tier: "B" }, error: "caído" });
  });

  it("si el modelo contesta fuera del contrato, también va al respaldo", async () => {
    const raro: ModeloJson = { nombre: "raro", generar: async () => ({ json: { score: "alto" }, uso: { entrada: 0, salida: 0 } }) };
    const r = await calificarLead(lead(0), raro);
    expect(r.origen).toBe("respaldo");
    expect(r.error).toMatch(/fuera del contrato/);
  });

  it("el texto para el modelo no incluye el email ni el nombre de la persona", () => {
    const t = textoDelLead(lead(0));
    expect(t).not.toContain("@");
    expect(t).not.toContain("Laura");
  });
});

describe("cliente de Gemini (fetch simulado)", () => {
  const ok = (json: unknown) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } }), { status: 200 });
  const pedido = { sistema: "s", usuario: "u", schema: { $schema: "x", type: "object" } };

  const secuencia = (...respuestas: (Response | Error)[]) => {
    const cuerpos: string[] = [];
    let i = 0;
    const f = (async (_url: string, init?: RequestInit) => {
      cuerpos.push(String(init?.body));
      const r = respuestas[i++];
      if (r instanceof Error) throw r;
      return r;
    }) as typeof fetch;
    return { f, cuerpos, llamadas: () => i };
  };

  it("pide JSON con el schema (sin $schema) y devuelve el objeto y el uso", async () => {
    const s = secuencia(ok({ a: 1 }));
    const r = await crearModeloGemini({ apiKey: "k", fetch: s.f }).generar(pedido);
    expect(r).toEqual({ json: { a: 1 }, uso: { entrada: 10, salida: 5 } });
    const cuerpo = JSON.parse(s.cuerpos[0]);
    expect(cuerpo.generationConfig.responseMimeType).toBe("application/json");
    expect(cuerpo.generationConfig.responseJsonSchema).toEqual({ type: "object" });
  });

  it("reintenta ante 5xx y error de red", async () => {
    const s = secuencia(new Response("x", { status: 503 }), new TypeError("fetch failed"), ok({ b: 2 }));
    const r = await crearModeloGemini({ apiKey: "k", fetch: s.f, reintentos: 3 }).generar(pedido);
    expect(r.json).toEqual({ b: 2 });
    expect(s.llamadas()).toBe(3);
  }, 20_000);

  it("no reintenta un 4xx de pedido mal hecho", async () => {
    const s = secuencia(new Response(JSON.stringify({ error: { message: "bad" } }), { status: 400 }), ok({}));
    await expect(crearModeloGemini({ apiKey: "k", fetch: s.f }).generar(pedido)).rejects.toThrow(/400: bad/);
    expect(s.llamadas()).toBe(1);
  });

  it("si el 429 es el cupo diario, avisa enseguida sin reintentar", async () => {
    const s = secuencia(new Response(JSON.stringify({ error: { message: "Please retry in 3h2m1s" } }), { status: 429 }));
    await expect(crearModeloGemini({ apiKey: "k", fetch: s.f }).generar(pedido)).rejects.toBeInstanceOf(CupoAgotado);
  });

  it("backoff con jitter acotado y lectura del tiempo de espera de Gemini", () => {
    expect(esperaBackoff(1, () => 1)).toBe(1000);
    expect(esperaBackoff(10, () => 1)).toBe(30_000);
    expect(esperaBackoff(3, () => 0)).toBe(0);
    expect(segundosDeEspera("Please retry in 1m30s")).toBe(90);
  });
});
