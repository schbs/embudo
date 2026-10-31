// Diagnóstico: lista las empresas con dominio *.example.com (las de la demo) y quién las creó (nunca muestra el token).
// Uso: npx tsx scripts/hubspot-empresas.ts
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin archivo: falla abajo
}
const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;

async function main() {
  if (!token) throw new Error("Falta HUBSPOT_PRIVATE_APP_TOKEN.");
  const r = await fetch("https://api.hubapi.com/crm/v3/objects/companies/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "domain", operator: "CONTAINS_TOKEN", value: "*.example.com" }] }], properties: ["domain", "demo_source", "hs_object_source", "hs_object_source_label", "createdate"], limit: 100 }),
  });
  const datos = (await r.json()) as { total?: number; results?: { properties: Record<string, string | null> }[]; message?: string };
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${datos.message ?? ""}`);
  console.log(`total: ${datos.total}`);
  for (const c of datos.results ?? []) console.log(c.properties.domain, "| demo_source:", c.properties.demo_source, "| origen:", c.properties.hs_object_source, c.properties.hs_object_source_label ?? "");
}

void main().catch((e) => {
  console.error("Falló:", e instanceof Error ? e.message : e);
  process.exit(1);
});

export {};
