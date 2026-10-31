// CRM en memoria (tests y modo local sin cuenta de HubSpot). Aplica las mismas reglas de unicidad que HubSpot
// (email del contacto, dominio de la empresa), así se puede medir que el embudo no crea duplicados.
// Con `archivo`, guarda el estado en JSON (modo local: la app y el reporte lo leen).
import fs from "node:fs";
import path from "node:path";
import type { Crm, DatosContacto, DatosDeal, DatosEmpresa, DatosTarea } from "./tipos";

export interface EstadoCrm {
  contactos: (DatosContacto & { id: string; empresaId?: string })[];
  empresas: (DatosEmpresa & { id: string })[];
  deals: (DatosDeal & { id: string; abierto: boolean })[];
  tareas: (DatosTarea & { id: string })[];
}

const vacio = (): EstadoCrm => ({ contactos: [], empresas: [], deals: [], tareas: [] });

export function crearCrmMemoria(opciones: { archivo?: string } = {}): Crm & { estado: () => EstadoCrm } {
  const cargar = (): EstadoCrm => (opciones.archivo && fs.existsSync(opciones.archivo) ? (JSON.parse(fs.readFileSync(opciones.archivo, "utf8")) as EstadoCrm) : vacio());
  const estado = cargar();
  const guardar = () => {
    if (!opciones.archivo) return;
    fs.mkdirSync(path.dirname(opciones.archivo), { recursive: true });
    fs.writeFileSync(opciones.archivo, JSON.stringify(estado, null, 2));
  };
  const nuevoId = (prefijo: string, lista: unknown[]) => `${prefijo}-${String(lista.length + 1).padStart(3, "0")}`;

  return {
    nombre: opciones.archivo ? "CRM local (archivo)" : "CRM en memoria",
    estado: () => structuredClone(estado),

    async upsertContacto(d) {
      const existente = estado.contactos.find((c) => c.email === d.email);
      if (existente) {
        Object.assign(existente, d);
        guardar();
        return { id: existente.id, creado: false };
      }
      const id = nuevoId("con", estado.contactos);
      estado.contactos.push({ ...d, id });
      guardar();
      return { id, creado: true };
    },

    async upsertEmpresa(d) {
      const existente = estado.empresas.find((e) => e.dominio === d.dominio);
      if (existente) return { id: existente.id, creado: false };
      const id = nuevoId("emp", estado.empresas);
      estado.empresas.push({ ...d, id });
      guardar();
      return { id, creado: true };
    },

    async asociarContactoEmpresa(contactoId, empresaId) {
      const c = estado.contactos.find((x) => x.id === contactoId);
      if (c) c.empresaId = empresaId;
      guardar();
    },

    async dealAbiertoDe(contactoId) {
      return estado.deals.find((d) => d.contactoId === contactoId && d.abierto)?.id ?? null;
    },

    async crearDeal(d: DatosDeal) {
      const id = nuevoId("deal", estado.deals);
      estado.deals.push({ ...d, id, abierto: true });
      guardar();
      return id;
    },

    async crearTarea(d: DatosTarea) {
      const id = nuevoId("tar", estado.tareas);
      estado.tareas.push({ ...d, id });
      guardar();
      return id;
    },

    async contarDemo() {
      return { contactos: estado.contactos.length, empresas: estado.empresas.length, deals: estado.deals.length, tareas: estado.tareas.length };
    },
  };
}
