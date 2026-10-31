// Carga los 40 leads ficticios de prueba (tests/fixtures/leads.json) con su tier esperado.
import datos from "./leads.json";
import type { LeadEntrada } from "@/lead/schema";
import type { Tier } from "@/lead/routing";

export interface Fixture {
  id: string;
  esperado: { tier: Tier; spam?: boolean; duplicado_de?: string; por?: "email" | "dominio" };
  nota: string;
  lead: LeadEntrada;
}

export const fixtures = datos.leads as Fixture[];
