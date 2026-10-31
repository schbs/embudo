// Califica los 40 leads de prueba con Gemini de verdad, compara con el tier esperado y guarda las respuestas
// (tests/fixtures/grabaciones-ia.json) para que los tests las repitan sin gastar cuota.
// Uso: npm run calificar:grabar        (usa la cuota gratis de Gemini: ~36 llamadas, con pausa entre cada una)
import fs from "node:fs";
import path from "node:path";
import { calificarLead } from "../src/ia/calificador";
import { crearModeloGemini, type ModeloJson, type RespuestaJson } from "../src/ia/gemini";
import { VERSION_PROMPT } from "../src/ia/prompt";
import { validarLead } from "../src/lead/schema";
import { fixtures } from "../tests/fixtures/cargar";
import { claveGrabacion, RUTA_GRABACIONES, type ArchivoGrabaciones } from "../tests/fixtures/grabaciones";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sin el archivo, falla abajo con un mensaje claro
}
if (!process.env.GEMINI_API_KEY) {
  console.error("Falta GEMINI_API_KEY (npm run check-env).");
  process.exit(1);
}

const real = crearModeloGemini({ apiKey: process.env.GEMINI_API_KEY, modelo: process.env.GEMINI_MODEL || undefined });
const grabadas: Record<string, RespuestaJson> = {};
// Pausa entre llamadas para no chocar con el límite por minuto del plan gratis; se graba cada respuesta.
const grabando: ModeloJson = {
  nombre: real.nombre,
  async generar(pedido) {
    await new Promise((r) => setTimeout(r, 4000));
    const r = await real.generar(pedido);
    grabadas[claveGrabacion(pedido.usuario)] = r;
    return r;
  },
};

const percentil = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))];

async function main() {
  const filas: string[] = [];
  let aciertos = 0;
  const msIa: number[] = [];
  const tokens = { entrada: 0, salida: 0 };
  for (const f of fixtures) {
    const v = validarLead(f.lead);
    if (!v.ok) throw new Error(`${f.id} no valida`);
    const r = await calificarLead(v.lead, grabando);
    if (r.origen === "respaldo") throw new Error(`${f.id}: la IA falló (${r.error}). No se guarda nada.`);
    const ok = r.calificacion.tier === f.esperado.tier;
    if (ok) aciertos++;
    if (r.origen === "ia") msIa.push(r.ms - 4000);
    tokens.entrada += r.uso.entrada;
    tokens.salida += r.uso.salida;
    filas.push(`| ${f.id} | ${f.esperado.tier} | ${r.calificacion.tier} (${r.calificacion.score}) | ${r.origen}${r.tierCorregido ? ", tier corregido" : ""} | ${ok ? "✓" : "✗"} | ${r.calificacion.motivos[0]} |`);
    process.stdout.write(ok ? "." : "x");
  }
  console.log(`\n\n| Lead | Esperado | IA (score) | Origen | | Motivo principal |\n|---|---|---|---|---|---|\n${filas.join("\n")}`);
  const precision = (aciertos / fixtures.length) * 100;
  console.log(`\nPrecisión de tier: ${aciertos}/${fixtures.length} = ${precision.toFixed(1)} %`);
  console.log(`Latencia de la IA: p50 ${(percentil(msIa, 50) / 1000).toFixed(1)} s · p95 ${(percentil(msIa, 95) / 1000).toFixed(1)} s (${msIa.length} llamadas, sin la pausa)`);
  console.log(`Tokens: ${tokens.entrada} de entrada y ${tokens.salida} de salida (${Math.round(tokens.entrada / msIa.length)} / ${Math.round(tokens.salida / msIa.length)} por lead)`);

  const archivo: ArchivoGrabaciones = { modelo: real.nombre, versionPrompt: VERSION_PROMPT, grabadoEl: new Date().toISOString(), respuestas: grabadas };
  fs.mkdirSync(path.dirname(RUTA_GRABACIONES), { recursive: true });
  fs.writeFileSync(RUTA_GRABACIONES, JSON.stringify(archivo, null, 2) + "\n");
  const resumen = { fecha: archivo.grabadoEl, modelo: real.nombre, versionPrompt: VERSION_PROMPT, precision: { aciertos, total: fixtures.length }, latenciaMs: { p50: percentil(msIa, 50), p95: percentil(msIa, 95) }, tokens };
  fs.mkdirSync(path.join("docs", "resultados"), { recursive: true });
  fs.writeFileSync(path.join("docs", "resultados", "calificacion.json"), JSON.stringify(resumen, null, 2) + "\n");
  console.log(`\n→ ${RUTA_GRABACIONES} y docs/resultados/calificacion.json (${Object.keys(grabadas).length} respuestas)`);
}

void main().catch((e) => {
  console.error("Falló:", e instanceof Error ? e.message : e);
  process.exit(1);
});
