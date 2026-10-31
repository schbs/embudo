// Página /reporte: KPIs, el embudo por tier, una tabla por día y los últimos leads. Lee el registro del embudo
// (modo local: data/dev/registro.jsonl; en producción, la planilla de Sheets que completa n8n).
import { DateTime } from "luxon";
import { ZONA_AGENCIA } from "@/config/agencia";
import { localeDe, TEXTOS, type Idioma } from "@/i18n";
import type { Tier } from "@/lead/routing";
import { dependencias } from "@/pipeline/dependencias";
import { calcularReporte } from "@/reporte/datos";
import { Embudo } from "./embudo";
import { Encabezado, Pie } from "./encabezado";

const CHIP: Record<Tier, string> = { A: "bg-pino-50 text-pino-800", B: "bg-ambar-50 text-ambar-texto", C: "bg-gris-50 text-gris" };

function Kpi({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="border-b border-r border-linea p-4 lg:p-5">
      <p className="text-sm font-semibold text-suave">{titulo}</p>
      <p className="mt-1 font-titulo text-3xl font-bold tabular-nums lg:text-4xl">{valor}</p>
      {detalle && <p className="mt-1 text-sm text-suave">{detalle}</p>}
    </div>
  );
}

export async function Reporte({ idioma }: { idioma: Idioma }) {
  const t = TEXTOS[idioma].reporte;
  const nombres = TEXTOS[idioma].landing.tiers;
  const filas = await dependencias().registro.leer();
  const d = calcularReporte(filas);
  const fecha = (iso: string, formato: string) => DateTime.fromISO(iso).setZone(ZONA_AGENCIA).setLocale(localeDe(idioma)).toFormat(formato);

  return (
    <>
      <Encabezado idioma={idioma} camino="/reporte" />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-10">
        <div>
          <h1 className="font-titulo text-3xl font-bold lg:text-4xl">{t.titulo}</h1>
          {d.desde && d.hasta && <p className="mt-2 text-suave">{t.bajada(fecha(d.desde, t.formatoDia), fecha(d.hasta, t.formatoDia))}</p>}
        </div>

        {d.total === 0 ? (
          <p className="text-suave">{t.sinDatos}</p>
        ) : (
          <>
            <section aria-label={t.titulo} className="grid border-l border-t border-linea bg-blanco sm:grid-cols-2 lg:grid-cols-4">
              <Kpi titulo={t.kpis.leads} valor={String(d.total)} />
              <Kpi titulo={t.kpis.prioridad} valor={`${Math.round((d.porTier.A / d.total) * 100)} %`} detalle={t.deTotal(d.porTier.A, d.total)} />
              <Kpi titulo={t.kpis.primerContacto} valor={d.medianaPrimerContactoHoras === null ? "—" : t.horas(d.medianaPrimerContactoHoras)} />
              <Kpi titulo={t.kpis.spam} valor={String(d.spam)} />
            </section>

            <div className="grid gap-8 lg:grid-cols-12">
              <section aria-labelledby="titulo-dias" className="lg:col-span-8">
                <h2 id="titulo-dias" className="font-titulo text-xl font-bold">
                  {t.porDia}
                </h2>
                <div role="region" aria-labelledby="titulo-dias" tabIndex={0} className="mt-4 overflow-x-auto rounded-panel border border-linea bg-blanco">
                  <table className="w-full border-collapse text-left tabular-nums">
                    <thead>
                      <tr className="border-b border-linea text-sm text-suave">
                        <th scope="col" className="px-4 py-2 font-semibold">{t.dia}</th>
                        {(["A", "B", "C"] as Tier[]).map((tier) => (
                          <th key={tier} scope="col" className="px-4 py-2 text-right font-semibold">Tier {tier}</th>
                        ))}
                        <th scope="col" className="px-4 py-2 text-right font-semibold">{t.total}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.porDia.map((fila) => (
                        <tr key={fila.dia} className="border-b border-linea last:border-0">
                          <th scope="row" className="px-4 py-2 font-semibold capitalize">{fecha(fila.dia, t.formatoDia)}</th>
                          <td className="px-4 py-2 text-right">{fila.A}</td>
                          <td className="px-4 py-2 text-right">{fila.B}</td>
                          <td className="px-4 py-2 text-right">{fila.C}</td>
                          <td className="px-4 py-2 text-right font-bold">{fila.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <div className="lg:col-span-4">
                <Embudo conteo={d.porTier} nombres={nombres} titulo={t.kpis.leads} />
              </div>
            </div>

            <section aria-labelledby="titulo-ultimos">
              <h2 id="titulo-ultimos" className="font-titulo text-xl font-bold">
                {t.ultimos}
              </h2>
              <div role="region" aria-labelledby="titulo-ultimos" tabIndex={0} className="mt-4 overflow-x-auto rounded-panel border border-linea bg-blanco">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-linea text-sm text-suave">
                      {[t.columnas.empresa, t.columnas.tier, t.columnas.score, t.columnas.owner, t.columnas.estado, t.columnas.recibido].map((c) => (
                        <th key={c} scope="col" className="px-4 py-2 font-semibold">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.ultimos.map((f) => (
                      <tr key={f.leadId} className="border-b border-linea last:border-0">
                        <th scope="row" className="px-4 py-2 font-semibold">{f.empresa}</th>
                        <td className="px-4 py-2">
                          <span className={`inline-flex rounded-panel px-2 py-0.5 text-sm font-bold ${CHIP[f.tier]}`}>
                            {f.tier} · {nombres[f.tier]}
                          </span>
                        </td>
                        <td className="px-4 py-2 tabular-nums">{f.score}</td>
                        <td className="px-4 py-2">{f.owner}</td>
                        <td className="px-4 py-2">{t.estados[f.estado]}</td>
                        <td className="px-4 py-2 tabular-nums text-suave">{fecha(f.recibidoEn, t.formatoFecha)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-sm text-suave">{t.fuente}</p>
            </section>
          </>
        )}
      </main>
      <Pie idioma={idioma} />
    </>
  );
}
