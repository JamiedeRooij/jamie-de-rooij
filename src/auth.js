// Portal login, step 1 (used by worker.js and by functions/api/auth.js on Pages).
// The upload portals open this address in a popup; it sends you to GitHub to log in.
// Needs two values set in Cloudflare (Settings → Variables and Secrets):
//   GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET, from a GitHub OAuth App whose
//   callback URL is https://YOUR-SITE/api/callback
export async function onRequestGet({ request, env }) {
  if (!env.GITHUB_CLIENT_ID) {
    return new Response("Portal login is not set up yet: GITHUB_CLIENT_ID is missing in Cloudflare.", { status: 500 });
  }
  const origin = new URL(request.url).origin;
  const state = crypto.randomUUID();
  const github = new URL("https://github.com/login/oauth/authorize");
  github.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  github.searchParams.set("redirect_uri", `${origin}/api/callback`);
  github.searchParams.set("scope", "repo");
  github.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: github.toString(),
      // remembered for ten minutes, to check that the answer belongs to this login
      "Set-Cookie": `portal_state=${state}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      "Cache-Control": "no-store",
    },
  });
}
