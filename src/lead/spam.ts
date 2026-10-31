// Filtro de spam antes de la IA: lo obvio se descarta sin gastar una llamada al modelo (y queda registrado con el motivo).
import { esCasillaDescartable } from "./normalizar";
import type { Lead } from "./schema";

const OFERTAS = [
  /\bbacklinks?\b/i,
  /\bguest post/i,
  /\b(seo|link building) (services?|package)/i,
  /\bwe can (rank|get you)\b/i,
  /\b(crypto|casino|forex|viagra|loan offer)\b/i,
  /\bfirst page of google\b/i,
];

export interface ResultadoSpam {
  spam: boolean;
  motivos: string[];
}

export function detectarSpam(lead: Pick<Lead, "email" | "nombre" | "empresa" | "necesidad">): ResultadoSpam {
  const motivos: string[] = [];
  if (esCasillaDescartable(lead.email)) motivos.push("casilla descartable");
  if (OFERTAS.some((r) => r.test(lead.necesidad))) motivos.push("ofrece servicios en vez de pedirlos");
  if ((lead.necesidad.match(/https?:\/\//g) ?? []).length >= 2) motivos.push("varios links en la consulta");
  const letras = lead.necesidad.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ]/g, "");
  if (letras.length >= 20 && letras === letras.toUpperCase()) motivos.push("todo en mayúsculas");
  return { spam: motivos.length > 0, motivos };
}
