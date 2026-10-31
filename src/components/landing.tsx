// Landing de Nodo Growth (dirección A · Tablero de operaciones): grilla 8/4, números grandes, embudo literal.
import { MUESTRA_FIXTURES } from "@/config/agencia";
import { ruta, TEXTOS, type Idioma } from "@/i18n";
import { Embudo } from "./embudo";
import { Encabezado, Pie } from "./encabezado";
import { Formulario } from "./formulario";

export function Landing({ idioma }: { idioma: Idioma }) {
  const t = TEXTOS[idioma].landing;
  const form = TEXTOS[idioma].form;
  return (
    <>
      <Encabezado idioma={idioma} camino="/" />
      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-14 pt-10 lg:grid-cols-12 lg:items-end lg:pt-16">
          <div className="flex flex-col gap-5 lg:col-span-8">
            <p className="font-titulo text-sm font-bold uppercase tracking-widest text-pino-700">{t.volanta}</p>
            <h1 className="font-titulo text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">{t.titulo}</h1>
            <p className="max-w-2xl text-lg text-suave">{t.bajada}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a href="#contacto" className="inline-flex min-h-12 items-center justify-center rounded-panel bg-pino-700 px-6 font-titulo font-bold text-blanco hover:bg-pino-800">
                {t.cta}
              </a>
              <a href={ruta(idioma, "/reporte")} className="inline-flex min-h-12 items-center justify-center rounded-panel border border-pino-700 px-6 font-titulo font-bold text-pino-700 hover:bg-pino-50">
                {t.verReporte}
              </a>
            </div>
          </div>
          <div className="lg:col-span-4">
            <Embudo conteo={MUESTRA_FIXTURES} nombres={t.tiers} titulo={`${t.embudoTitulo} · ${t.muestra}`} />
          </div>
        </section>

        <section aria-labelledby="titulo-pasos" className="border-y border-linea bg-blanco">
          <div className="mx-auto w-full max-w-6xl px-4 py-12">
            <h2 id="titulo-pasos" className="font-titulo text-2xl font-bold lg:text-3xl">
              {t.pasosTitulo}
            </h2>
            <ol className="mt-8 grid border-l border-t border-linea sm:grid-cols-2 lg:grid-cols-4">
              {t.pasos.map((p) => (
                <li key={p.n} className="flex flex-col gap-2 border-b border-r border-linea p-5">
                  <span className="font-titulo text-4xl font-bold tabular-nums text-pino-700">{p.n}</span>
                  <h3 className="font-titulo text-lg font-bold">{p.titulo}</h3>
                  <p className="text-suave">{p.texto}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="contacto" aria-labelledby="titulo-contacto" className="mx-auto grid w-full max-w-6xl scroll-mt-4 gap-8 px-4 py-14 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <h2 id="titulo-contacto" className="font-titulo text-2xl font-bold lg:text-3xl">
              {form.titulo}
            </h2>
            <p className="mb-6 mt-2 text-suave">{form.bajada}</p>
            <div className="rounded-panel border border-linea bg-blanco p-5 sm:p-6">
              <Formulario idioma={idioma} />
            </div>
          </div>
          <aside aria-labelledby="titulo-plazos" className="lg:col-span-4">
            <h2 id="titulo-plazos" className="font-titulo text-xl font-bold">
              {t.plazosTitulo}
            </h2>
            <table className="mt-4 w-full border-collapse text-left">
              <tbody>
                {t.plazos.map((p) => (
                  <tr key={p.tier} className="border-b border-linea">
                    <th scope="row" className="py-3 pr-3 font-titulo font-bold">
                      Tier {p.tier} · {t.tiers[p.tier as "A" | "B" | "C"]}
                    </th>
                    <td className="py-3 text-right font-titulo font-bold tabular-nums text-pino-700">{p.texto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-sm text-suave">{t.horario}</p>
          </aside>
        </section>
      </main>
      <Pie idioma={idioma} />
    </>
  );
}
