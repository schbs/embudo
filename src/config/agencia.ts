// Datos fijos de "Nodo Growth", agencia ficticia de marketing B2B. Todo es de demostración.
// La rúbrica que justifica los umbrales y los tiers esperados de los fixtures está en docs/icp.md.

export const ZONA_AGENCIA = "America/Argentina/Buenos_Aires";

/** Horario hábil para calcular los vencimientos de seguimiento (lunes a viernes). */
export const HORARIO_HABIL = { desde: 9, hasta: 18 } as const;

/** Umbrales del score de la IA: A ≥ 75, B 45–74, C < 45. */
export const UMBRALES = { A: 75, B: 45 } as const;

/** Horas hábiles para el primer contacto según el tier. */
export const SLA_HORAS_HABILES = { A: 2, B: 9, C: 27 } as const;

/** Reparto de los 40 leads de prueba (tests/fixtures/leads.json), que muestra la landing como ejemplo. */
export const MUESTRA_FIXTURES = { A: 12, B: 14, C: 14 } as const;

export const TAMANOS =["1-10", "11-50", "51-200", "201-500", "501+"] as const;
export const PRESUPUESTOS = ["<1k", "1k-3k", "3k-10k", "10k+", "no_sabe"] as const;
export const FUENTES = ["web", "linkedin", "referido", "evento", "ads"] as const;

/** Países donde la agencia trabaja con su equipo de LATAM. */
export const PAISES_LATAM = ["AR", "BR", "UY", "CL", "PY", "BO", "PE", "CO", "EC", "VE", "MX", "CR", "PA", "GT", "DO"] as const;

export interface Owner {
  id: string;
  nombre: string;
  /** Qué leads le tocan, en palabras (lo usa el resumen de Slack). */
  cubre: string;
}

// Personas ficticias.
export const OWNERS = {
  cuentasGrandes: { id: "owner-cuentas-grandes", nombre: "Valentina Ruiz", cubre: "empresas de 201 empleados o más, de cualquier país" },
  latam: { id: "owner-latam", nombre: "Martín Ojeda", cubre: "empresas de hasta 200 empleados en Latinoamérica" },
  global: { id: "owner-global", nombre: "Julia Becker", cubre: "empresas de hasta 200 empleados fuera de Latinoamérica" },
} as const satisfies Record<string, Owner>;

/**
 * Casillas personales: un lead con una de estas no se deduplica por dominio (miles de personas comparten gmail.com).
 * En los fixtures de la demo, `example.com` hace de casilla personal para no usar direcciones que podrían existir.
 */
export const DOMINIOS_PERSONALES = [
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "yandex.com",
  "example.com",
] as const;

/** Casillas descartables: un lead con una de estas se marca como spam antes de la IA. */
export const DOMINIOS_DESCARTABLES = ["mailinator.com", "yopmail.com", "guerrillamail.com", "10minutemail.com", "tempmail.com", "trashmail.com"] as const;
