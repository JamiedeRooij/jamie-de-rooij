// Cloudflare Worker for jamiederooij.com.
// The site itself is the static files in /public. This script only adds the two
// addresses the upload portals need to log in with GitHub; everything else is
// served straight from /public.
import { onRequestGet as auth } from "./src/auth.js";
import { onRequestGet as callback } from "./src/callback.js";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/api/auth") return auth({ request, env });
    if (request.method === "GET" && pathname === "/api/callback") return callback({ request, env });
    return env.ASSETS.fetch(request);
  },
};
