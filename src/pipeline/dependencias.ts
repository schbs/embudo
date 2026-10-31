// Arma los adaptadores según las variables de entorno: con claves, servicios reales; sin claves, modo local en archivos
// (data/dev/), así la demo funciona y el reporte tiene datos aunque no haya cuentas de HubSpot o Slack.
import path from "node:path";
import { crearCrmHubspot } from "@/crm/hubspot";
import { crearCrmMemoria } from "@/crm/memoria";
import { crearModeloGemini, type ModeloJson } from "@/ia/gemini";
import { crearAvisadorLocal, crearAvisadorSlack } from "@/slack/cliente";
import type { DepsPipeline } from "./procesar";
import { crearRegistroArchivo } from "./registro";

/** Carpeta del modo local (los e2e usan otra con EMBUDO_DIR_DATOS para no mezclar datos). */
export const DIR_LOCAL = process.env.EMBUDO_DIR_DATOS ?? path.join(process.cwd(), "data", "dev");

const sinModelo: ModeloJson = {
  nombre: "sin IA",
  async generar() {
    throw new Error("Falta GEMINI_API_KEY");
  },
};

export function dependencias(env: NodeJS.ProcessEnv = process.env): DepsPipeline & { modo: string } {
  const crm = env.HUBSPOT_PRIVATE_APP_TOKEN ? crearCrmHubspot(env.HUBSPOT_PRIVATE_APP_TOKEN) : crearCrmMemoria({ archivo: path.join(DIR_LOCAL, "crm.json") });
  const avisador =
    env.SLACK_BOT_TOKEN && env.SLACK_CANAL_LEADS
      ? crearAvisadorSlack({ token: env.SLACK_BOT_TOKEN, canal: env.SLACK_CANAL_LEADS })
      : crearAvisadorLocal(path.join(DIR_LOCAL, "slack.jsonl"));
  const modelo = env.GEMINI_API_KEY ? crearModeloGemini({ apiKey: env.GEMINI_API_KEY, modelo: env.GEMINI_MODEL || undefined }) : sinModelo;
  return {
    crm,
    avisador,
    modelo,
    registro: crearRegistroArchivo(path.join(DIR_LOCAL, "registro.jsonl")),
    ahora: () => new Date().toISOString(),
    modo: `${crm.nombre} · ${avisador.nombre} · ${modelo.nombre}`,
  };
}
