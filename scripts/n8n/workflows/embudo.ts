// Workflow "Embudo - Leads" escrito en código (skill n8n-workflow-standards). Recorrido:
// Webhook del formulario → compara el SHA-256 del token → responde 202 enseguida → POST /api/leads de la app (que
// califica, carga HubSpot y avisa en Slack) con reintentos → agrega la fila al registro en Google Sheets.
// Si la app falla después de los reintentos, avisa en Slack. En n8n no se guarda ningún secreto: el token llega en el
// encabezado del formulario y se reenvía tal cual a la app; en el workflow solo está su hash.
export interface ConfigN8n {
  prefijo: string;
  carpeta_id: string;
  app_url: string;
  webhook_path: string;
  token_hash: string;
  sheets_log_id: string;
  slack_canal: string;
}

const pos = (x: number, y: number): [number, number] => [x, y];

export function construir(c: ConfigN8n) {
  const nodos = [
    {
      id: "webhook",
      name: "Recibir lead del formulario",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: pos(0, 0),
      webhookId: "embudo-lead",
      parameters: { httpMethod: "POST", path: c.webhook_path, responseMode: "responseNode", options: {} },
    },
    {
      id: "hash",
      name: "Calcular hash del token",
      type: "n8n-nodes-base.crypto",
      typeVersion: 1,
      position: pos(220, 0),
      parameters: { action: "hash", type: "SHA256", value: "={{ $json.headers['x-embudo-token'] ?? '' }}", dataPropertyName: "hashToken" },
    },
    {
      id: "token-ok",
      name: "¿Token válido?",
      type: "n8n-nodes-base.if",
      typeVersion: 2.2,
      position: pos(440, 0),
      parameters: {
        conditions: {
          options: { caseSensitive: true, typeValidation: "strict", version: 2 },
          combinator: "and",
          conditions: [{ id: "c1", leftValue: "={{ $json.hashToken }}", rightValue: c.token_hash, operator: { type: "string", operation: "equals" } }],
        },
        options: {},
      },
    },
    {
      id: "r202",
      name: "Responder 202",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1,
      position: pos(660, -100),
      parameters: { respondWith: "json", responseBody: '={{ { "ok": true } }}', options: { responseCode: 202 } },
    },
    {
      id: "r401",
      name: "Responder 401",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1,
      position: pos(660, 120),
      parameters: { respondWith: "json", responseBody: '={{ { "ok": false } }}', options: { responseCode: 401 } },
    },
    {
      id: "app",
      name: "Procesar lead en la app",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: pos(880, -100),
      retryOnFail: true,
      maxTries: 3,
      waitBetweenTries: 2000,
      onError: "continueErrorOutput",
      parameters: {
        method: "POST",
        url: `${c.app_url}/api/leads`,
        sendHeaders: true,
        headerParameters: { parameters: [{ name: "x-embudo-token", value: "={{ $('Recibir lead del formulario').item.json.headers['x-embudo-token'] }}" }] },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ JSON.stringify($('Recibir lead del formulario').item.json.body) }}",
        options: { timeout: 30000 },
      },
    },
    {
      id: "fila",
      name: "Armar fila del registro",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: pos(1100, -160),
      parameters: { mode: "raw", jsonOutput: "={{ $json.fila }}", options: {} },
    },
    {
      id: "sheets",
      name: "Agregar al registro en Sheets",
      type: "n8n-nodes-base.googleSheets",
      typeVersion: 4.5,
      position: pos(1320, -160),
      credentials: { googleSheetsOAuth2Api: { name: "Google Sheets account" } },
      parameters: {
        operation: "append",
        documentId: { __rl: true, mode: "id", value: c.sheets_log_id },
        sheetName: { __rl: true, mode: "name", value: "registro" },
        columns: { mappingMode: "autoMapInputData", value: {} },
        options: {},
      },
    },
    {
      id: "falla",
      name: "Avisar falla en Slack",
      type: "n8n-nodes-base.slack",
      typeVersion: 2.3,
      position: pos(1100, 40),
      credentials: { slackApi: { name: "Slack - Embudo" } },
      parameters: {
        select: "channel",
        channelId: { __rl: true, mode: "id", value: c.slack_canal },
        text: "=⚠️ Embudo: no se pudo procesar un lead después de 3 intentos. Revisar la ejecución {{ $execution.id }} en n8n.",
        otherOptions: {},
      },
    },
  ];

  const conexiones = {
    "Recibir lead del formulario": { main: [[{ node: "Calcular hash del token", type: "main", index: 0 }]] },
    "Calcular hash del token": { main: [[{ node: "¿Token válido?", type: "main", index: 0 }]] },
    "¿Token válido?": { main: [[{ node: "Responder 202", type: "main", index: 0 }], [{ node: "Responder 401", type: "main", index: 0 }]] },
    "Responder 202": { main: [[{ node: "Procesar lead en la app", type: "main", index: 0 }]] },
    "Procesar lead en la app": { main: [[{ node: "Armar fila del registro", type: "main", index: 0 }], [{ node: "Avisar falla en Slack", type: "main", index: 0 }]] },
    "Armar fila del registro": { main: [[{ node: "Agregar al registro en Sheets", type: "main", index: 0 }]] },
  };

  return { name: `${c.prefijo}Leads`, nodes: nodos, connections: conexiones, settings: { executionOrder: "v1" } };
}
