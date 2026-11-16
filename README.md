# jamiederooij.com

A plain HTML/CSS/JS site with an upload portal at `/admin`. Hosting is free on Netlify.

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

## Going live (one time, about 15 minutes)

1. **GitHub.** Create a free account, then the repository `jamie-de-rooij`. Upload all files in this folder to it (Add file → Upload files).
2. **Portal settings.** Already set: `admin/config.yml` points at `JamiedeRooij/jamie-de-rooij`.
3. **Netlify.** Create a free account → Add new site → Import from Git → pick the repo. No build command; publish directory is `.`.
4. **Portal login.** In GitHub: Settings → Developer settings → OAuth Apps → New OAuth App.
   - Homepage URL: your Netlify URL
   - Callback URL: `https://api.netlify.com/auth/done`
   Copy the Client ID and secret into Netlify: Site configuration → Access & security → OAuth → Install provider → GitHub.
5. **Domain.** Netlify → Domain management → Add `jamiederooij.com` and follow the DNS steps at your domain registrar.

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
