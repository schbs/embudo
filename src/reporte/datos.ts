// Métricas del reporte a partir del registro de leads: por tier, por día, tiempo a primer contacto y spam filtrado.
import { DateTime } from "luxon";
import { ZONA_AGENCIA } from "@/config/agencia";
import type { Tier } from "@/lead/routing";
import type { FilaRegistro } from "@/pipeline/registro";

export interface DatosReporte {
  total: number;
  porTier: Record<Tier, number>;
  spam: number;
  /** Mediana de horas entre que llegó el lead y que alguien lo tomó (solo leads tomados). null si no hay. */
  medianaPrimerContactoHoras: number | null;
  porDia: { dia: string; A: number; B: number; C: number; total: number }[];
  ultimos: FilaRegistro[];
  desde: string | null;
  hasta: string | null;
}

const mediana = (xs: number[]) => {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

export function calcularReporte(filas: FilaRegistro[], ultimos = 8): DatosReporte {
  const porTier: Record<Tier, number> = { A: 0, B: 0, C: 0 };
  const dias = new Map<string, { A: number; B: number; C: number; total: number }>();
  for (const f of filas) {
    porTier[f.tier]++;
    const dia = DateTime.fromISO(f.recibidoEn).setZone(ZONA_AGENCIA).toISODate()!;
    const d = dias.get(dia) ?? { A: 0, B: 0, C: 0, total: 0 };
    d[f.tier]++;
    d.total++;
    dias.set(dia, d);
  }
  const horas = filas
    .filter((f) => f.estado === "tomado" && f.resueltoEn)
    .map((f) => DateTime.fromISO(f.resueltoEn!).diff(DateTime.fromISO(f.recibidoEn), "hours").hours);
  const ordenadas = [...filas].sort((a, b) => b.recibidoEn.localeCompare(a.recibidoEn));
  const diasOrdenados = [...dias.keys()].sort();
  return {
    total: filas.length,
    porTier,
    spam: filas.filter((f) => f.spam).length,
    medianaPrimerContactoHoras: mediana(horas),
    porDia: diasOrdenados.map((dia) => ({ dia, ...dias.get(dia)! })),
    ultimos: ordenadas.slice(0, ultimos),
    desde: diasOrdenados[0] ?? null,
    hasta: diasOrdenados.at(-1) ?? null,
  };
}
