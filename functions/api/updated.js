// "Last updated" on Pages: the build writes the time of each publish into build.json.
export async function onRequestGet({ request, env }) {
  let updated = null;
  try {
    const res = await env.ASSETS.fetch(new URL("/build.json", request.url));
    if (res.ok) updated = (await res.json()).updated || null;
  } catch (e) {}
  return Response.json({ updated }, { headers: { "Cache-Control": "public, max-age=60" } });
}
