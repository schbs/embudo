// Antes de los e2e: carpeta de datos limpia y sembrada con los 40 leads de la demo (sin IA: respuestas grabadas).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export default function preparar() {
  const dir = path.join(process.cwd(), "test-results", "datos-e2e");
  fs.rmSync(dir, { recursive: true, force: true });
  execFileSync(process.execPath, [path.join("node_modules", "tsx", "dist", "cli.mjs"), "scripts/sembrar-demo.ts"], { env: { ...process.env, EMBUDO_DIR_DATOS: dir }, stdio: "inherit" });
}
