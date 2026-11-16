# jamiederooij.com

A plain HTML/CSS/JS site with an upload portal at `/admin`. Hosting is free on Cloudflare.

```
public/                          the website itself
  index.html, style.css, main.js
  content/trail.json             hero poster trail
  content/works.json             Works (masonry + lightbox): images, videos, slideshows
  content/wall.json              Poster wall
  uploads/                       images and videos you upload through the portals
  admin/                         the upload portals (Decap CMS)
  portal/                        one page linking to the three portals
worker.js, src/                  the portals' GitHub login (Cloudflare Worker)
wrangler.jsonc                   Cloudflare settings
tools/fetch-media.mjs            copies your Framer-hosted media into public/uploads/
```

## Going live on Cloudflare

1. **Cloudflare.** dash.cloudflare.com → Workers & Pages → Create application → import the `jamie-de-rooij` repository. Keep the default deploy command (`npx wrangler deploy`).
2. **Portal login.** On GitHub: Settings → Developer settings → OAuth Apps → New OAuth App.
   - Homepage URL: your site address
   - Callback URL: `https://YOUR-SITE/api/callback`
   In Cloudflare: the Worker → Settings → Variables and Secrets → add `GITHUB_CLIENT_ID` (text) and `GITHUB_CLIENT_SECRET` (secret).
3. **Domain.** The Worker → Settings → Domains & Routes → add `jamiederooij.com` and `www.jamiederooij.com`. Then change the OAuth App's two URLs to the real domain.

Then open **jamiederooij.com/portal**, pick a portal and log in with GitHub: **Poster trail**, **Poster wall** or **Works**. Changes are live about a minute after you press Publish.

## Before cancelling Framer

Your current images still load from Framer's servers. Run this once (needs Node 18+), then upload the new `public/uploads/` folder and `public/content/` files to GitHub:

```
node tools/fetch-media.mjs
```

## Previewing on your own computer

```
npx decap-server        # in one terminal: lets the portal work locally
npx serve .             # in another: serves the site
```
Site: http://localhost:3000 · Portal: http://localhost:3000/admin
