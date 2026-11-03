// Arma el .env.local de Embudo sin mostrar ningún valor: copia las claves compartidas que ya existen (Gemini, de
// TurnoListo), genera un N8N_WEBHOOK_TOKEN nuevo (solo de este proyecto) y deja vacías las que tiene que cargar Germán.
// No pisa variables que ya estén cargadas. Uso: node scripts/copiar-claves.mjs
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DESTINO = ".env.local";
const ORIGEN = path.join("..", "turnolisto", ".env.local");
const COMPARTIDAS = ["GEMINI_API_KEY", "GEMINI_MODEL"];
// La conexión a n8n Cloud es la misma cuenta para todos los proyectos: se toma del asistente demo (CHATBOT/).
const ORIGEN_N8N = path.join("..", "..", "CHATBOT", ".env");
const COMPARTIDAS_N8N = ["N8N_BASE_URL", "N8N_API_KEY"];

const leer = (archivo) => {
  const valores = {};
  if (!fs.existsSync(archivo)) return valores;
  for (const linea of fs.readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (m) valores[m[1]] = m[2];
  }
  return valores;
};

const actuales = leer(DESTINO);
const origen = leer(ORIGEN);
const origenN8n = leer(ORIGEN_N8N);
const nombres = fs
  .readFileSync(".env.example", "utf8")
  .split(/\r?\n/)
  .map((l) => l.match(/^([A-Z][A-Z0-9_]*)=/)?.[1])
  .filter(Boolean);

const salida = {};
for (const n of nombres) {
  if (actuales[n]) salida[n] = actuales[n];
  else if (COMPARTIDAS.includes(n) && origen[n]) salida[n] = origen[n];
  else if (COMPARTIDAS_N8N.includes(n) && origenN8n[n]) salida[n] = origenN8n[n];
  else if (n === "N8N_WEBHOOK_TOKEN") salida[n] = crypto.randomBytes(32).toString("base64url");
  else salida[n] = "";
}
fs.writeFileSync(DESTINO, Object.entries(salida).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
for (const n of nombres) console.log(`${salida[n] ? "OK   " : "FALTA"}  ${n}`);
