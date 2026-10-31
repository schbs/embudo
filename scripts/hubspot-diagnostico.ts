// Diagnóstico: corre el conteo de la demo en HubSpot y, si falla, muestra el mensaje de HubSpot (nunca el token).
// Uso: npx tsx scripts/hubspot-diagnostico.ts
import { crearCrmHubspot } from "../src/crm/hubspot";
import { ErrorApi } from "../src/integraciones/http";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sin archivo: falla abajo
}

const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
if (!token) {
  console.error("Falta HUBSPOT_PRIVATE_APP_TOKEN.");
  process.exit(1);
}

// Con --lead, además procesa el primer lead de prueba (crea registros demo_source=embudo; se borran con cleanup).
const conLead = process.argv.includes("--lead");

async function main() {
  console.log("conteo:", await crearCrmHubspot(token!).contarDemo());
  // Con --contactos, lista los contactos de la demo (email y fecha) para encontrar repetidos.
  if (process.argv.includes("--contactos")) {
    const r = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "demo_source", operator: "EQ", value: "embudo" }] }], properties: ["email", "createdate"], limit: 100 }),
    });
    const { results } = (await r.json()) as { results: { id: string; properties: { email: string; createdate: string } }[] };
    const porEmail = new Map<string, string[]>();
    for (const c of results) porEmail.set(c.properties.email, [...(porEmail.get(c.properties.email) ?? []), c.properties.createdate]);
    for (const [email, fechas] of [...porEmail].sort()) console.log(fechas.length > 1 ? "REPETIDO" : "        ", email, fechas.join(" "));
  }
  if (!conLead) return;
  const { dependencias } = await import("../src/pipeline/dependencias");
  const { procesarLead } = await import("../src/pipeline/procesar");
  const { fixtures } = await import("../tests/fixtures/cargar");
  const r = await procesarLead(fixtures[0].lead, dependencias(), { leadId: `${fixtures[0].id}-diag` });
  console.log("lead:", r.ok ? { tier: r.calificacion.tier, crm: r.fila } : "no pasó la validación");
}

main()
  .catch((e: unknown) => {
    console.error(e instanceof ErrorApi ? `${e.message}\n${(e.detalle ?? "").slice(0, 600)}` : e);
    process.exit(1);
  });
