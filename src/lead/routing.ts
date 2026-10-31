// Reglas de asignación: owner por tamaño y país, y vencimiento del primer contacto (SLA) en horas hábiles.
import { DateTime } from "luxon";
import { HORARIO_HABIL, OWNERS, PAISES_LATAM, SLA_HORAS_HABILES, UMBRALES, ZONA_AGENCIA, type Owner } from "@/config/agencia";
import type { Lead } from "./schema";

export type Tier = "A" | "B" | "C";

export const tierDeScore = (score: number): Tier => (score >= UMBRALES.A ? "A" : score >= UMBRALES.B ? "B" : "C");

/** Owner del lead: 201+ empleados → cuentas grandes; si no, por región (Latinoamérica o el resto). */
export function asignarOwner(lead: Pick<Lead, "tamano" | "pais">): Owner {
  if (lead.tamano === "201-500" || lead.tamano === "501+") return OWNERS.cuentasGrandes;
  return (PAISES_LATAM as readonly string[]).includes(lead.pais) ? OWNERS.latam : OWNERS.global;
}

/** Suma horas hábiles (lunes a viernes, 9 a 18 en la hora de la agencia). Lo que entra fuera de horario arranca en el próximo hábil. */
export function sumarHorasHabiles(desdeIso: string, horas: number, zona = ZONA_AGENCIA): DateTime {
  let t: DateTime = DateTime.fromISO(desdeIso, { zone: zona });
  let restantes = horas * 60;
  const alInicioHabil = (d: DateTime): DateTime => {
    let x = d;
    for (let i = 0; i < 14; i++) {
      const esFinde = x.weekday > 5;
      if (!esFinde && x.hour < HORARIO_HABIL.desde) return x.set({ hour: HORARIO_HABIL.desde, minute: 0, second: 0, millisecond: 0 });
      if (!esFinde && x < x.set({ hour: HORARIO_HABIL.hasta, minute: 0, second: 0, millisecond: 0 })) return x;
      x = x.plus({ days: 1 }).set({ hour: HORARIO_HABIL.desde, minute: 0, second: 0, millisecond: 0 });
    }
    return x;
  };
  t = alInicioHabil(t);
  while (restantes > 0) {
    const cierre = t.set({ hour: HORARIO_HABIL.hasta, minute: 0, second: 0, millisecond: 0 });
    const disponibles = cierre.diff(t, "minutes").minutes;
    if (restantes <= disponibles) return t.plus({ minutes: restantes });
    restantes -= disponibles;
    t = alInicioHabil(cierre.plus({ minutes: 1 }));
  }
  return t;
}

/** Vencimiento del primer contacto según el tier (A: 2 h hábiles, B: 1 día hábil, C: 3 días hábiles). */
export function vencimientoSeguimiento(recibidoIso: string, tier: Tier): string {
  return sumarHorasHabiles(recibidoIso, SLA_HORAS_HABILES[tier]).toUTC().toISO()!;
}
