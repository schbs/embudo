// Guarda en scripts/n8n/config.json el SHA-256 del N8N_WEBHOOK_TOKEN (el hash no es secreto; el token sí y no se muestra).
// Uso: node scripts/n8n/hash-token.mjs
import crypto from "node:crypto";
import fs from "node:fs";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sin archivo: falla abajo
}
const token = process.env.N8N_WEBHOOK_TOKEN;
if (!token) {
  console.error("Falta N8N_WEBHOOK_TOKEN (node scripts/copiar-claves.mjs lo genera).");
  process.exit(1);
}
const ruta = "scripts/n8n/config.json";
const config = JSON.parse(fs.readFileSync(ruta, "utf8"));
config.token_hash = crypto.createHash("sha256").update(token).digest("hex");
fs.writeFileSync(ruta, JSON.stringify(config, null, 2) + "\n");
console.log("token_hash actualizado en scripts/n8n/config.json");
