// Busca por nombre el id de una credencial de n8n (solo id, nombre y tipo; nunca los datos de la credencial).
// Uso: npx tsx scripts/n8n/buscar-credencial.ts "Slack - Embudo"
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin archivo: falla abajo
}

const nombre = process.argv[2];
const base = process.env.N8N_BASE_URL?.replace(/\/$/, "");
const clave = process.env.N8N_API_KEY;
if (!nombre || !base || !clave) {
  console.error("Uso: buscar-credencial.ts <nombre> (y N8N_BASE_URL y N8N_API_KEY cargadas).");
  process.exit(1);
}

async function main() {
  const r = await fetch(`${base}/api/v1/credentials?limit=100`, { headers: { "X-N8N-API-KEY": clave!, accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`n8n respondió HTTP ${r.status}`);
  const { data } = (await r.json()) as { data: { id: string; name: string; type: string }[] };
  const encontradas = data.filter((c) => c.name === nombre).map(({ id, name, type }) => ({ id, name, type }));
  console.log(encontradas.length ? JSON.stringify(encontradas) : `No hay una credencial llamada "${nombre}"`);
}

void main().catch((e) => {
  console.error("Falló:", e instanceof Error ? e.message : e);
  process.exit(1);
});

export {};
