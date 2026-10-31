// Manda los 40 leads de prueba por el embudo completo y mide: precisión de tier contra lo esperado, duplicados creados
// en el CRM (conteo antes y después de reenviar los duplicados) y tiempo de punta a punta (p50/p95).
// Con HUBSPOT_PRIVATE_APP_TOKEN y SLACK_* usa las cuentas de prueba; sin ellas, CRM y Slack en memoria. Gemini siempre real.
// Uso: npm run run-fixtures            (≈ 40 llamadas a Gemini, con pausa entre leads por el límite del plan gratis)
import fs from "node:fs";
import path from "node:path";
import { crearCrmMemoria } from "../src/crm/memoria";
import { ErrorApi } from "../src/integraciones/http";
import { dependencias } from "../src/pipeline/dependencias";
import { procesarLead, type DepsPipeline } from "../src/pipeline/procesar";
import { crearRegistroMemoria } from "../src/pipeline/registro";
import { crearAvisadorLocal } from "../src/slack/cliente";
import { fixtures } from "../tests/fixtures/cargar";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sin archivo: falla abajo si falta Gemini
}
if (!process.env.GEMINI_API_KEY) {
  console.error("Falta GEMINI_API_KEY (npm run check-env).");
  process.exit(1);
}

const percentil = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))];
const pausa = () => new Promise((r) => setTimeout(r, 4000));
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * La búsqueda de HubSpot tarda unos segundos en mostrar lo recién creado: un conteo justo después de crear se queda
 * corto. Se cuenta hasta que dos conteos seguidos (con 5 s de diferencia) den lo mismo.
 */
async function contarEstable(crm: DepsPipeline["crm"]) {
  let anterior = JSON.stringify(await crm.contarDemo());
  for (let i = 0; i < 12; i++) {
    await esperar(5000);
    const actual = JSON.stringify(await crm.contarDemo());
    if (actual === anterior) return JSON.parse(actual) as Awaited<ReturnType<typeof crm.contarDemo>>;
    anterior = actual;
  }
  throw new Error("El conteo de HubSpot no se estabilizó en 1 minuto");
}

async function main() {
  const reales = dependencias();
  const conCuentas = Boolean(process.env.HUBSPOT_PRIVATE_APP_TOKEN);
  const deps: DepsPipeline = conCuentas ? reales : { ...reales, crm: crearCrmMemoria(), avisador: crearAvisadorLocal(), registro: crearRegistroMemoria() };
  console.log(`Modo: ${conCuentas ? reales.modo : `${deps.crm.nombre} · ${deps.avisador.nombre} · ${deps.modelo.nombre}`}\n`);

  const contar = () => (conCuentas ? contarEstable(deps.crm) : deps.crm.contarDemo());
  const antesDeTodo = await contar();
  let aciertos = 0;
  const ms: number[] = [];
  const fallas: string[] = [];
  const unicos = fixtures.filter((f) => !f.esperado.duplicado_de);
  const duplicados = fixtures.filter((f) => f.esperado.duplicado_de);

  const enviar = async (f: (typeof fixtures)[number], sufijo = "") => {
    const t0 = Date.now();
    const r = await procesarLead(f.lead, deps, { leadId: `${f.id}${sufijo}` });
    ms.push(Date.now() - t0);
    if (!r.ok) throw new Error(`${f.id} no pasó la validación`);
    if (r.fila.origen === "respaldo") fallas.push(f.id);
    if (r.calificacion.tier === f.esperado.tier) aciertos++;
    process.stdout.write(r.calificacion.tier === f.esperado.tier ? "." : "x");
    if (r.fila.origen === "ia") await pausa();
  };

  for (const f of unicos) await enviar(f);
  const antesDeDuplicados = await contar();
  for (const f of duplicados) await enviar(f);
  const despues = await contar();

  const creadosPorDuplicados = { contactos: despues.contactos - antesDeDuplicados.contactos, empresas: despues.empresas - antesDeDuplicados.empresas, deals: despues.deals - antesDeDuplicados.deals };
  // Un duplicado por dominio es otra persona de una empresa que ya estaba: su contacto (y su deal) son legítimos;
  // lo que no puede aparecer es otra empresa. Un duplicado por email no puede crear contacto ni empresa.
  const porDominio = duplicados.filter((f) => f.esperado.por === "dominio").length;
  const duplicadosCreados = Math.max(0, creadosPorDuplicados.contactos - porDominio) + creadosPorDuplicados.empresas;
  const resumen = {
    fecha: new Date().toISOString(),
    modo: conCuentas ? "cuentas de prueba (HubSpot y Slack)" : "CRM y Slack en memoria",
    precision: { aciertos, total: fixtures.length, porcentaje: Math.round((aciertos / fixtures.length) * 1000) / 10 },
    crm: { antesDeTodo, antesDeDuplicados, despues, creadosPorDuplicados, contactosNuevosLegitimos: porDominio, duplicadosCreados },
    puntaAPuntaMs: { p50: percentil(ms, 50), p95: percentil(ms, 95) },
    fallasDeIa: fallas,
  };
  console.log(`\n\nPrecisión de tier: ${aciertos}/${fixtures.length} = ${resumen.precision.porcentaje} %`);
  console.log(`CRM antes de los duplicados: ${JSON.stringify(antesDeDuplicados)}`);
  console.log(`CRM después de los 3 duplicados: ${JSON.stringify(despues)} → creados: ${JSON.stringify(creadosPorDuplicados)} (${porDominio} contacto nuevo legítimo: otra persona de una empresa existente)`);
  console.log(`Duplicados creados en el CRM: ${duplicadosCreados}`);
  console.log(`Punta a punta por lead: p50 ${(resumen.puntaAPuntaMs.p50 / 1000).toFixed(1)} s · p95 ${(resumen.puntaAPuntaMs.p95 / 1000).toFixed(1)} s`);
  if (fallas.length) console.log(`La IA falló (quedaron en B para revisar): ${fallas.join(", ")}`);
  fs.mkdirSync(path.join("docs", "resultados"), { recursive: true });
  fs.writeFileSync(path.join("docs", "resultados", "run-fixtures.json"), JSON.stringify(resumen, null, 2) + "\n");
  console.log("→ docs/resultados/run-fixtures.json");
}

void main().catch((e) => {
  // El detalle del proveedor (sin el token) ayuda a distinguir un 500 pasajero de un pedido mal armado.
  console.error("Falló:", e instanceof ErrorApi ? `${e.message}
${(e.detalle ?? "").slice(0, 600)}` : e instanceof Error ? e.message : e);
  process.exit(1);
});
