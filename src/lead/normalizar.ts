// Normalización de emails y dominios: la base de la deduplicación (en el CRM se busca siempre por estas claves).
import { DOMINIOS_DESCARTABLES, DOMINIOS_PERSONALES } from "@/config/agencia";

const ALIAS_GMAIL = new Set(["gmail.com", "googlemail.com"]);

/**
 * Email canónico: minúsculas, sin espacios y sin "+etiqueta". En Gmail además sin puntos y con googlemail → gmail
 * ("Laura.Gomez+web@GoogleMail.com" → "lauragomez@gmail.com"). null si no parece un email.
 */
export function normalizarEmail(email: string): string | null {
  const limpio = email.trim().toLowerCase();
  const arroba = limpio.lastIndexOf("@");
  if (arroba < 1 || arroba === limpio.length - 1) return null;
  let usuario = limpio.slice(0, arroba).split("+")[0];
  let dominio = limpio.slice(arroba + 1);
  if (!usuario || !dominio.includes(".")) return null;
  if (ALIAS_GMAIL.has(dominio)) {
    usuario = usuario.replaceAll(".", "");
    dominio = "gmail.com";
  }
  return `${usuario}@${dominio}`;
}

/** Dominio de un email o de un sitio: "https://www.Andina.example.com/contacto" → "andina.example.com". null si no hay. */
export function normalizarDominio(entrada: string | undefined | null): string | null {
  if (!entrada) return null;
  let s = entrada.trim().toLowerCase();
  if (s.includes("@")) s = s.slice(s.lastIndexOf("@") + 1);
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").split(/[/?#]/)[0].split(":")[0].replace(/^www\./, "").replace(/\.$/, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) ? s : null;
}

export const esCasillaPersonal = (email: string) => (DOMINIOS_PERSONALES as readonly string[]).includes(normalizarDominio(email) ?? "");
export const esCasillaDescartable = (email: string) => (DOMINIOS_DESCARTABLES as readonly string[]).includes(normalizarDominio(email) ?? "");

/**
 * Dominio de la empresa para deduplicar companies: el del email si es corporativo; si no, el del sitio.
 * null cuando no hay forma de saberlo (casilla personal y sin sitio).
 */
export function dominioEmpresa(email: string, sitio?: string): string | null {
  if (!esCasillaPersonal(email) && !esCasillaDescartable(email)) return normalizarDominio(email);
  const delSitio = normalizarDominio(sitio);
  return delSitio && !(DOMINIOS_PERSONALES as readonly string[]).includes(delSitio) ? delSitio : null;
}
