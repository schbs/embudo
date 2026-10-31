// Prepara la cuenta de prueba de HubSpot para la demo: propiedades custom (demo_source y las del embudo) y el
// pipeline de deals "Demo Embudo" con una etapa por tier. Se puede correr de nuevo: salta lo que ya existe.
// Uso: npm run hubspot:preparar   (necesita HUBSPOT_PRIVATE_APP_TOKEN con scopes de CRM y de esquemas)
import { PIPELINE } from "../src/crm/hubspot";
import { ErrorApi, pedirJson } from "../src/integraciones/http";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sin archivo: falla abajo
}
const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
if (!token) {
  console.error("Falta HUBSPOT_PRIVATE_APP_TOKEN (npm run check-env).");
  process.exit(1);
}
const pedir = <T>(metodo: string, ruta: string, cuerpo?: unknown) =>
  pedirJson<T>("HubSpot", `https://api.hubapi.com${ruta}`, { method: metodo, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });

const PROPIEDADES: Record<string, { name: string; label: string }[]> = {
  contacts: [
    { name: "demo_source", label: "Demo: origen" },
    { name: "demo_tier", label: "Demo: tier" },
    { name: "demo_score", label: "Demo: score" },
    { name: "demo_owner", label: "Demo: owner" },
  ],
  companies: [
    { name: "demo_source", label: "Demo: origen" },
    { name: "demo_tamano", label: "Demo: tamaño" },
  ],
  deals: [
    { name: "demo_source", label: "Demo: origen" },
    { name: "demo_tier", label: "Demo: tier" },
    { name: "demo_owner", label: "Demo: owner" },
    { name: "demo_presupuesto", label: "Demo: presupuesto" },
  ],
};

async function main() {
  for (const [objeto, props] of Object.entries(PROPIEDADES)) {
    for (const p of props) {
      try {
        await pedir("POST", `/crm/v3/properties/${objeto}`, { name: p.name, label: p.label, type: "string", fieldType: "text", groupName: objeto === "deals" ? "dealinformation" : objeto === "companies" ? "companyinformation" : "contactinformation" });
        console.log(`✓ propiedad ${objeto}.${p.name}`);
      } catch (e) {
        if (e instanceof ErrorApi && e.status === 409) console.log(`= propiedad ${objeto}.${p.name} (ya existía)`);
        else throw e;
      }
    }
  }
  const pipelines = await pedir<{ results: { id: string; label: string }[] }>("GET", "/crm/v3/pipelines/deals");
  if (pipelines.results.some((p) => p.label === PIPELINE.nombre)) console.log(`= pipeline "${PIPELINE.nombre}" (ya existía)`);
  else await crearPipeline();
  await probarTareas();
}

/** Las claves de servicio no tienen un permiso propio para tareas: se crea una de prueba y se borra para confirmarlo. */
async function probarTareas() {
  const tarea = await pedir<{ id: string }>("POST", "/crm/v3/objects/tasks", { properties: { hs_task_subject: "Embudo: prueba de permisos", hs_timestamp: new Date().toISOString(), hs_task_status: "NOT_STARTED" } });
  await pedir("DELETE", `/crm/v3/objects/tasks/${tarea.id}`);
  console.log("✓ permiso para crear y borrar tareas");
}

async function crearPipeline() {
  const etapas = (["A", "B", "C"] as const).map((t, i) => ({ label: PIPELINE.etapas[t], displayOrder: i, metadata: { probability: t === "A" ? "0.4" : t === "B" ? "0.2" : "0.05" } }));
  const cerradas = [
    { label: "Ganado", displayOrder: 3, metadata: { probability: "1.0" } },
    { label: "Perdido", displayOrder: 4, metadata: { probability: "0.0" } },
  ];
  await pedir("POST", "/crm/v3/pipelines/deals", { label: PIPELINE.nombre, displayOrder: 99, stages: [...etapas, ...cerradas] });
  console.log(`✓ pipeline "${PIPELINE.nombre}" con etapas Tier A, Tier B, Tier C, Ganado y Perdido`);
}

void main().catch((e) => {
  console.error("Falló:", e instanceof Error ? e.message : e);
  process.exit(1);
});
