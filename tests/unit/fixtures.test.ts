// Los 40 leads de prueba cumplen el contrato y las reglas fijas dan lo que dice cada fixture.
import { describe, expect, it } from "vitest";
import { deduplicarLote } from "@/lead/dedupe";
import { validarLead } from "@/lead/schema";
import { detectarSpam } from "@/lead/spam";
import { fixtures } from "../fixtures/cargar";

describe("fixtures", () => {
  it("son 40: 12 A, 14 B y 14 C", () => {
    const porTier = Object.fromEntries(["A", "B", "C"].map((t) => [t, fixtures.filter((f) => f.esperado.tier === t).length]));
    expect(fixtures).toHaveLength(40);
    expect(porTier).toEqual({ A: 12, B: 14, C: 14 });
  });

  it("todos pasan la validación del formulario", () => {
    const invalidos = fixtures.filter((f) => !validarLead(f.lead).ok).map((f) => f.id);
    expect(invalidos).toEqual([]);
  });

  it("el filtro de spam marca exactamente los 4 esperados, y son todos tier C", () => {
    const marcados = fixtures.filter((f) => {
      const v = validarLead(f.lead);
      return v.ok && detectarSpam(v.lead).spam;
    });
    expect(marcados.map((f) => f.id)).toEqual(fixtures.filter((f) => f.esperado.spam).map((f) => f.id));
    expect(marcados.every((f) => f.esperado.tier === "C")).toBe(true);
  });

  it("la deduplicación encuentra los 3 duplicados esperados, con su tipo y contra quién", () => {
    const lote = fixtures.map((f) => {
      const v = validarLead(f.lead);
      if (!v.ok) throw new Error(f.id);
      return { id: f.id, email: v.lead.email, sitio: v.lead.sitio };
    });
    const encontrados = deduplicarLote(lote)
      .filter((x) => x.duplicado.tipo !== "nuevo")
      .map((x) => ({ id: x.lead.id, ...(x.duplicado.tipo === "nuevo" ? {} : { de: x.duplicado.id, por: x.duplicado.tipo }) }));
    const esperados = fixtures.filter((f) => f.esperado.duplicado_de).map((f) => ({ id: f.id, de: f.esperado.duplicado_de, por: f.esperado.por }));
    expect(encontrados).toEqual(esperados);
  });
});
