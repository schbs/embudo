import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { OWNERS, ZONA_AGENCIA } from "@/config/agencia";
import { asignarOwner, sumarHorasHabiles, tierDeScore, vencimientoSeguimiento } from "@/lead/routing";

const local = (iso: string) => DateTime.fromISO(iso, { zone: ZONA_AGENCIA });
const enLocal = (utc: string) => DateTime.fromISO(utc).setZone(ZONA_AGENCIA).toFormat("ccc yyyy-MM-dd HH:mm");

describe("asignarOwner", () => {
  it.each([
    ["201-500", "US", OWNERS.cuentasGrandes.id],
    ["501+", "AR", OWNERS.cuentasGrandes.id],
    ["51-200", "AR", OWNERS.latam.id],
    ["11-50", "BR", OWNERS.latam.id],
    ["1-10", "MX", OWNERS.latam.id],
    ["51-200", "US", OWNERS.global.id],
    ["11-50", "ES", OWNERS.global.id],
  ] as const)("%s empleados en %s → %s", (tamano, pais, owner) => {
    expect(asignarOwner({ tamano, pais }).id).toBe(owner);
  });
});

describe("tierDeScore", () => {
  it.each([
    [100, "A"],
    [75, "A"],
    [74, "B"],
    [45, "B"],
    [44, "C"],
    [0, "C"],
  ] as const)("%i → %s", (score, tier) => {
    expect(tierDeScore(score)).toBe(tier);
  });
});

describe("SLA en horas hábiles (lunes a viernes, 9 a 18, hora de Buenos Aires)", () => {
  it("dentro del día: martes 10:00 + 2 h → martes 12:00", () => {
    expect(enLocal(sumarHorasHabiles(local("2026-11-03T10:00").toISO()!, 2).toUTC().toISO()!)).toBe("Tue 2026-11-03 12:00");
  });

  it("pasa al día siguiente: martes 17:00 + 2 h → miércoles 10:00", () => {
    expect(enLocal(sumarHorasHabiles(local("2026-11-03T17:00").toISO()!, 2).toUTC().toISO()!)).toBe("Wed 2026-11-04 10:00");
  });

  it("entra el viernes a la noche: tier A vence el lunes a las 11:00", () => {
    expect(enLocal(vencimientoSeguimiento(local("2026-11-06T21:30").toISO()!, "A"))).toBe("Mon 2026-11-09 11:00");
  });

  it("entra el sábado: tier B (9 h hábiles = 1 día hábil) vence el lunes al cierre, 18:00", () => {
    expect(enLocal(vencimientoSeguimiento(local("2026-11-07T12:00").toISO()!, "B"))).toBe("Mon 2026-11-09 18:00");
  });

  it("tier C: 27 h hábiles = 3 días hábiles (lunes 9:00 → miércoles al cierre)", () => {
    expect(enLocal(vencimientoSeguimiento(local("2026-11-02T09:00").toISO()!, "C"))).toBe("Wed 2026-11-04 18:00");
  });
});
