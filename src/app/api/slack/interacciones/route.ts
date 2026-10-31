import { after } from "next/server";
import { crearManejadorInteracciones } from "@/api/slack-interacciones";
import { pedirJson } from "@/integraciones/http";
import { dependencias } from "@/pipeline/dependencias";

export const POST = crearManejadorInteracciones({
  secreto: () => process.env.SLACK_SIGNING_SECRET,
  registro: () => dependencias().registro,
  responder: async (url, cuerpo) => {
    await pedirJson("Slack", url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  },
  enSegundoPlano: (tarea) => after(tarea),
  ahora: () => new Date().toISOString(),
});
