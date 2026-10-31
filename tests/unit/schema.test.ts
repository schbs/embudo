import { describe, expect, it } from "vitest";
import { validarLead } from "@/lead/schema";

const valido = {
  nombre: "  Laura   Gómez ",
  email: " Laura.Gomez@Andina-Logistica.example.com ",
  empresa: "Andina Logística",
  sitio: "https://andina-logistica.example.com",
  pais: "ar",
  tamano: "51-200",
  presupuesto: "3k-10k",
  necesidad: "Campañas de LinkedIn y SEO para gerentes de logística.",
  consentimiento: true,
};

describe("validarLead", () => {
  it("acepta un lead completo y lo limpia (espacios, email en minúsculas, país en mayúsculas, fuente por defecto)", () => {
    const r = validarLead(valido);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lead.nombre).toBe("Laura Gómez");
    expect(r.lead.email).toBe("laura.gomez@andina-logistica.example.com");
    expect(r.lead.pais).toBe("AR");
    expect(r.lead.fuente).toBe("web");
  });

  it("el sitio es opcional y un sitio vacío queda sin definir", () => {
    const r = validarLead({ ...valido, sitio: "  " });
    expect(r.ok && r.lead.sitio).toBeUndefined();
  });

  it("devuelve un error por campo, en español, para mostrar junto a cada campo", () => {
    const r = validarLead({ ...valido, email: "no-es-un-mail", tamano: "mil", necesidad: "hola", consentimiento: false });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errores).toEqual({
      email: "Revisá el email.",
      tamano: "Elegí el tamaño de la empresa.",
      necesidad: "Contanos qué necesitás (al menos 10 caracteres).",
      consentimiento: "Necesitamos tu consentimiento para contactarte.",
    });
  });

  it("rechaza país que no es un código de dos letras y campos que faltan", () => {
    const r = validarLead({ pais: "Argentina" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errores).sort()).toEqual(["consentimiento", "email", "empresa", "necesidad", "nombre", "pais", "presupuesto", "tamano"]);
  });
});
