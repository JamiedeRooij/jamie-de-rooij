/* Jamie de Rooij — site script
   Content comes from /content/*.json, which the upload portal (/admin) edits. */

const $ = (s) => document.querySelector(s);
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Smaller versions of Framer-hosted images; other URLs are used as-is.
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

/* ============ HERO: name fits the width ============ */
function fitName() {
  const span = $("#heroName");
  const h1 = span.parentElement;
  h1.style.fontSize = "100px";
  const w = span.getBoundingClientRect().width;
  const target = h1.clientWidth - 8; // tiny safety margin for overhang
  if (w > 0) h1.style.fontSize = `${(100 * target) / w}px`;
}

/* ============ HERO: poster trail on the cursor ============ */
function initTrail(images) {
  const layer = $("#trail");
  if (!images.length || reduceMotion) return;

  const urls = images.map((u) => sized(u, 512));
  urls.forEach((u) => { const i = new Image(); i.src = u; }); // preload

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
    // only while the hero is (mostly) on screen
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

// Resolve each project's media aspect ratio (width / height) before placing it.
function measure(project) {
  return new Promise((resolve) => {
    const done = (r) => resolve(r && isFinite(r) && r > 0 ? r : 0.75);
    const timer = setTimeout(() => done(0.75), 5000);
    if (project.video) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      v.onloadedmetadata = () => { clearTimeout(timer); done(v.videoWidth / v.videoHeight); };
      v.onerror = () => { clearTimeout(timer); done(0.75); };
      v.src = project.video;
    } else if (project.image) {
      const i = new Image();
      i.onload = () => { clearTimeout(timer); done(i.naturalWidth / i.naturalHeight); };
      i.onerror = () => { clearTimeout(timer); done(0.75); };
      i.src = sized(project.image, 1024);
    } else {
      clearTimeout(timer); done(0.75);
    }
  });
}

function buildCard(p, ratio) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "card";
  card.setAttribute("aria-label", `Open ${p.title}`);

  const media = document.createElement("div");
  media.className = "card-media";
  media.style.aspectRatio = String(ratio);

  if (p.video) {
    const v = document.createElement("video");
    v.src = p.video;
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.autoplay = true;
    v.preload = "metadata";
    if (p.image) v.poster = sized(p.image, 1024);
    v.setAttribute("muted", "");
    media.appendChild(v);
  } else if (p.image) {
    const img = document.createElement("img");
    img.src = sized(p.image, 1024);
    img.alt = p.title || "";
    img.loading = "lazy";
    img.decoding = "async";
    media.appendChild(img);
  }

  const caption = document.createElement("div");
  caption.className = "card-caption";
  const t = document.createElement("p");
  t.className = "card-title";
  t.textContent = p.title || "";
  caption.appendChild(t);
  if (p.subtitle) {
    const s = document.createElement("p");
    s.className = "card-sub";
    s.textContent = p.subtitle;
    caption.appendChild(s);
  }
  card.append(media, caption);
  card.addEventListener("click", () => openLightbox(p));
  return card;
}

async function initMasonry(projects) {
  const root = $("#masonry");
  const ratios = await Promise.all(projects.map(measure));
  const cards = projects.map((p, i) => ({ el: buildCard(p, ratios[i]), ratio: ratios[i] }));

  // Play thumbnail videos only while visible.
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        entries.forEach(({ target, isIntersecting }) => {
          if (isIntersecting) target.play().catch(() => {});
          else target.pause();
        });
      }, { rootMargin: "200px" })
    : null;
  cards.forEach(({ el }) => { const v = el.querySelector("video"); if (v && io) io.observe(v); });

  let current = 0;
  function layout() {
    const n = columnsForWidth();
    if (n === current) return;
    current = n;
    root.innerHTML = "";
    const cols = Array.from({ length: n }, () => {
      const c = document.createElement("div");
      c.className = "masonry-col";
      root.appendChild(c);
      return c;
    });
    // Each card goes to the currently shortest column (heights in "column widths").
    const heights = new Array(n).fill(0);
    const CAPTION = 0.12; // caption + gap, relative to column width
    cards.forEach(({ el, ratio }) => {
      let k = 0;
      for (let i = 1; i < n; i++) if (heights[i] < heights[k] - 0.001) k = i;
      cols[k].appendChild(el);
      heights[k] += 1 / ratio + CAPTION;
    });
  }
  layout();
  window.addEventListener("resize", layout);
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
    if (p.image) v.poster = p.image;
    media.appendChild(v);
  } else if (p.image) {
    const img = document.createElement("img");
    img.src = sized(p.image, 2048);
    img.alt = p.title || "";
    media.appendChild(img);
  }
  $("#lbTitle").textContent = p.title || "";
  $("#lbSub").textContent = p.subtitle || "";
  $("#lbDesc").textContent = p.description || "";
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

lb.addEventListener("click", (e) => { if (!$("#lightboxInner").contains(e.target) || e.target === $("#lightboxInner")) closeLightbox(); });
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
  // two identical sets → seamless loop
  [...make(), ...make()].forEach((el) => track.appendChild(el));

  const SPEED = 100; // px per second, leftwards
  let x = 0;
  let prev = performance.now();
  let setWidth = 0;
  const measureSet = () => { setWidth = track.scrollWidth / 2; };
  track.addEventListener("load", measureSet, true);
  window.addEventListener("resize", measureSet);
  measureSet();

  if (reduceMotion) return;
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

/* ============ BOOT ============ */
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
