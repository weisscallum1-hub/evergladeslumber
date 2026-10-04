import { onRequest, onRequestPost } from "./functions/api/scout.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/scout") {
      if (request.method === "POST") return onRequestPost({ request, env });
      return onRequest({ request });
    }
    return env.ASSETS.fetch(request);
  },
};
