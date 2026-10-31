import { crearManejadorLeads } from "@/api/leads";
import { dependencias } from "@/pipeline/dependencias";

export const POST = crearManejadorLeads({ token: () => process.env.N8N_WEBHOOK_TOKEN, deps: () => dependencias() });
