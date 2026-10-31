// Token de los pedidos de n8n a /api/leads: se comparan los SHA-256 en tiempo constante (el token vive solo en
// .env.local, n8n y Vercel; nunca en el código).
import crypto from "node:crypto";

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest();

export function tokenValido(recibido: string | null, esperado: string | undefined): boolean {
  if (!recibido || !esperado) return false;
  return crypto.timingSafeEqual(sha256(recibido), sha256(esperado));
}

/** Acepta "Authorization: Bearer <token>" o "x-embudo-token: <token>". */
export function tokenDelPedido(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  return headers.get("x-embudo-token");
}
