// Borra de HubSpot SOLO lo que creó la demo: contacts, companies y deals con demo_source=embudo y tareas con el
// prefijo "Embudo:". Primero muestra cuántos hay; borra recién con --borrar. Nunca toca otros registros.
// Uso: npm run cleanup            (solo cuenta)
//      npm run cleanup -- --borrar
import { DEMO_SOURCE } from "../src/crm/tipos";
import { PREFIJO_TAREA } from "../src/crm/hubspot";
import { pedirJson } from "../src/integraciones/http";

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
const borrar = process.argv.includes("--borrar");
const pedir = <T>(metodo: string, ruta: string, cuerpo?: unknown) =>
  pedirJson<T>("HubSpot", `https://api.hubapi.com${ruta}`, { method: metodo, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });

type Filtro = { propertyName: string; operator: string; value: string };

/** example.com y sus subdominios están reservados (RFC 2606): no pueden ser empresas reales. */
const esDominioFicticio = (d: string | null | undefined) => d === "example.com" || (d ?? "").endsWith(".example.com");

async function ids(objeto: string, filtro: Filtro, extra?: (p: Record<string, string | null>) => boolean): Promise<string[]> {
  const encontrados: string[] = [];
  let after: string | undefined;
  do {
    const r = await pedir<{ results: { id: string; properties: Record<string, string | null> }[]; paging?: { next?: { after: string } } }>("POST", `/crm/v3/objects/${objeto}/search`, {
      filterGroups: [{ filters: [filtro] }],
      properties: ["demo_source", "hs_task_subject", "domain", "hs_object_source"],
      limit: 100,
      ...(after ? { after } : {}),
    });
    encontrados.push(...r.results.filter((x) => !extra || extra(x.properties)).map((x) => x.id));
    after = r.paging?.next?.after;
  } while (after);
  return encontrados;
}

async function main() {
  const demo: Filtro = { propertyName: "demo_source", operator: "EQ", value: DEMO_SOURCE };
  const objetivos: [string, string[]][] = [
    ["tasks", await ids("tasks", { propertyName: "hs_task_subject", operator: "CONTAINS_TOKEN", value: "Embudo" }, (p) => (p.hs_task_subject ?? "").startsWith(PREFIJO_TAREA))],
    ["deals", await ids("deals", demo, (p) => p.demo_source === DEMO_SOURCE)],
    ["contacts", await ids("contacts", demo, (p) => p.demo_source === DEMO_SOURCE)],
    ["companies", [
      ...(await ids("companies", demo, (p) => p.demo_source === DEMO_SOURCE)),
      // Con la opción de HubSpot "crear y asociar empresas automáticamente", la cuenta crea sola una empresa por dominio
      // de cada contacto, sin demo_source. Solo se borran las de dominios ficticios reservados (*.example.com).
      ...(await ids("companies", { propertyName: "domain", operator: "CONTAINS_TOKEN", value: "*.example.com" }, (p) => p.hs_object_source === "COMPANIES" && !p.demo_source && esDominioFicticio(p.domain))),
    ]],
  ];
  for (const [objeto, lista] of objetivos) console.log(`${objeto}: ${lista.length} de la demo`);
  if (!borrar) {
    console.log("\nNo se borró nada. Para borrar: npm run cleanup -- --borrar");
    return;
  }
  for (const [objeto, lista] of objetivos) {
    for (let i = 0; i < lista.length; i += 100) {
      await pedir("POST", `/crm/v3/objects/${objeto}/batch/archive`, { inputs: lista.slice(i, i + 100).map((id) => ({ id })) });
    }
    console.log(`✓ ${objeto}: ${lista.length} borrados`);
  }
  // La búsqueda de HubSpot sigue mostrando lo borrado durante un rato: si una corrida empieza antes, reusa empresas
  // archivadas en vez de crearlas. Se espera hasta que la búsqueda no encuentre nada de la demo.
  for (let i = 0; i < 48; i++) {
    const quedan = (await Promise.all(objetivos.map(async ([objeto]) => (objeto === "tasks" ? await ids("tasks", { propertyName: "hs_task_subject", operator: "CONTAINS_TOKEN", value: "Embudo" }) : await ids(objeto, demo)).length))).reduce((a, b) => a + b, 0);
    if (quedan === 0) {
      console.log("✓ la búsqueda de HubSpot ya no muestra nada de la demo");
      return;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("La búsqueda de HubSpot sigue mostrando registros borrados después de 4 minutos");
}

void main().catch((e) => {
  console.error("Falló:", e instanceof Error ? e.message : e);
  process.exit(1);
});
