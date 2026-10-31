// Datos de la demo para /reporte en modo local: pasa los 40 leads de prueba por el embudo (con las respuestas grabadas
// de Gemini, sin gastar cuota), repartidos en 10 días hábiles, y marca dos tercios de los A y B como tomados con
// tiempos de respuesta variados. Determinista: correrlo dos veces da lo mismo. Todo es ficticio.
// Uso: npm run demo:sembrar            (escribe en data/dev/ o en EMBUDO_DIR_DATOS)
import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { ZONA_AGENCIA } from "../src/config/agencia";
import { crearCrmMemoria } from "../src/crm/memoria";
import { crearModeloGrabado } from "../src/ia/gemini";
import { DIR_LOCAL } from "../src/pipeline/dependencias";
import { procesarLead } from "../src/pipeline/procesar";
import { crearRegistroArchivo } from "../src/pipeline/registro";
import { crearAvisadorLocal } from "../src/slack/cliente";
import { fixtures } from "../tests/fixtures/cargar";
import { cargarGrabaciones, claveGrabacion } from "../tests/fixtures/grabaciones";

const HASTA = DateTime.fromISO("2026-10-30T18:00", { zone: ZONA_AGENCIA });

async function main() {
  fs.mkdirSync(DIR_LOCAL, { recursive: true });
  for (const f of ["registro.jsonl", "crm.json", "slack.jsonl"]) fs.rmSync(path.join(DIR_LOCAL, f), { force: true });
  const registro = crearRegistroArchivo(path.join(DIR_LOCAL, "registro.jsonl"));
  const modelo = crearModeloGrabado(cargarGrabaciones().respuestas, claveGrabacion);
  const deps = { crm: crearCrmMemoria({ archivo: path.join(DIR_LOCAL, "crm.json") }), avisador: crearAvisadorLocal(path.join(DIR_LOCAL, "slack.jsonl")), registro, modelo, ahora: () => HASTA.toUTC().toISO()! };

  // Días hábiles hacia atrás desde el 30/10 (10 días).
  const dias: DateTime[] = [];
  for (let d = HASTA.startOf("day"); dias.length < 10; d = d.minus({ days: 1 })) if (d.weekday <= 5) dias.unshift(d);

  for (const [i, f] of fixtures.entries()) {
    const recibido = dias[(i * 7) % dias.length].set({ hour: 9 + ((i * 5) % 9), minute: (i * 13) % 60 });
    const r = await procesarLead(f.lead, deps, { leadId: `demo-${f.id}`, recibidoEn: recibido.toUTC().toISO()! });
    if (!r.ok || r.fila.spam || r.calificacion.tier === "C") continue;
    if (i % 3 === 2) continue; // un tercio sigue sin tomar
    const horas = r.calificacion.tier === "A" ? 0.4 + ((i * 7) % 15) / 10 : 2 + ((i * 11) % 60) / 10;
    await registro.marcar(`demo-${f.id}`, i % 7 === 6 ? "descartado" : "tomado", recibido.plus({ hours: horas }).toUTC().toISO()!);
  }
  const filas = await registro.leer();
  console.log(`${filas.length} leads en ${path.join(DIR_LOCAL, "registro.jsonl")}: ${filas.filter((x) => x.estado === "tomado").length} tomados, ${filas.filter((x) => x.spam).length} spam`);
}

void main().catch((e) => {
  console.error("Falló:", e instanceof Error ? e.message : e);
  process.exit(1);
});
