// Puerto del CRM: lo que el embudo necesita de HubSpot (o de Pipedrive, Zoho o GoHighLevel: solo cambia el adaptador).
import type { Tier } from "@/lead/routing";

/** Marca de todo lo que crea la demo: permite borrar solo eso (scripts/cleanup.ts). */
export const DEMO_SOURCE = "embudo";

export interface DatosContacto {
  email: string;
  nombre: string;
  apellido: string;
  empresa: string;
  pais: string;
  tier: Tier;
  score: number;
  owner: string;
}

export interface DatosEmpresa {
  dominio: string;
  nombre: string;
  pais: string;
  tamano: string;
}

export interface DatosDeal {
  nombre: string;
  tier: Tier;
  presupuesto: string;
  owner: string;
  contactoId: string;
  empresaId?: string;
}

export interface DatosTarea {
  asunto: string;
  cuerpo: string;
  venceIso: string;
  prioridad: "HIGH" | "MEDIUM" | "LOW";
  contactoId: string;
  dealId?: string;
}

export interface Upsert {
  id: string;
  creado: boolean;
}

export interface Crm {
  nombre: string;
  /** Busca por email (ya normalizado) y crea o actualiza: nunca duplica el contacto. */
  upsertContacto(datos: DatosContacto): Promise<Upsert>;
  /** Busca por dominio y crea si no existe: nunca duplica la empresa. */
  upsertEmpresa(datos: DatosEmpresa): Promise<Upsert>;
  asociarContactoEmpresa(contactoId: string, empresaId: string): Promise<void>;
  /** Deal abierto del contacto (para no crear dos por el mismo lead que vuelve a escribir). */
  dealAbiertoDe(contactoId: string): Promise<string | null>;
  crearDeal(datos: DatosDeal): Promise<string>;
  crearTarea(datos: DatosTarea): Promise<string>;
  /** Cuántos registros de la demo hay (para medir que no se crean duplicados). */
  contarDemo(): Promise<{ contactos: number; empresas: number; deals: number; tareas: number }>;
}
