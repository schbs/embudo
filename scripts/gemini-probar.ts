// Diagnóstico: una sola llamada chica a Gemini. Muestra si responde o el error (nunca la clave).
// Sirve para saber si se agotó el cupo diario antes de correr run-fixtures (40 llamadas).
// Uso: npx tsx scripts/gemini-probar.ts
import { crearModeloGemini } from "../src/ia/gemini";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sin archivo: falla abajo
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY.");
  const modelo = crearModeloGemini({ apiKey, modelo: process.env.GEMINI_MODEL || undefined, reintentos: 0 });
  const r = await modelo.generar({ sistema: "Respondé en JSON.", usuario: "Decí ok.", schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] } });
  console.log("OK:", JSON.stringify(r.json));
}

void main().catch((e) => {
  console.error("Falló:", e instanceof Error ? `${e.constructor.name}: ${e.message}` : e);
  process.exit(1);
});

export {};
