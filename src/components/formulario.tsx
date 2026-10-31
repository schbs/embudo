"use client";
// Formulario de contacto. Errores: resumen anunciado arriba, mensaje junto a cada campo (aria-describedby) y foco en
// el primer campo a corregir. El campo trampa queda fuera de la vista y de los lectores de pantalla.
import { useActionState, useEffect, useRef, useState } from "react";
import { enviarLead, type EstadoFormulario } from "@/app/acciones";
import { TAMANOS, PRESUPUESTOS } from "@/config/agencia";
import { TEXTOS, type Idioma } from "@/i18n";

const ORDEN = ["nombre", "email", "empresa", "sitio", "pais", "tamano", "presupuesto", "necesidad", "consentimiento"] as const;
const campo = "min-h-12 w-full rounded-panel border border-borde bg-blanco px-3 text-base text-tinta";

function MensajeError({ campo, visible, texto }: { campo: string; visible: boolean; texto: string }) {
  if (!visible) return null;
  return (
    <p id={`error-${campo}`} className="mt-1 flex items-center gap-1 text-sm font-semibold text-error">
      <span aria-hidden="true">✕</span> {texto}
    </p>
  );
}

export function Formulario({ idioma }: { idioma: Idioma }) {
  const t = TEXTOS[idioma].form;
  const [estado, accion, enviando] = useActionState<EstadoFormulario, FormData>(enviarLead, { estado: "inicial" });
  const [t0] = useState(() => Date.now());
  const resumen = useRef<HTMLDivElement>(null);
  const exito = useRef<HTMLDivElement>(null);
  const errores = estado.estado === "error" ? new Set(estado.campos) : new Set<string>();

  useEffect(() => {
    if (estado.estado === "ok") exito.current?.focus();
    if (estado.estado === "error") {
      const primero = ORDEN.find((c) => errores.has(c));
      if (primero) document.getElementById(`campo-${primero}`)?.focus();
      else resumen.current?.focus();
    }
    // errores sale de estado: con estado alcanza
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  if (estado.estado === "ok") {
    return (
      <div ref={exito} tabIndex={-1} role="status" className="rounded-panel border border-pino-700 bg-pino-50 p-6">
        <p className="font-titulo text-2xl font-bold text-pino-800">{t.exito.titulo}</p>
        <p className="mt-2 text-tinta">{t.exito.texto}</p>
      </div>
    );
  }

  const ayuda = (c: string) => (errores.has(c) ? `error-${c}` : undefined);
  const error = (c: keyof typeof t.errores) => <MensajeError campo={c} visible={errores.has(c)} texto={t.errores[c]} />;
  const etiqueta = "mb-1 block text-sm font-semibold text-tinta";

  return (
    <form action={accion} noValidate className="grid gap-5 sm:grid-cols-2">
      <input type="hidden" name="t0" value={t0} />
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="web_alternativa">No completar</label>
        <input id="web_alternativa" name="web_alternativa" tabIndex={-1} autoComplete="off" />
      </div>

      {estado.estado === "error" && (
        <div ref={resumen} id="resumen-errores" tabIndex={-1} role="alert" className="rounded-panel border border-error bg-blanco p-3 text-sm font-semibold text-error sm:col-span-2">
          {errores.has("formulario") ? t.errores.formulario : t.resumenErrores(errores.size)}
        </div>
      )}

      <div>
        <label htmlFor="campo-nombre" className={etiqueta}>{t.campos.nombre}</label>
        <input id="campo-nombre" name="nombre" autoComplete="name" required aria-invalid={errores.has("nombre")} aria-describedby={ayuda("nombre")} className={campo} />
        {error("nombre")}
      </div>
      <div>
        <label htmlFor="campo-email" className={etiqueta}>{t.campos.email}</label>
        <input id="campo-email" name="email" type="email" autoComplete="email" required aria-invalid={errores.has("email")} aria-describedby={ayuda("email")} className={campo} />
        {error("email")}
      </div>
      <div>
        <label htmlFor="campo-empresa" className={etiqueta}>{t.campos.empresa}</label>
        <input id="campo-empresa" name="empresa" autoComplete="organization" required aria-invalid={errores.has("empresa")} aria-describedby={ayuda("empresa")} className={campo} />
        {error("empresa")}
      </div>
      <div>
        <label htmlFor="campo-sitio" className={etiqueta}>{t.campos.sitio}</label>
        <input id="campo-sitio" name="sitio" type="url" inputMode="url" autoComplete="url" placeholder="https://" aria-invalid={errores.has("sitio")} aria-describedby={ayuda("sitio")} className={campo} />
        {error("sitio")}
      </div>
      <div>
        <label htmlFor="campo-pais" className={etiqueta}>{t.campos.pais}</label>
        <select id="campo-pais" name="pais" required defaultValue="" aria-invalid={errores.has("pais")} aria-describedby={ayuda("pais")} className={campo}>
          <option value="" disabled>{t.elegir}</option>
          {Object.entries(t.paises).map(([codigo, nombre]) => (
            <option key={codigo} value={codigo}>{nombre}</option>
          ))}
        </select>
        {error("pais")}
      </div>
      <div>
        <label htmlFor="campo-tamano" className={etiqueta}>{t.campos.tamano}</label>
        <select id="campo-tamano" name="tamano" required defaultValue="" aria-invalid={errores.has("tamano")} aria-describedby={ayuda("tamano")} className={campo}>
          <option value="" disabled>{t.elegir}</option>
          {TAMANOS.map((v) => (
            <option key={v} value={v}>{t.tamanos[v]}</option>
          ))}
        </select>
        {error("tamano")}
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="campo-presupuesto" className={etiqueta}>{t.campos.presupuesto}</label>
        <select id="campo-presupuesto" name="presupuesto" required defaultValue="" aria-invalid={errores.has("presupuesto")} aria-describedby={ayuda("presupuesto")} className={campo}>
          <option value="" disabled>{t.elegir}</option>
          {PRESUPUESTOS.map((v) => (
            <option key={v} value={v}>{t.presupuestos[v]}</option>
          ))}
        </select>
        {error("presupuesto")}
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="campo-necesidad" className={etiqueta}>{t.campos.necesidad}</label>
        <p id="ayuda-necesidad" className="mb-1 text-sm text-suave">{t.ayudas.necesidad}</p>
        <textarea id="campo-necesidad" name="necesidad" rows={4} required aria-invalid={errores.has("necesidad")} aria-describedby={["ayuda-necesidad", ayuda("necesidad")].filter(Boolean).join(" ")} className={`${campo} py-2`} />
        {error("necesidad")}
      </div>
      <div className="sm:col-span-2">
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input id="campo-consentimiento" name="consentimiento" type="checkbox" value="si" required aria-invalid={errores.has("consentimiento")} aria-describedby={ayuda("consentimiento")} className="mt-0.5 size-5 accent-pino-700" />
          <span>{t.campos.consentimiento}</span>
        </label>
        {error("consentimiento")}
      </div>
      <div className="sm:col-span-2">
        <button type="submit" disabled={enviando} className="min-h-12 rounded-panel bg-pino-700 px-6 font-titulo text-base font-bold text-blanco hover:bg-pino-800 disabled:opacity-70">
          {enviando ? t.enviando : t.enviar}
        </button>
      </div>
    </form>
  );
}
