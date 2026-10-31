import { expect, test } from "@playwright/test";
import { revisarAccesibilidad } from "./ayudas";

for (const ruta of ["/", "/reporte", "/en", "/en/reporte"]) {
  test(`axe sin violaciones graves: ${ruta}`, async ({ page }) => {
    await page.goto(ruta);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await revisarAccesibilidad(page, ruta);
  });
}

test("axe con los errores del formulario a la vista", async ({ page }) => {
  await page.goto("/#contacto");
  await page.waitForTimeout(3100);
  await page.getByRole("button", { name: "Enviar consulta" }).click();
  await expect(page.locator("#resumen-errores")).toBeVisible();
  await revisarAccesibilidad(page, "/ (formulario con errores)");
});
