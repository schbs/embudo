// E2E con Playwright sobre el build de producción, usando Brave (ya instalado: no se descargan navegadores).
// El servidor de prueba corre en modo local, sin IA (no gasta cuota de Gemini) y con su propia carpeta de datos.
import path from "node:path";
import { defineConfig } from "@playwright/test";

const BRAVE = process.env.BRAVE_PATH ?? path.join(process.env.LOCALAPPDATA ?? "", "BraveSoftware/Brave-Browser/Application/brave.exe");
export const DIR_DATOS_E2E = path.join(process.cwd(), "test-results", "datos-e2e");

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/preparar.ts",
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3212",
    launchOptions: { executablePath: BRAVE },
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
  },
  webServer: {
    command: "npx next start -p 3212",
    url: "http://localhost:3212",
    reuseExistingServer: false,
    timeout: 60_000,
    // Variables vacías: Next no las pisa con .env.local, así el e2e no llama a Gemini, HubSpot, Slack ni n8n.
    env: { EMBUDO_DIR_DATOS: DIR_DATOS_E2E, GEMINI_API_KEY: "", HUBSPOT_PRIVATE_APP_TOKEN: "", SLACK_BOT_TOKEN: "", N8N_WEBHOOK_URL: "" },
  },
  projects: [
    { name: "celular", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "compu", use: { viewport: { width: 1440, height: 900 } }, testMatch: /accesibilidad\.spec\.ts/ },
  ],
});
