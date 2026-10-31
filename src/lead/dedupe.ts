// Deduplicación: el mismo email es la misma persona (se actualiza el contacto); el mismo dominio de empresa es la misma
// company (el contacto nuevo se asocia a la que ya existe). Así no se crean duplicados en HubSpot.
import { dominioEmpresa, normalizarEmail } from "./normalizar";

export interface LeadConocido {
  id: string;
  email: string;
  sitio?: string;
}

export type Duplicado =
  | { tipo: "email"; id: string }
  | { tipo: "dominio"; id: string; dominio: string }
  | { tipo: "nuevo" };

export interface ClavesLead {
  email: string | null;
  dominio: string | null;
}

export function clavesDe(lead: { email: string; sitio?: string }): ClavesLead {
  return { email: normalizarEmail(lead.email), dominio: dominioEmpresa(lead.email, lead.sitio) };
}

/** Busca el lead entre los conocidos: primero por email (persona), después por dominio (empresa). */
export function buscarDuplicado(lead: { email: string; sitio?: string }, conocidos: LeadConocido[]): Duplicado {
  const claves = clavesDe(lead);
  const porEmail = claves.email ? conocidos.find((c) => normalizarEmail(c.email) === claves.email) : undefined;
  if (porEmail) return { tipo: "email", id: porEmail.id };
  const porDominio = claves.dominio ? conocidos.find((c) => clavesDe(c).dominio === claves.dominio) : undefined;
  if (porDominio) return { tipo: "dominio", id: porDominio.id, dominio: claves.dominio! };
  return { tipo: "nuevo" };
}

/** Recorre un lote en orden y marca cada lead contra los anteriores (y contra los que ya estaban en el CRM). */
export function deduplicarLote<T extends LeadConocido>(lote: T[], yaEnCrm: LeadConocido[] = []): { lead: T; duplicado: Duplicado }[] {
  const vistos = [...yaEnCrm];
  return lote.map((lead) => {
    const duplicado = buscarDuplicado(lead, vistos);
    vistos.push(lead);
    return { lead, duplicado };
  });
}
