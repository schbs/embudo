// Pedidos HTTP a APIs externas con timeout, errores tipados y reintentos con backoff (solo red, 429 y 502–504).
// Lo usan los adaptadores de HubSpot y Slack (skill api-integration-standards).
import { esperaBackoff } from "@/ia/gemini";

export class ErrorApi extends Error {
  constructor(
    message: string,
    readonly tipo: "auth" | "no_encontrado" | "limite" | "proveedor" | "red" | "pedido",
    readonly status?: number,
    /** Detalle del proveedor: puede repetir datos del pedido (emails, nombres), así que nunca va al mensaje ni al log. */
    readonly detalle?: string,
  ) {
    super(message);
  }
}

export interface OpcionesHttp {
  fetch?: typeof fetch;
  timeoutMs?: number;
  reintentos?: number;
  /** Para los tests: cuánto esperar entre reintentos (por defecto, backoff con jitter). */
  esperar?: (ms: number) => Promise<void>;
}

const pausa = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Hace el pedido y devuelve el JSON (o null si no hay cuerpo). Reintenta lo que tiene sentido reintentar. */
export async function pedirJson<T>(nombreApi: string, url: string, init: RequestInit, o: OpcionesHttp = {}): Promise<T> {
  const pedirA = o.fetch ?? fetch;
  const esperar = o.esperar ?? pausa;
  let ultimo: ErrorApi | undefined;
  for (let intento = 0; intento <= (o.reintentos ?? 4); intento++) {
    if (intento > 0 && ultimo?.tipo !== "limite") await esperar(esperaBackoff(intento));
    let r: Response;
    try {
      r = await pedirA(url, { ...init, signal: AbortSignal.timeout(o.timeoutMs ?? 10_000) });
    } catch (e) {
      ultimo = new ErrorApi(`${nombreApi}: sin respuesta (${e instanceof Error ? e.message : e})`, "red");
      continue;
    }
    if (r.status === 429) {
      const segundos = Number(r.headers.get("retry-after")) || 0;
      ultimo = new ErrorApi(`${nombreApi}: límite de pedidos (429)`, "limite", 429);
      await esperar(segundos > 0 ? segundos * 1000 : esperaBackoff(intento + 1));
      continue;
    }
    if ([502, 503, 504].includes(r.status)) {
      ultimo = new ErrorApi(`${nombreApi}: el proveedor respondió ${r.status}`, "proveedor", r.status);
      continue;
    }
    const texto = await r.text();
    const json = texto ? (JSON.parse(texto) as T & { message?: string }) : null;
    if (r.status === 401 || r.status === 403) throw new ErrorApi(`${nombreApi}: sin permiso (${r.status}). Revisar el token y los scopes.`, "auth", r.status);
    if (r.status === 404) throw new ErrorApi(`${nombreApi}: no encontrado (404)`, "no_encontrado", 404);
    if (!r.ok) throw new ErrorApi(`${nombreApi}: respondió ${r.status}`, r.status >= 500 ? "proveedor" : "pedido", r.status, json?.message);
    return json as T;
  }
  throw ultimo ?? new ErrorApi(`${nombreApi}: no respondió`, "red");
}
