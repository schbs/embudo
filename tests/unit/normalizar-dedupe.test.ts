import { describe, expect, it } from "vitest";
import { buscarDuplicado, deduplicarLote } from "@/lead/dedupe";
import { dominioEmpresa, esCasillaPersonal, normalizarDominio, normalizarEmail } from "@/lead/normalizar";

describe("normalizarEmail", () => {
  it.each([
    [" Laura.Gomez+web@Andina-Logistica.example.com ", "laura.gomez@andina-logistica.example.com"],
    ["Juan.Perez+promo@GoogleMail.com", "juanperez@gmail.com"],
    ["j.u.a.n.perez@gmail.com", "juanperez@gmail.com"],
    ["ana@empresa.example.com", "ana@empresa.example.com"],
  ])("%s → %s", (entrada, salida) => {
    expect(normalizarEmail(entrada)).toBe(salida);
  });

  it.each(["sin-arroba", "@dominio.example.com", "usuario@", "usuario@sinpunto"])("devuelve null si no es un email: %s", (e) => {
    expect(normalizarEmail(e)).toBeNull();
  });
});

describe("normalizarDominio y dominioEmpresa", () => {
  it.each([
    ["https://www.Andina-Logistica.example.com/contacto?x=1", "andina-logistica.example.com"],
    ["andina-logistica.example.com:8080", "andina-logistica.example.com"],
    ["laura@andina-logistica.example.com", "andina-logistica.example.com"],
    ["no es un dominio", null],
    [undefined, null],
  ])("%s → %s", (entrada, salida) => {
    expect(normalizarDominio(entrada)).toBe(salida);
  });

  it("con casilla personal usa el sitio; sin sitio no hay dominio de empresa", () => {
    expect(esCasillaPersonal("camila.rojas@example.com")).toBe(true);
    expect(dominioEmpresa("camila.rojas@example.com", "rojasconsultores.example.com")).toBe("rojasconsultores.example.com");
    expect(dominioEmpresa("pablo@gmail.com")).toBeNull();
    expect(dominioEmpresa("ana@empresa.example.com", "otro-sitio.example.com")).toBe("empresa.example.com");
  });
});

describe("deduplicación", () => {
  const crm = [
    { id: "c1", email: "laura.gomez@andina-logistica.example.com" },
    { id: "c2", email: "pablo.b.demo@example.com" },
  ];

  it("mismo email (con mayúsculas y +etiqueta) → el mismo contacto", () => {
    expect(buscarDuplicado({ email: "Laura.Gomez+web@Andina-Logistica.example.com" }, crm)).toEqual({ tipo: "email", id: "c1" });
  });

  it("otro email del mismo dominio de empresa → la misma company", () => {
    expect(buscarDuplicado({ email: "vgil@andina-logistica.example.com" }, crm)).toEqual({ tipo: "dominio", id: "c1", dominio: "andina-logistica.example.com" });
  });

  it("dos casillas personales distintas NO son la misma empresa", () => {
    expect(buscarDuplicado({ email: "otra.persona@example.com" }, crm)).toEqual({ tipo: "nuevo" });
  });

  it("en un lote, el segundo envío de la misma persona se marca contra el primero", () => {
    const r = deduplicarLote([
      { id: "a", email: "ana@nubehr.example.com" },
      { id: "b", email: "ANA+2@nubehr.example.com" },
      { id: "c", email: "otro@contaflow.example.com" },
    ]);
    expect(r.map((x) => x.duplicado.tipo)).toEqual(["nuevo", "email", "nuevo"]);
  });
});
