/* jamiederooij.com
   Content comes from content/*.json, which the upload portals (/admin) edit. */

const $ = (s) => document.querySelector(s);
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Smaller versions of Framer-hosted images; other URLs are used as they are.
function sized(url, px) {
  if (!url) return url;
  if (url.includes("framerusercontent.com/images/") && !url.includes("?")) {
    return `${url}?scale-down-to=${px}`;
  }
  return url;
}

async function getJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

/* ============ LIGHT / DARK MODE ============ */
function initTheme() {
  const btn = $("#themeToggle");
  const root = document.documentElement;
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  const current = () => root.getAttribute("data-theme") || (system.matches ? "dark" : "light");
  const label = () => { btn.textContent = current() === "dark" ? "Light" : "Dark"; };
  btn.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
    label();
  });
  system.addEventListener("change", label);
  label();
}

/* ============ HERO: name fits the width ============ */
function fitName() {
  const span = $("#heroName");
  const h1 = span.parentElement;
  h1.style.fontSize = "100px";
  const w = span.getBoundingClientRect().width;
  const target = h1.clientWidth - 8;
  if (w > 0) h1.style.fontSize = `${(100 * target) / w}px`;
}

/* ============ HERO: poster trail on the cursor ============ */
function initTrail(images) {
  const layer = $("#trail");
  if (!images.length || reduceMotion) return;

  const urls = images.map((u) => sized(u, 512));
  urls.forEach((u) => { const i = new Image(); i.src = u; });

  const SPACING = 80;       // px of mouse travel between posters
  const VISIBLE_MS = 500;   // how long a poster stays before leaving
  const EASE = "cubic-bezier(.22,1,.36,1)";
  let last = null;
  let index = 0;

  function spawn(x, y) {
    const img = document.createElement("img");
    img.className = "trail-item";
    img.src = urls[index % urls.length];
    img.alt = "";
    index++;
    const w = window.innerWidth < 810 ? 140 : 200;
    const h = w * 1.25;
    const base = `translate(${x - w / 2}px, ${y - h / 2}px)`;
    layer.appendChild(img);

    const inAnim = img.animate(
      [
        { opacity: 0, transform: `${base} scale(.5) rotateX(50deg)`, filter: "blur(5px)" },
        { opacity: 1, transform: `${base} scale(1) rotateX(0deg)`, filter: "blur(0px)" },
      ],
      { duration: 450, easing: EASE, fill: "forwards" }
    );
    setTimeout(() => {
      const out = img.animate(
        [
          { opacity: 1, transform: `${base} scale(1)`, filter: "blur(0px)" },
          { opacity: 0, transform: `${base} scale(.5)`, filter: "blur(10px)" },
        ],
        { duration: 400, easing: EASE, fill: "forwards" }
      );
      out.onfinish = () => { inAnim.cancel(); img.remove(); };
    }, VISIBLE_MS);
  }

  window.addEventListener("pointermove", (e) => {
    if (window.scrollY > window.innerHeight * 0.6) { last = null; return; }
    const p = { x: e.clientX, y: e.clientY };
    if (!last) { last = p; return; }
    if (Math.hypot(p.x - last.x, p.y - last.y) >= SPACING) {
      spawn(p.x, p.y);
      last = p;
    }
  }, { passive: true });
}

/* ============ SELECTED WORKS: masonry ============ */
function columnsForWidth() {
  const w = window.innerWidth;
  if (w < 810) return 1;
  if (w < 1200) return 2;
  return 3;
}

// Width / height of a project's image or video, so its space is reserved before it loads.
function measure(project) {
  return new Promise((resolve) => {
    const done = (r) => { clearTimeout(timer); resolve(r && isFinite(r) && r > 0 ? r : 0.75); };
    const timer = setTimeout(() => done(0), 6000);
    if (project.video) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      v.onloadedmetadata = () => done(v.videoWidth / v.videoHeight);
      v.onerror = () => done(0);
      v.src = project.video;
    } else if (project.image) {
      const i = new Image();
      i.onload = () => done(i.naturalWidth / i.naturalHeight);
      i.onerror = () => done(0);
      i.src = sized(project.image, 1024);
    } else {
      done(0);
    }
  });
}

function buildCard(p, ratio, videoObserver) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "card";
  card.setAttribute("aria-label", `Open ${p.title}`);

  const media = document.createElement("div");
  media.className = "card-media";
  media.style.aspectRatio = String(ratio);

  if (p.video) {
    const v = document.createElement("video");
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.autoplay = true;
    v.preload = "metadata";
    v.setAttribute("muted", "");
    if (p.image) v.poster = sized(p.image, 1024);
    v.src = p.video;
    media.appendChild(v);
    if (videoObserver) videoObserver.observe(v);
  } else {
    const img = document.createElement("img");
    img.src = sized(p.image, 1024);
    img.alt = p.title || "";
    img.loading = "lazy";
    img.decoding = "async";
    media.appendChild(img);
  }

  const caption = document.createElement("div");
  caption.className = "card-caption";
  const t = document.createElement("span");
  t.className = "card-title";
  t.textContent = p.title || "";
  caption.appendChild(t);
  if (p.subtitle) {
    const s = document.createElement("span");
    s.className = "card-sub";
    s.textContent = p.subtitle;
    caption.appendChild(s);
  }
  card.append(media, caption);
  card.addEventListener("click", () => openLightbox(p));
  return card;
}

