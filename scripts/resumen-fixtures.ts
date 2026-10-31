// Resumen de los 40 leads de prueba: cuántos hay por tier, cuáles son spam, duplicados y casillas personales,
// y a qué owner los mandan las reglas. Uso: npm run fixtures
import { deduplicarLote } from "../src/lead/dedupe";
import { esCasillaPersonal } from "../src/lead/normalizar";
import { asignarOwner, type Tier } from "../src/lead/routing";
import { validarLead, type Lead } from "../src/lead/schema";
import { detectarSpam } from "../src/lead/spam";
import { fixtures } from "../tests/fixtures/cargar";

const validos = fixtures.map((f) => {
  const v = validarLead(f.lead);
  if (!v.ok) throw new Error(`${f.id} no pasa la validación: ${JSON.stringify(v.errores)}`);
  return { ...f, valido: v.lead as Lead };
});
const dedupe = new Map(deduplicarLote(validos.map((f) => ({ id: f.id, email: f.valido.email, sitio: f.valido.sitio }))).map((x) => [x.lead.id, x.duplicado]));

console.log("| Tier | Leads | Spam | Duplicados | Casilla personal | Owners (cuentas grandes / LATAM / global) |");
console.log("|---|---|---|---|---|---|");
for (const tier of ["A", "B", "C"] as Tier[]) {
  const grupo = validos.filter((f) => f.esperado.tier === tier);
  const spam = grupo.filter((f) => detectarSpam(f.valido).spam).length;
  const dup = grupo.filter((f) => dedupe.get(f.id)?.tipo !== "nuevo").length;
  const personal = grupo.filter((f) => esCasillaPersonal(f.valido.email)).length;
  const owners = ["owner-cuentas-grandes", "owner-latam", "owner-global"].map((o) => grupo.filter((f) => asignarOwner(f.valido).id === o).length);
  console.log(`| ${tier} | ${grupo.length} | ${spam} | ${dup} | ${personal} | ${owners.join(" / ")} |`);
}
console.log(`| Total | ${validos.length} | ${validos.filter((f) => detectarSpam(f.valido).spam).length} | ${[...dedupe.values()].filter((d) => d.tipo !== "nuevo").length} | ${validos.filter((f) => esCasillaPersonal(f.valido.email)).length} | |`);
console.log(`\nDuplicados: ${[...dedupe].filter(([, d]) => d.tipo !== "nuevo").map(([id, d]) => `${id} → ${d.tipo === "nuevo" ? "" : `${d.id} (por ${d.tipo})`}`).join(" · ")}`);
