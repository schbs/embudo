// Arma un archivo con SOLO las variables que necesita la app en Vercel, para que Germán lo pegue en
// Settings → Environment Variables → "Import .env" (o lo arrastre ahí). No muestra ningún valor.
// Quedan afuera las que solo usan los scripts locales (N8N_BASE_URL y N8N_API_KEY, que abren toda la cuenta de n8n).
// Uso: node scripts/variables-vercel.mjs   → crea .env.vercel (ignorado por git y por Vercel). Borrarlo después.
import fs from "node:fs";

try {
  process.loadEnvFile(".env.local");
} catch {
  console.error("No hay variables locales cargadas.");
  process.exit(1);
}

const PARA_VERCEL = ["GEMINI_API_KEY", "GEMINI_MODEL", "HUBSPOT_PRIVATE_APP_TOKEN", "SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET", "SLACK_CANAL_LEADS", "N8N_WEBHOOK_TOKEN", "N8N_WEBHOOK_URL"];
// En Vercel solo se puede escribir en /tmp: el registro y los datos del modo local van ahí.
const FIJAS = { EMBUDO_DIR_DATOS: "/tmp/embudo" };

const lineas = [];
for (const n of PARA_VERCEL) {
  const v = process.env[n]?.trim();
  if (v) lineas.push(`${n}=${v}`);
  console.log(`${v ? "va   " : "vacía"}  ${n}`);
}
for (const [n, v] of Object.entries(FIJAS)) {
  lineas.push(`${n}=${v}`);
  console.log(`va     ${n}`);
}
fs.writeFileSync(".env.vercel", lineas.join("\n") + "\n");
console.log("\nListo: .env.vercel (no se sube a git ni a Vercel). Borralo después de cargarlo.");
