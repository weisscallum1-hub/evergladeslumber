import { onRequest, onRequestPost } from "./functions/api/scout.js";
import { onRequest as intakeOptions, onRequestPost as receiveIntake } from "./functions/api/intake.js";
import { handleAdmin } from "./functions/api/admin.js";
import { handlePublicConfig } from "./functions/api/config.js";

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/api/intake") {
        if (request.method === "POST") return receiveIntake({ request, env, ctx });
        return intakeOptions({ request });
      }
      if (url.pathname === "/api/config") return handlePublicConfig(request, env);
      if (url.pathname.startsWith("/api/admin/") || url.pathname === "/api/suppliers") {
        return handleAdmin(request, env);
      }
      if (url.pathname === "/api/scout") {
        if (request.method === "POST") return onRequestPost({ request, env });
        return onRequest({ request });
      }
      return env.ASSETS.fetch(request);
    } catch {
      return new Response(JSON.stringify({ error: "The service could not complete this request. Please try again." }), {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
      });
    }
  },
};
