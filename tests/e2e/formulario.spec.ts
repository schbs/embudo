import { expect, test } from "@playwright/test";
import { completarFormulario } from "./ayudas";

test("envío válido → mensaje de éxito anunciado", async ({ page }) => {
  await page.goto("/#contacto");
  await completarFormulario(page);
  await page.getByRole("button", { name: "Enviar consulta" }).click();
  const exito = page.getByRole("status");
  await expect(exito).toContainText("¡Recibimos tu consulta!");
  await expect(exito).toBeFocused();
});

test("envío vacío → resumen de errores, un error por campo y foco en el primero", async ({ page }) => {
  await page.goto("/#contacto");
  await page.waitForTimeout(3100);
  await page.getByRole("button", { name: "Enviar consulta" }).click();
  await expect(page.locator("#resumen-errores")).toHaveText("Hay 8 campos para revisar.");
  const nombre = page.getByLabel("Nombre y apellido *");
  await expect(nombre).toBeFocused();
  await expect(nombre).toHaveAttribute("aria-invalid", "true");
  await expect(nombre).toHaveAccessibleDescription("Escribí tu nombre.");
  await expect(page.getByText("Necesitamos tu consentimiento para contactarte.")).toBeVisible();
});

test("email inválido → solo marca el email", async ({ page }) => {
  await page.goto("/#contacto");
  await completarFormulario(page);
  await page.getByLabel("Email de trabajo *").fill("no-es-un-email");
  await page.getByRole("button", { name: "Enviar consulta" }).click();
  await expect(page.locator("#resumen-errores")).toHaveText("Hay 1 campo para revisar.");
  await expect(page.getByLabel("Email de trabajo *")).toBeFocused();
});

test("en inglés: envío válido → mensaje de éxito en inglés", async ({ page }) => {
  await page.goto("/en#contacto");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await completarFormulario(page, true);
  await page.getByRole("button", { name: "Send inquiry" }).click();
  await expect(page.getByRole("status")).toContainText("We got your inquiry!");
});

test("/reporte muestra los KPIs, la tabla por día y los últimos leads", async ({ page }) => {
  await page.goto("/reporte");
  await expect(page.getByRole("heading", { level: 1, name: "Reporte de leads" })).toBeVisible();
  await expect(page.getByText("Leads recibidos").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Leads por día y tier" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Últimos leads" })).toBeVisible();
  await page.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/reporte$/);
  await expect(page.getByRole("heading", { level: 1, name: "Lead report" })).toBeVisible();
});
