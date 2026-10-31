import { describe, expect, it } from "vitest";
import { calificacionJsonSchema, interpretarCalificacion } from "@/lead/calificacion";
import { detectarSpam } from "@/lead/spam";

const base = { nombre: "Ana", empresa: "Empresa", email: "ana@empresa.example.com" };

describe("detectarSpam", () => {
  it("una consulta normal no es spam", () => {
    expect(detectarSpam({ ...base, necesidad: "Necesitamos campañas de LinkedIn para nuestro SaaS B2B." })).toEqual({ spam: false, motivos: [] });
  });

  it.each([
    ["ofrece backlinks", { ...base, necesidad: "We can get you more traffic with our backlinks package." }, "ofrece servicios en vez de pedirlos"],
    ["casilla descartable", { ...base, email: "x@mailinator.com", necesidad: "Quiero información de sus servicios." }, "casilla descartable"],
    ["varios links", { ...base, necesidad: "Miren esto http://a.example.com y esto http://b.example.com" }, "varios links en la consulta"],
    ["todo en mayúsculas", { ...base, necesidad: "QUIERO QUE ME LLAMEN YA MISMO POR FAVOR" }, "todo en mayúsculas"],
  ])("%s", (_, lead, motivo) => {
    const r = detectarSpam(lead);
    expect(r.spam).toBe(true);
    expect(r.motivos).toContain(motivo);
  });
});

describe("interpretarCalificacion (salida de la IA)", () => {
  const respuesta = { score: 82, tier: "A", motivos: ["B2B de 51-200 empleados", "Presupuesto 3k-10k"], siguiente_paso: "Llamar hoy y proponer una auditoría.", resumen: "SaaS B2B con necesidad concreta y fecha de inicio." };

  it("acepta una respuesta válida", () => {
    const r = interpretarCalificacion(respuesta);
    expect(r).toEqual({ ok: true, calificacion: respuesta, tierCorregido: false });
  });

  it("si el tier no coincide con el score, manda el score", () => {
    const r = interpretarCalificacion({ ...respuesta, score: 50, tier: "A" });
    expect(r.ok && r.calificacion.tier).toBe("B");
    expect(r.ok && r.tierCorregido).toBe(true);
  });

  it("rechaza respuestas fuera del contrato (score fuera de rango, sin motivos, tier inventado)", () => {
    const r = interpretarCalificacion({ ...respuesta, score: 140, motivos: [], tier: "S" });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/score/);
  });

  it("publica un JSON schema con los 5 campos obligatorios (para el structured output de Gemini)", () => {
    expect(calificacionJsonSchema).toMatchObject({ type: "object", required: ["score", "tier", "motivos", "siguiente_paso", "resumen"] });
  });
});
