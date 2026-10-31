// Capturas del portfolio en 1280×800 (y una de celular), todas con datos ficticios.
// Uso: npm run build && npm run demo:sembrar && npm run capturas          (español → docs/capturas/)
//      npm run capturas -- en                                             (inglés, para Upwork → docs/capturas/en/)
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const IDIOMA = process.argv[2] === "en" ? "en" : "es";
const PREFIJO = IDIOMA === "en" ? "/en" : "";
const BASE = "http://localhost:3202";
const SALIDA = IDIOMA === "en" ? path.join("docs", "capturas", "en") : path.join("docs", "capturas");
const BRAVE = process.env.BRAVE_PATH ?? path.join(process.env.LOCALAPPDATA ?? "", "BraveSoftware/Brave-Browser/Application/brave.exe");

async function arriba() {
  try {
    return (await fetch(BASE)).ok;
  } catch {
    return false;
  }
}

async function main() {
  fs.mkdirSync(SALIDA, { recursive: true });
  let servidor: ChildProcess | null = null;
  if (!(await arriba())) {
    // Sin IA ni cuentas: las capturas no envían nada (el formulario solo se completa para mostrar los errores).
    servidor = spawn(process.execPath, [path.join("node_modules", "next", "dist", "bin", "next"), "start", "-p", "3202"], { stdio: "ignore", env: { ...process.env, GEMINI_API_KEY: "", N8N_WEBHOOK_URL: "" } });
    for (let i = 0; i < 60 && !(await arriba()); i++) await new Promise((r) => setTimeout(r, 500));
  }
  const navegador = await chromium.launch({ executablePath: BRAVE });
  try {
    const compu = await navegador.newPage({ viewport: { width: 1280, height: 800 }, locale: IDIOMA === "en" ? "en-US" : "es-AR", reducedMotion: "reduce" });
    await compu.goto(`${BASE}${PREFIJO || "/"}`);
    await compu.screenshot({ path: path.join(SALIDA, "01-landing.png") });
    await compu.goto(`${BASE}${PREFIJO}/#contacto`);
    await compu.waitForTimeout(3200);
    await compu.getByRole("button", { name: IDIOMA === "en" ? "Send inquiry" : "Enviar consulta" }).click();
    await compu.locator("#resumen-errores").waitFor();
    await compu.locator("#titulo-contacto").evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 24));
    await compu.screenshot({ path: path.join(SALIDA, "02-formulario-errores.png") });
    await compu.goto(`${BASE}${PREFIJO}/reporte`);
    await compu.screenshot({ path: path.join(SALIDA, "03-reporte.png") });

    const celular = await navegador.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: "reduce" });
    await celular.goto(`${BASE}${PREFIJO || "/"}`);
    await celular.screenshot({ path: path.join(SALIDA, "04-celular.png") });
  } finally {
    await navegador.close();
    servidor?.kill();
  }
  console.log(`capturas en ${SALIDA}: ${fs.readdirSync(SALIDA).filter((f) => f.endsWith(".png")).join(", ")}`);
}

void main().catch((e) => {
  console.error("Falló:", e instanceof Error ? e.message : e);
  process.exit(1);
});
