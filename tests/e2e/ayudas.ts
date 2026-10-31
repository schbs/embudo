import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** axe con reglas WCAG 2.1 AA: no tiene que haber violaciones serias ni críticas. */
export async function revisarAccesibilidad(page: Page, nombre: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const graves = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  console.log(`  axe → ${nombre}: ${r.passes.length} reglas OK, ${r.violations.length} violaciones (${graves.length} serias o críticas)`);
  expect(graves.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}

/** Completa el formulario con un lead ficticio válido (espera 3 s: el formulario rechaza envíos más rápidos). */
export async function completarFormulario(page: Page, en = false) {
  const c = en
    ? { nombre: "Full name *", email: "Work email *", empresa: "Company *", pais: "Country *", tamano: "Company size *", presupuesto: "Monthly budget (USD) *", necesidad: "What do you need? *", consentimiento: /I agree/ }
    : { nombre: "Nombre y apellido *", email: "Email de trabajo *", empresa: "Empresa *", pais: "País *", tamano: "Tamaño de la empresa *", presupuesto: "Presupuesto mensual (USD) *", necesidad: "¿Qué necesitás? *", consentimiento: /Acepto/ };
  await page.getByLabel(c.nombre, { exact: true }).fill("Prueba Automática");
  await page.getByLabel(c.email, { exact: true }).fill("prueba.e2e@empresa-prueba.example.com");
  await page.getByLabel(c.empresa, { exact: true }).fill("Empresa de Prueba");
  await page.getByLabel(c.pais, { exact: true }).selectOption("AR");
  await page.getByLabel(c.tamano, { exact: true }).selectOption("51-200");
  await page.getByLabel(c.presupuesto, { exact: true }).selectOption("3k-10k");
  await page.getByLabel(c.necesidad, { exact: true }).fill("Campañas de LinkedIn y SEO para generar demos con gerentes de compras.");
  await page.getByLabel(c.consentimiento).check();
  await page.waitForTimeout(3100);
}
