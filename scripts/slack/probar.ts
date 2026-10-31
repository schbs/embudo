// Manda un solo mensaje de prueba al canal de leads para confirmar el token, el canal y que el bot esté invitado.
// Uso: npm run slack:probar
import { crearAvisadorSlack } from "../../src/slack/cliente";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sin archivo: falla abajo
}

const token = process.env.SLACK_BOT_TOKEN;
const canal = process.env.SLACK_CANAL_LEADS;
if (!token || !canal) {
  console.error("Faltan SLACK_BOT_TOKEN o SLACK_CANAL_LEADS (npm run check-env).");
  process.exit(1);
}

const texto = "Embudo: prueba de conexión (demo, datos ficticios).";
crearAvisadorSlack({ token, canal })
  .publicar({ text: texto, blocks: [{ type: "section", text: { type: "mrkdwn", text: `:white_check_mark: ${texto}` } }] })
  .then(({ ts }) => console.log(`✓ mensaje publicado en el canal (ts ${ts})`))
  .catch((e: unknown) => {
    const m = e instanceof Error ? e.message : String(e);
    console.error(m.includes("not_in_channel") ? "El bot no está en el canal: en #leads escribí /invite @Embudo" : `Falló: ${m}`);
    process.exit(1);
  });
