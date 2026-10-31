# ICP de Nodo Growth (agencia ficticia)

Rúbrica con la que se definen los tiers esperados de `tests/fixtures/leads.json` y que recibe la IA en el prompt.
Proyecto de demostración: la agencia, los leads y las empresas son ficticios.

## Qué vende Nodo Growth
Generación de demanda B2B: SEO, campañas pagas (LinkedIn y Google), account-based marketing, contenidos técnicos,
outbound y puesta a punto del CRM (HubSpot) con lead scoring. Contratos mensuales desde USD 3.000.

## Cliente ideal
Empresa **B2B** (software, servicios profesionales, industria, logística) de **11 a 500 empleados**, en Latinoamérica,
Estados Unidos o España, con **presupuesto mensual de USD 3.000 o más** y una necesidad de pipeline concreta y con fecha.

## Puntaje (0–100)
| Criterio | Puntos |
|---|---|
| Encaje de la empresa: B2B y 11–500 empleados | hasta 40 (B2B de 1–10 o 501+: 20; B2C: 10; sin empresa real: 0) |
| Presupuesto mensual | 10k+: 30 · 3k–10k: 25 · no sabe: 10 · 1k–3k: 10 · menos de 1k: 0 |
| Necesidad alineada con lo que vende la agencia | hasta 20 |
| Urgencia (fecha, presupuesto aprobado, "esta semana") | hasta 10 |

**Tier A:** 75 o más (prioridad, contacto en 2 h hábiles) · **Tier B:** 45 a 74 (1 día hábil) · **Tier C:** menos de 45
(nutrición, 3 días hábiles). Spam, búsquedas de trabajo, pasantías y pedidos fuera de lo que vende la agencia: C.

## Fixtures (40)
12 A, 14 B y 14 C. Incluyen 4 spam (detectados antes de la IA), 3 duplicados (dos por email, uno por dominio de
empresa) y casillas personales. Las casillas personales usan `@example.com` y las empresas, dominios `.example.com`
(reservados: no existen).
