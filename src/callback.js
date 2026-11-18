// Portal login, step 2 (used by worker.js and by functions/api/callback.js on Pages).
// GitHub sends you back here after logging in. This swaps GitHub's one-time code for an
// access token and hands it to the portal window that opened the popup.
function page(status, payload) {
  // The portal (Decap CMS) expects this exact handshake over postMessage.
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  const html = `<!doctype html><meta charset="utf-8"><title>Signing in…</title>
<body style="font:16px system-ui;background:#131313;color:#f5f5f5;padding:24px">
<p>${status === "success" ? "Signed in. You can close this window." : "Sign-in failed. Close this window and try again."}</p>
<script>
(function () {
  var message = ${JSON.stringify(message)};
  if (!window.opener) return;
  window.addEventListener("message", function (e) {
    if (e.origin !== window.location.origin) return;   // only answer our own site
    window.opener.postMessage(message, e.origin);
  }, false);
  window.opener.postMessage("authorizing:github", window.location.origin);
})();
</script></body>`;
  return new Response(html, {
    status: status === "success" ? 200 : 400,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Set-Cookie": "portal_state=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    },
  });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)portal_state=([^;]+)/);

  if (!code) return page("error", { message: "GitHub did not return a login code." });
  if (!state || !cookie || cookie[1] !== state) return page("error", { message: "The login could not be verified. Please try again." });
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return page("error", { message: "GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET is missing in Cloudflare." });

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "jamiederooij-portal" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/api/callback`,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.access_token) return page("error", { message: data.error_description || "GitHub refused the login." });
  return page("success", { token: data.access_token, provider: "github" });
}