function initMasonry(projects) {
  const root = $("#masonry");
  const CAPTION_PX = 86; // caption + gap under each image

  // Thumbnail videos only play while they are on screen.
  const videoObserver = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        entries.forEach(({ target, isIntersecting }) => {
          if (isIntersecting) target.play().catch(() => {});
          else target.pause();
        });
      }, { rootMargin: "200px" })
    : null;

  const items = projects.map((p) => ({ p, ratio: 0, el: null, placed: false }));
  const pending = items.map((it) => measure(it.p).then((r) => { it.ratio = r; }));

  let cols = [];
  let heights = [];
  let count = 0;

  function build() {
    count = columnsForWidth();
    root.innerHTML = "";
    cols = [];
    heights = new Array(count).fill(0);
    for (let i = 0; i < count; i++) {
      const c = document.createElement("div");
      c.className = "masonry-col";
      root.appendChild(c);
      cols.push(c);
    }
  }

  // Each card goes into whichever column is shortest at that moment.
  function place(it) {
    if (!it.el) it.el = buildCard(it.p, it.ratio, videoObserver);
    let k = 0;
    for (let i = 1; i < count; i++) if (heights[i] < heights[k] - 0.5) k = i;
    cols[k].appendChild(it.el);
    const w = cols[k].clientWidth || 400;
    heights[k] += w / it.ratio + CAPTION_PX;
    it.placed = true;
  }

  build();
  (async () => {
    for (let i = 0; i < items.length; i++) {
      await pending[i];        // keeps the order of the list in the portal
      place(items[i]);
    }
  })();

  window.addEventListener("resize", () => {
    if (columnsForWidth() === count) return;
    build();
    items.filter((it) => it.placed).forEach(place);
  });
}

/* ============ LIGHTBOX ============ */
const lb = $("#lightbox");
let lastFocus = null;

function openLightbox(p) {
  lastFocus = document.activeElement;
  const media = $("#lightboxMedia");
  media.innerHTML = "";
  if (p.video) {
    const v = document.createElement("video");
    v.src = p.video;
    v.controls = true;
    v.autoplay = true;
    v.loop = true;
    v.playsInline = true;
    if (p.image) v.poster = sized(p.image, 2048);
    media.appendChild(v);
  } else if (p.image) {
    const img = document.createElement("img");
    img.src = sized(p.image, 2048);
    img.alt = p.title || "";
    media.appendChild(img);
  }
  $("#lbTitle").textContent = p.title || "";
  $("#lbSub").textContent = p.subtitle || "";
  $("#lbDesc").textContent = (p.description || "").trim();
  lb.hidden = false;
  document.body.classList.add("locked");
  requestAnimationFrame(() => lb.classList.add("open"));
  $("#lightboxClose").focus();
}

function closeLightbox() {
  lb.classList.remove("open");
  document.body.classList.remove("locked");
  const v = lb.querySelector("video");
  if (v) v.pause();
  setTimeout(() => { lb.hidden = true; $("#lightboxMedia").innerHTML = ""; }, 250);
  if (lastFocus) lastFocus.focus();
}

lb.addEventListener("click", (e) => {
  const inner = $("#lightboxInner");
  if (e.target === inner || !inner.contains(e.target)) closeLightbox();
});
$("#lightboxClose").addEventListener("click", (e) => { e.stopPropagation(); closeLightbox(); });
window.addEventListener("keydown", (e) => { if (e.key === "Escape" && !lb.hidden) closeLightbox(); });

/* ============ POSTER WALL: endless ticker ============ */
function initTicker(images) {
  const track = $("#tickerTrack");
  if (!images.length) return;
  const make = () => images.map((u) => {
    const img = document.createElement("img");
    img.src = sized(u, 1024);
    img.alt = "";
    img.decoding = "async";
    img.draggable = false;
    return img;
  });
  [...make(), ...make()].forEach((el) => track.appendChild(el)); // two sets = seamless loop

  const SPEED = 100; // px per second
  let x = 0;
  let prev = performance.now();
  let setWidth = 0;
  const measureSet = () => { setWidth = track.scrollWidth / 2; };
  track.addEventListener("load", measureSet, true);
  window.addEventListener("resize", measureSet);
  measureSet();

  if (reduceMotion) { $("#ticker").style.overflowX = "auto"; return; }
  function tick(now) {
    const dt = Math.min(64, now - prev) / 1000;
    prev = now;
    if (setWidth > 0) {
      x -= SPEED * dt;
      if (-x >= setWidth) x += setWidth;
      track.style.transform = `translate3d(${x}px,0,0)`;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ============ FOOTER: cycling services ============ */
function initServices() {
  const el = $("#service");
  const words = ["Branding", "Webdesign", "Framer development", "Art direction", "Visual design", "Print design", "Presentations", "Social media"];
  let i = 0;
  setInterval(() => {
    i = (i + 1) % words.length;
    if (reduceMotion) { el.textContent = words[i]; return; }
    el.classList.add("out");
    setTimeout(() => { el.textContent = words[i]; el.classList.remove("out"); }, 400);
  }, 2000);
}

/* ============ BOOT ============ */
initTheme();
initServices();
$("#year").textContent = new Date().getFullYear();
fitName();
window.addEventListener("resize", fitName);
if (document.fonts) document.fonts.ready.then(fitName);

Promise.all([
  getJSON("content/trail.json").catch(() => ({ posters: [] })),
  getJSON("content/projects.json").catch(() => ({ projects: [] })),
  getJSON("content/wall.json").catch(() => ({ posters: [] })),
]).then(([trail, work, wall]) => {
  initTrail((trail.posters || []).map((p) => p.image).filter(Boolean));
  initMasonry((work.projects || []).filter((p) => p.image || p.video));
  initTicker((wall.posters || []).map((p) => p.image).filter(Boolean));
});
