import Link from "next/link";
import { ruta, TEXTOS, type Idioma } from "@/i18n";

export function Encabezado({ idioma, camino }: { idioma: Idioma; camino: "/" | "/reporte" }) {
  const t = TEXTOS[idioma];
  return (
    <header className="border-b border-linea bg-fondo">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href={ruta(idioma, "/")} className="flex min-h-11 items-center gap-2 font-titulo text-lg font-bold">
          <span aria-hidden="true" className="flex size-7 flex-col justify-center gap-0.5">
            <span className="h-1.5 w-full rounded-sm bg-pino-700" />
            <span className="h-1.5 w-4/5 rounded-sm bg-ambar" />
            <span className="h-1.5 w-3/5 rounded-sm bg-borde" />
          </span>
          {t.marca}
        </Link>
        <nav className="flex items-center gap-1 text-sm font-semibold">
          {camino === "/" ? (
            <Link href={ruta(idioma, "/reporte")} className="inline-flex min-h-11 items-center px-3 text-pino-700 underline-offset-4 hover:underline">
              {t.nav.reporte}
            </Link>
          ) : (
            <Link href={ruta(idioma, "/")} className="inline-flex min-h-11 items-center px-3 text-pino-700 underline-offset-4 hover:underline">
              {t.nav.inicio}
            </Link>
          )}
          <Link href={ruta(t.otro.lang, camino)} hrefLang={t.otro.lang} lang={t.otro.lang} className="inline-flex min-h-11 items-center px-3 text-pino-700 underline underline-offset-4">
            {t.otro.etiqueta}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function Pie({ idioma }: { idioma: Idioma }) {
  const t = TEXTOS[idioma].landing;
  return (
    <footer className="mt-auto border-t border-linea">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-6 text-sm text-suave sm:flex-row sm:justify-between">
        <p className="font-semibold text-tinta">{t.demo}</p>
        <p>{t.autoria}</p>
      </div>
    </footer>
  );
}
