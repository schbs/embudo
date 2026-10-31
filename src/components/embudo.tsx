// El gesto de la marca: el embudo A/B/C como barras horizontales que se angostan. Cada tier lleva su letra, su nombre
// y la cantidad (nunca solo el color).
import type { Tier } from "@/lead/routing";

const ESTILO: Record<Tier, { ancho: string; clase: string; barra: string }> = {
  A: { ancho: "w-full", clase: "bg-pino-700 text-blanco", barra: "barra" },
  B: { ancho: "w-[82%]", clase: "bg-ambar text-tinta", barra: "barra barra-b" },
  C: { ancho: "w-[64%]", clase: "bg-gris-50 text-gris ring-1 ring-inset ring-linea", barra: "barra barra-c" },
};

export function Embudo({ conteo, nombres, titulo }: { conteo: Record<Tier, number>; nombres: Record<Tier, string>; titulo: string }) {
  const total = conteo.A + conteo.B + conteo.C;
  return (
    <figure className="rounded-panel border border-linea bg-blanco p-5">
      <figcaption className="mb-4 font-titulo text-sm font-bold uppercase tracking-widest text-suave">{titulo}</figcaption>
      <ul className="flex flex-col gap-2">
        {(["A", "B", "C"] as Tier[]).map((tier) => (
          <li key={tier} className={`${ESTILO[tier].ancho} ${ESTILO[tier].barra}`}>
            <div className={`flex min-h-12 items-center justify-between gap-3 rounded-panel px-3 ${ESTILO[tier].clase}`}>
              <span className="font-titulo font-bold">
                {tier} · {nombres[tier]}
              </span>
              <span className="font-titulo text-xl font-bold tabular-nums">{conteo[tier]}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-right font-titulo text-sm font-bold tabular-nums text-suave">Σ {total}</p>
    </figure>
  );
}
