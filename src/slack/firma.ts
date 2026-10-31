// Verificación de pedidos de Slack (interacciones de botones): HMAC-SHA256 "v0" del cuerpo crudo con el signing secret,
// comparado en tiempo constante, y timestamp de menos de 5 minutos (evita que repitan un pedido viejo).
import crypto from "node:crypto";

const VENTANA_SEGUNDOS = 5 * 60;

export function firmarSlack(cuerpo: string, timestamp: string, secreto: string): string {
  return `v0=${crypto.createHmac("sha256", secreto).update(`v0:${timestamp}:${cuerpo}`).digest("hex")}`;
}

export function verificarFirmaSlack(opciones: { cuerpo: string; timestamp: string | null; firma: string | null; secreto: string; ahoraSegundos?: number }): boolean {
  const { cuerpo, timestamp, firma, secreto } = opciones;
  if (!timestamp || !firma || !/^\d+$/.test(timestamp)) return false;
  const ahora = opciones.ahoraSegundos ?? Math.floor(Date.now() / 1000);
  if (Math.abs(ahora - Number(timestamp)) > VENTANA_SEGUNDOS) return false;
  const esperada = Buffer.from(firmarSlack(cuerpo, timestamp, secreto));
  const recibida = Buffer.from(firma);
  return esperada.length === recibida.length && crypto.timingSafeEqual(esperada, recibida);
}
