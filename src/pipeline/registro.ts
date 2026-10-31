// Registro de cada lead procesado: alimenta /reporte. En producción n8n lo agrega a Google Sheets con la fila que
// devuelve /api/leads; en modo local se guarda en data/dev/registro.jsonl. Sin email ni teléfono: solo lo del reporte.
import fs from "node:fs";
import path from "node:path";
import type { Tier } from "@/lead/routing";

export interface FilaRegistro {
  leadId: string;
  recibidoEn: string;
  procesadoEn: string;
  empresa: string;
  pais: string;
  tamano: string;
  presupuesto: string;
  fuente: string;
  tier: Tier;
  score: number;
  origen: "reglas" | "ia" | "respaldo";
  spam: boolean;
  duplicado: "email" | "dominio" | "nuevo";
  owner: string;
  venceEn: string;
  msTotal: number;
  estado: "nuevo" | "tomado" | "descartado";
  resueltoEn?: string;
}

export type ResultadoMarca = "marcado" | "ya_resuelto" | "no_encontrado";

export interface Registro {
  agregar(fila: FilaRegistro): Promise<void>;
  /** "no_encontrado" pasa en producción: cada función de Vercel tiene su propio /tmp. */
  marcar(leadId: string, estado: "tomado" | "descartado", en: string): Promise<ResultadoMarca>;
  leer(): Promise<FilaRegistro[]>;
}

export function crearRegistroMemoria(): Registro {
  const filas: FilaRegistro[] = [];
  return {
    async agregar(f) {
      filas.push(f);
    },
    async marcar(id, estado, en) {
      const f = filas.find((x) => x.leadId === id);
      if (!f) return "no_encontrado";
      if (f.estado !== "nuevo") return "ya_resuelto";
      Object.assign(f, { estado, resueltoEn: en });
      return "marcado";
    },
    async leer() {
      return structuredClone(filas);
    },
  };
}

export function crearRegistroArchivo(archivo: string): Registro {
  const leer = (): FilaRegistro[] =>
    fs.existsSync(archivo)
      ? fs.readFileSync(archivo, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as FilaRegistro)
      : [];
  const escribir = (filas: FilaRegistro[]) => {
    fs.mkdirSync(path.dirname(archivo), { recursive: true });
    fs.writeFileSync(archivo, filas.map((f) => JSON.stringify(f)).join("\n") + (filas.length ? "\n" : ""));
  };
  return {
    async agregar(f) {
      fs.mkdirSync(path.dirname(archivo), { recursive: true });
      fs.appendFileSync(archivo, JSON.stringify(f) + "\n");
    },
    async marcar(id, estado, en) {
      const filas = leer();
      const f = filas.find((x) => x.leadId === id);
      if (!f) return "no_encontrado";
      if (f.estado !== "nuevo") return "ya_resuelto";
      Object.assign(f, { estado, resueltoEn: en });
      escribir(filas);
      return "marcado";
    },
    async leer() {
      return leer();
    },
  };
}
