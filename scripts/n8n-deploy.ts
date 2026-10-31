// Crea o actualiza el workflow "Embudo - Leads" en n8n Cloud por API, dentro de la carpeta del proyecto y SIN activarlo
// (se activa a mano después de probar, con el OK de Germán). Solo toca el workflow cuyo id quedó en
// scripts/n8n/estado.json y cuyo nombre empieza con "Embudo - ". Deja la copia sin credenciales en n8n/embudo.json.
// Uso: npm run n8n:deploy            (con --exportar solo arma n8n/embudo.json, sin tocar n8n)
import fs from "node:fs";
import { construir, type ConfigN8n } from "./n8n/workflows/embudo";

const CONFIG = "scripts/n8n/config.json";
const ESTADO = "scripts/n8n/estado.json";
const EXPORTADO = "n8n/embudo.json";
const soloExportar = process.argv.includes("--exportar");

type Nodo = Omit<ReturnType<typeof construir>["nodes"][number], "credentials"> & { credentials?: Record<string, { id?: string; name: string }> };

/** Copia para el repo: sin credenciales y con los datos de la cuenta como marcadores. */
function exportar(wf: ReturnType<typeof construir>) {
  const nodos = (wf.nodes as unknown as Nodo[]).map(({ credentials, ...n }) => ({ ...n, ...(credentials ? { credentials: Object.fromEntries(Object.keys(credentials).map((k) => [k, { name: "[credencial de la cuenta]" }])) } : {}) }));
  fs.mkdirSync("n8n", { recursive: true });
  fs.writeFileSync(EXPORTADO, JSON.stringify({ name: wf.name, nodes: nodos, connections: wf.connections, settings: wf.settings }, null, 2) + "\n");
  console.log(`copia sin credenciales: ${EXPORTADO}`);
}

async function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG, "utf8")) as ConfigN8n & { credenciales?: { sheets?: string; slack?: string } };
  if (soloExportar) {
    exportar(construir(config));
    return;
  }
  const faltan = Object.entries(config).filter(([, v]) => typeof v === "string" && v.startsWith("[A DEFINIR")).map(([k]) => k);
  if (faltan.length || !config.token_hash) throw new Error(`Completar en ${CONFIG}: ${[...faltan, ...(config.token_hash ? [] : ["token_hash"])].join(", ")}`);
  process.loadEnvFile(".env.local");
  const base = process.env.N8N_BASE_URL?.replace(/\/$/, "");
  const clave = process.env.N8N_API_KEY;
  if (!base || !clave) throw new Error("Faltan N8N_BASE_URL o N8N_API_KEY (npm run check-env).");
  const api = async <T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> => {
    const r = await fetch(`${base}/api/v1${ruta}`, { method: metodo, headers: { "X-N8N-API-KEY": clave, accept: "application/json", ...(cuerpo ? { "Content-Type": "application/json" } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined, signal: AbortSignal.timeout(20_000) });
    const texto = await r.text();
    if (!r.ok) throw new Error(`n8n ${metodo} ${ruta} → HTTP ${r.status}: ${texto.slice(0, 300)}`);
    return (texto ? JSON.parse(texto) : null) as T;
  };

  const wf = construir(config);
  if (!wf.name.startsWith("Embudo - ")) throw new Error(`Nombre no permitido: ${wf.name}`);
  // Las credenciales se referencian por id (las crea Germán en n8n; este script no crea ni modifica ninguna).
  for (const n of wf.nodes as unknown as Nodo[]) {
    if (n.credentials?.googleSheetsOAuth2Api) n.credentials.googleSheetsOAuth2Api.id = config.credenciales?.sheets;
    if (n.credentials?.slackApi) n.credentials.slackApi.id = config.credenciales?.slack;
  }
  const cuerpo = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings };
  const estado = fs.existsSync(ESTADO) ? (JSON.parse(fs.readFileSync(ESTADO, "utf8")) as Record<string, string>) : {};
  if (estado.leads) {
    const actual = await api<{ name: string }>("GET", `/workflows/${estado.leads}`);
    if (!actual.name.startsWith("Embudo - ")) throw new Error(`El workflow ${estado.leads} no es de Embudo: no lo toco`);
    await api("PUT", `/workflows/${estado.leads}`, cuerpo);
    console.log(`actualizado: ${wf.name} (${estado.leads}), sigue inactivo hasta activarlo a mano`);
  } else {
    const creado = await api<{ id: string }>("POST", "/workflows", { ...cuerpo, parentFolderId: config.carpeta_id });
    estado.leads = creado.id;
    fs.writeFileSync(ESTADO, JSON.stringify(estado, null, 2) + "\n");
    console.log(`creado inactivo en la carpeta de Embudo: ${wf.name} (${creado.id})`);
  }
  exportar(wf);
}

void main().catch((e) => {
  console.error("Falló:", e instanceof Error ? e.message : e);
  process.exit(1);
});
