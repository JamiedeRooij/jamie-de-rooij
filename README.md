# jamiederooij.com

A plain HTML/CSS/JS site with an upload portal at `/admin`. Hosting is free on Cloudflare Pages.

```
index.html, style.css, main.js   the site
content/trail.json               hero poster trail
content/works.json               Works (masonry + lightbox): images, videos, slideshows
content/wall.json                Poster Wall
uploads/                         images and videos you upload through the portal
admin/                           the upload portals (Decap CMS)
portal/                          one page linking to the three portals
tools/fetch-media.mjs            copies your Framer-hosted media into uploads/
```

## Going live on Cloudflare Pages

1. **Cloudflare.** dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git → pick `jamie-de-rooij`. No framework, no build command, output directory empty. Deploy.
2. **Portal login.** On GitHub: Settings → Developer settings → OAuth Apps → New OAuth App.
   - Homepage URL: your site address
   - Callback URL: `https://YOUR-SITE/api/callback`
   In Cloudflare: your Pages project → Settings → Variables and Secrets → add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` (as a secret), then redeploy.
   The login itself is in `functions/api/auth.js` and `functions/api/callback.js`.
3. **Domain.** Pages project → Custom domains → add `jamiederooij.com` and `www.jamiederooij.com`, and follow the DNS steps. Then change the OAuth App's two URLs to the real domain.

Then open **jamiederooij.com/portal**, pick a portal and log in with GitHub: **Poster trail**, **Poster wall** or **Works**. Changes are live about a minute after you press Publish.

## Before cancelling Framer

Your current images still load from Framer's servers. Run this once (needs Node 18+), then upload the new `uploads/` folder and `content/` files to GitHub:

```
node tools/fetch-media.mjs
```

## Previewing on your own computer

```
npx decap-server        # in one terminal: lets the portal work locally
npx serve .             # in another: serves the site
```
Site: http://localhost:3000 · Portal: http://localhost:3000/admin
