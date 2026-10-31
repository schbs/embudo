// Puerto de avisos: Slack de verdad (chat.postMessage con un bot token) o un registro local cuando no hay cuenta.
import fs from "node:fs";
import path from "node:path";
import { pedirJson, type OpcionesHttp } from "@/integraciones/http";
import type { Bloque } from "./mensaje";

export interface Avisador {
  nombre: string;
  publicar(mensaje: { text: string; blocks: Bloque[] }): Promise<{ ts: string }>;
}

export function crearAvisadorSlack(opciones: { token: string; canal: string; http?: OpcionesHttp }): Avisador {
  return {
    nombre: "Slack",
    async publicar(m) {
      // La Web API de Slack responde 200 con {ok:false, error} cuando algo sale mal: se convierte en error.
      const r = await pedirJson<{ ok: boolean; ts?: string; error?: string }>(
        "Slack",
        "https://slack.com/api/chat.postMessage",
        { method: "POST", headers: { Authorization: `Bearer ${opciones.token}`, "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ channel: opciones.canal, text: m.text, blocks: m.blocks, unfurl_links: false }) },
        opciones.http,
      );
      if (!r.ok || !r.ts) throw new Error(`Slack: ${r.error ?? "respuesta sin ts"}`);
      return { ts: r.ts };
    },
  };
}

/** Sin Slack: guarda los mensajes en un archivo (modo local) o en memoria (tests). */
export function crearAvisadorLocal(archivo?: string): Avisador & { mensajes: { text: string; blocks: Bloque[] }[] } {
  const mensajes: { text: string; blocks: Bloque[] }[] = [];
  return {
    nombre: archivo ? "Slack local (archivo)" : "Slack en memoria",
    mensajes,
    async publicar(m) {
      mensajes.push(m);
      if (archivo) {
        fs.mkdirSync(path.dirname(archivo), { recursive: true });
        fs.appendFileSync(archivo, JSON.stringify({ en: new Date().toISOString(), ...m }) + "\n");
      }
      return { ts: String(mensajes.length) };
    },
  };
}
