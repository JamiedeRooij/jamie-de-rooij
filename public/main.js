/* jamiederooij.com
   Content comes from content/*.json, which the three upload portals edit:
   trail.json (hero poster trail), works.json (masonry), wall.json (poster wall). */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canHover = window.matchMedia("(hover: hover)").matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Sizes and web copies of every upload (content/media.json, made by tools/optimize-media.py).
let MEDIA = {};
const DPR = Math.min(2, window.devicePixelRatio || 1);
const webPath = (url, w, poster) => `uploads/_web/${url.slice(8)}${poster ? ".poster" : ""}-${w}.webp`;
const pick = (list, px) => list.find((w) => w >= px * DPR) || list[list.length - 1];

// The smallest web copy that is still sharp at `px` CSS pixels wide; other URLs are used as they are.
function sized(url, px) {
  if (!url) return url;
  const m = MEDIA[url];
  if (m && m.v && m.v.length) return webPath(url, pick(m.v, px));
  if (url.includes("framerusercontent.com/images/") && !url.includes("?")) return `${url}?scale-down-to=${px}`;
  return url;
}
// All web copies of an image, for srcset, so each screen downloads only what it needs.
function srcsetFor(url) {
  const m = MEDIA[url];
  return m && m.v && m.v.length > 1 ? m.v.map((w) => `${webPath(url, w)} ${w}w`).join(", ") : "";
}
function posterFor(url, px) {
  const m = MEDIA[url];
  return m && m.poster && m.poster.length ? webPath(url, pick(m.poster, px), true) : "";
}

async function getJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

/* ============ BIG NAME: always the full width of the page ============ */
function fitAll() {
  $$(".fit").forEach((el) => {
    const span = el.firstElementChild;
    el.style.fontSize = "100px";
    // offsetWidth ignores the scroll shrink on the hero name; measuring the shrunken
    // name made it come back too big after scrolling down and up again.
    const w = span.offsetWidth;
    if (w > 0) el.style.fontSize = `${(100 * (el.clientWidth - 4)) / w}px`;
  });
}

/* ============ HERO: blurs and shrinks as the page slides over it ============
   Same numbers as the Framer override: blur up to 15px and scale down to 0.6
   over the first 25% of the page scroll. */
function initHeroScroll() {
  const hero = $("#hero");
  const name = $("#heroName");
  if (reduceMotion) return;
  let ticking = false;
  function update() {
    ticking = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = clamp(window.scrollY / (max * 0.25 || 1), 0, 1);
    hero.style.visibility = window.scrollY > window.innerHeight ? "hidden" : "visible";
    name.style.filter = p > 0 ? `blur(${(15 * p).toFixed(2)}px)` : "none";
    name.style.transform = `scale(${(1 - 0.4 * p).toFixed(4)})`;
  }
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

/* ============ POSTER TRAIL on the cursor: in the hero and in the footer ============ */
function initTrail(images) {
  if (!images.length || reduceMotion || !canHover) return;

  const urls = images.map((u) => sized(u, 280));
  urls.forEach((u) => { const i = new Image(); i.src = u; });

  const SPACING = 80;       // px of mouse travel between posters
  const VISIBLE_MS = 500;   // how long a poster stays before leaving
  let index = 0;            // one shared sequence, so both places continue the same series

  // Each place has its own layer. The hero layer is fixed to the screen; the footer
  // layer scrolls with the footer, so posters are placed relative to it.
  const hero = $("#trail");
  const footer = $("#footerTrail");
  const zones = [
    hero && { layer: hero, active: () => window.scrollY < window.innerHeight * 0.6 },
    footer && {
      layer: footer,
      // only around the big "de Rooij", not over the columns of text above it
      active: (x, y) => {
        const r = $(".footer-name").getBoundingClientRect();
        return y >= r.top - 40 && y <= r.bottom && x >= r.left && x <= r.right;
      },
    },
  ].filter(Boolean);
  let zone = null, last = null;

  // The footer layer starts just under the four columns, so posters are cut off there.
  function placeFooterLayer() {
    const top = $(".footer-top");
    if (!footer || !top) return;
    footer.style.top = `${top.offsetTop + top.offsetHeight + 24}px`;
  }
  placeFooterLayer();
  window.addEventListener("resize", placeFooterLayer);
  if (document.fonts) document.fonts.ready.then(placeFooterLayer);

  function spawn(layer, x, y) {
    const r = layer.getBoundingClientRect();
    x -= r.left; y -= r.top;
    const img = document.createElement("img");
    img.className = "trail-item";
    img.src = urls[index++ % urls.length];
    img.alt = "";
    const base = `translate(calc(${x}px - 50%), calc(${y}px - 50%))`;
    layer.appendChild(img);
    const ease = "cubic-bezier(.22,1,.36,1)";
    const inAnim = img.animate(
      [
        { opacity: 0, transform: `${base} scale(.5) rotateX(50deg)`, filter: "blur(5px)" },
        { opacity: 1, transform: `${base} scale(1) rotateX(0deg)`, filter: "blur(0px)" },
      ],
      { duration: 450, easing: ease, fill: "forwards" }
    );
    setTimeout(() => {
      const out = img.animate(
        [
          { opacity: 1, transform: `${base} scale(1)`, filter: "blur(0px)" },
          { opacity: 0, transform: `${base} scale(.5)`, filter: "blur(10px)" },
        ],
        { duration: 400, easing: ease, fill: "forwards" }
      );
      out.onfinish = () => { inAnim.cancel(); img.remove(); };
    }, VISIBLE_MS);
  }

  window.addEventListener("pointermove", (e) => {
    const p = { x: e.clientX, y: e.clientY };
    const z = zones.find((z) => z.active(p.x, p.y)) || null;
    if (z !== zone) { zone = z; last = null; }
    if (!zone) return;
    if (!last) { last = p; return; }
    if (Math.hypot(p.x - last.x, p.y - last.y) >= SPACING) { spawn(zone.layer, p.x, p.y); last = p; }
  }, { passive: true });
}

/* ============ WORKS ============ */
// One shape for every kind of item: { type, title, description, url, profession, media: [{image|video}] }
function normalize(w) {
  const type = w.type || (w.slides && w.slides.length ? "slideshow" : w.video ? "video" : "image");
  let media = [];
  if (type === "slideshow") {
    media = (w.slides || []).map((s) => (typeof s === "string" ? s : s && s.image)).filter(Boolean).map((image) => ({ image }));
  } else if (type === "video" && w.video) {
    media = [{ video: w.video, poster: w.image || "" }];
  } else if (w.image) {
    media = [{ image: w.image }];
  }
  return {
    type,
    title: w.title || "",
    description: (w.description || "").trim(),
    url: (w.url || "").trim(),
    profession: w.profession || w.subtitle || "",
    media,
  };
}

function measure(m) {
  const known = MEDIA[m.video || m.image];
  if (known && known.w && known.h) return Promise.resolve(known.w / known.h);
  return new Promise((resolve) => {
    const done = (r) => { clearTimeout(timer); resolve(r && isFinite(r) && r > 0 ? r : 0.8); };
    const timer = setTimeout(() => done(0), 6000);
    if (m.video) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      v.onloadedmetadata = () => done(v.videoWidth / v.videoHeight);
      v.onerror = () => done(0);
      v.src = m.video;
    } else {
      const i = new Image();
      i.onload = () => done(i.naturalWidth / i.naturalHeight);
      i.onerror = () => done(0);
      i.src = sized(m.image, 1024);
    }
  });
}

// Marks an image or video once it has loaded, so CSS can fade it in.
function loaded(el, event) {
  const done = () => el.classList.add("is-loaded");
  el.addEventListener(event, done, { once: true });
  el.addEventListener("error", done, { once: true });
}

function mediaElement(m, size, opts = {}) {
  if (m.video) {
    const v = document.createElement("video");
    v.muted = !opts.sound;
    v.loop = true;
    v.playsInline = true;
    v.autoplay = !!opts.sound;
    if (!opts.sound) v.setAttribute("muted", "");
    if (opts.sound) v.controls = true;
    const still = m.poster ? sized(m.poster, size) : posterFor(m.video, size);
    // with a still to show, the video itself only loads once it is about to play
    v.preload = still && !opts.sound ? "none" : "metadata";
    if (still) {
      v.poster = still;
      const i = new Image();
      i.onload = i.onerror = () => v.classList.add("is-loaded");
      i.src = still;
    }
    loaded(v, "loadeddata");
    v.src = m.video;
    return v;
  }
  const img = document.createElement("img");
  img.alt = opts.alt || "";
  img.decoding = "async";
  if (opts.lazy) img.loading = "lazy";
  loaded(img, "load");
  const set = opts.sizes && srcsetFor(m.image);
  if (set) { img.sizes = opts.sizes; img.srcset = set; }
  img.src = sized(m.image, size);
  return img;
}

// Slideshow: stacked slides that cross-fade, plus the pill of toggles.
function buildSlides(holder, media, size, alt, sizes) {
  const slides = media.map((m, i) => {
    const el = mediaElement(m, size, { alt, lazy: i > 0, sizes });
    el.classList.add("slide");
    holder.appendChild(el);
    return el;
  });
  const dots = document.createElement("div");
  dots.className = "dots";
  const buttons = media.map((_, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dot";
    b.setAttribute("aria-label", `Slide ${i + 1} of ${media.length}`);
    b.addEventListener("click", (e) => { e.stopPropagation(); api.go(i); api.restart(); });
    dots.appendChild(b);
    return b;
  });
  let current = -1;
  let timer = 0;
  const api = {
    dots,
    go(i) {
      current = (i + media.length) % media.length;
      slides.forEach((s, k) => s.classList.toggle("on", k === current));
      buttons.forEach((b, k) => b.classList.toggle("on", k === current));
    },
    next() { api.go(current + 1); },
    start() { if (!timer && !reduceMotion) timer = setInterval(api.next, 4000); },
    stop() { clearInterval(timer); timer = 0; },
    restart() { api.stop(); api.start(); },
  };
  api.go(0);
  return api;
}

function initWorks(raw) {
  const root = $("#masonry");
  const works = raw.map(normalize).filter((w) => w.media.length);
  const columnsFor = () => (window.innerWidth < 810 ? 1 : window.innerWidth < 1200 ? 2 : 3);

  // Videos and slideshows only run while they are on screen.
  const live = new Map();
  const liveObserver = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      const ctl = live.get(target);
      if (!ctl) return;
      if (isIntersecting) ctl.start(); else ctl.stop();
    });
  }, { rootMargin: "150px" });

  // Cards fade in slowly as they enter the screen, one shortly after another.
  const revealObserver = new IntersectionObserver((entries) => {
    entries.filter((e) => e.isIntersecting).forEach((e, i) => {
      e.target.style.transitionDelay = `${i * 0.12}s`;
      e.target.classList.add("in");
      setTimeout(() => { e.target.style.transitionDelay = ""; }, 2100 + i * 120);
      revealObserver.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px" });

  function buildCard(w, index, ratio) {
    const card = document.createElement("div");
    card.className = "card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Open ${w.title}`);

    const media = document.createElement("div");
    media.className = "card-media";
    media.style.aspectRatio = String(ratio);
    card.appendChild(media);

    if (w.type === "slideshow" && w.media.length > 1) {
      const show = buildSlides(media, w.media, 640, w.title, "(max-width: 809.98px) 100vw, (max-width: 1199.98px) 50vw, 34vw");
      card.appendChild(show.dots);
      card.classList.add("has-dots");
      live.set(card, show);
      liveObserver.observe(card);
    } else {
      const el = mediaElement(w.media[0], 640, { alt: w.title, lazy: true, sizes: "(max-width: 809.98px) 100vw, (max-width: 1199.98px) 50vw, 34vw" });
      media.appendChild(el);
      if (w.media[0].video) {
        live.set(card, { start: () => el.play().catch(() => {}), stop: () => el.pause() });
        liveObserver.observe(card);
      }
    }

    const title = document.createElement("span");
    title.className = "card-title";
    title.textContent = w.title;
    card.appendChild(title);

    card.addEventListener("click", () => openLightbox(works, index));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLightbox(works, index); }
    });
    return card;
  }

  // Masonry: each card goes into whichever column is shortest at that moment.
  const items = works.map((w, index) => ({ w, index, ratio: 0, el: null, placed: false }));
  const pending = items.map((it) => measure(it.w.media[0]).then((r) => { it.ratio = r; }));
  let cols = [], heights = [], count = 0;

  function build() {
    count = columnsFor();
    root.innerHTML = "";
    heights = new Array(count).fill(0);
    cols = heights.map(() => {
      const c = document.createElement("div");
      c.className = "masonry-col";
      root.appendChild(c);
      return c;
    });
  }
  function place(it) {
    if (!it.el) { it.el = buildCard(it.w, it.index, it.ratio); revealObserver.observe(it.el); }
    let k = 0;
    for (let i = 1; i < count; i++) if (heights[i] < heights[k] - 0.5) k = i;
    cols[k].appendChild(it.el);
    heights[k] += (cols[k].clientWidth || 400) / it.ratio + 20;
    it.placed = true;
  }
  build();
  (async () => {
    for (let i = 0; i < items.length; i++) { await pending[i]; place(items[i]); }
  })();
  window.addEventListener("resize", () => {
    if (columnsFor() === count) return;
    build();
    items.filter((it) => it.placed).forEach(place);
  });

  // Hover: the hovered card shows its title, the rest go slightly blurry at 90%.
  // While scrolling nothing is highlighted.
  if (canHover) {
    let scrolling = false, timer = 0, hovered = null;
    const setHover = (card) => {
      if (card === hovered) return;
      if (hovered) hovered.classList.remove("is-hover");
      hovered = card;
      if (hovered) hovered.classList.add("is-hover");
      root.classList.toggle("hovering", !!hovered);
    };
    root.addEventListener("pointermove", (e) => { if (!scrolling) setHover(e.target.closest(".card")); });
    root.addEventListener("pointerleave", () => setHover(null));
    window.addEventListener("scroll", () => {
      scrolling = true;
      setHover(null);
      clearTimeout(timer);
      timer = setTimeout(() => { scrolling = false; }, 160);
    }, { passive: true });
  }
}

/* ============ LIGHTBOX ============ */
const lb = $("#lightbox");
let lbWorks = [], lbIndex = 0, lbShow = null, lastFocus = null;

function renderLightbox() {
  const w = lbWorks[lbIndex];
  const stage = $("#lbStage");
  if (lbShow) lbShow.stop();
  lbShow = null;
  stage.innerHTML = "";
  const frame = document.createElement("div");
  frame.className = "lb-frame";
  stage.appendChild(frame);

  if (w.type === "slideshow" && w.media.length > 1) {
    // the first slide sets the size; the others fade over it
    const sizer = mediaElement(w.media[0], 1600, { alt: w.title });
    sizer.style.visibility = "hidden";
    frame.appendChild(sizer);
    lbShow = buildSlides(frame, w.media, 1600, w.title);
    frame.appendChild(lbShow.dots);
    frame.style.cursor = "pointer";
    frame.addEventListener("click", () => { lbShow.next(); });
  } else {
    frame.appendChild(mediaElement(w.media[0], 1600, { alt: w.title, sound: true }));
  }

  $("#lbTitle").textContent = w.title;
  $("#lbDesc").textContent = noWidow(w.description);
  $("#lbProf").textContent = w.profession;
  const link = $("#lbUrl");
  link.hidden = !w.url;
  if (w.url) link.href = /^https?:\/\//i.test(w.url) ? w.url : `https://${w.url}`;
  $("#lbTop").hidden = !w.description;
  $("#lbTop").scrollTop = 0;
  fitStage();
  const many = lbWorks.length > 1;
  $("#lbPrev").hidden = !many;
  $("#lbNext").hidden = !many;
}

// The image may only use the space between the description and the bottom row.
function fitStage() {
  if (lb.hidden) return;
  const stage = $("#lbStage");
  const desc = $("#lbTop");
  lb.classList.toggle("no-desc", desc.hidden);
  stage.style.removeProperty("--stage-h");
  stage.style.removeProperty("--stage-y");
  requestAnimationFrame(() => {
    // On phones the description is above the image: keep the image centred by using
    // the same margin at the top and the bottom, large enough to clear the text.
    if (window.innerWidth < 810) {
      const space = parseFloat(getComputedStyle(lb).getPropertyValue("--space")) || 16;
      const info = lb.querySelector(".lb-info");
      const top = desc.hidden ? 0 : desc.offsetTop + desc.offsetHeight + space;
      const bottom = lb.clientHeight - info.offsetTop + space;   // the two-line bottom row
      const needed = Math.max(top, bottom);
      if (needed > stage.offsetTop) stage.style.setProperty("--stage-y", `${needed}px`);
    }
    requestAnimationFrame(() => stage.style.setProperty("--stage-h", `${stage.clientHeight}px`));
  });
}
window.addEventListener("resize", fitStage);

function openLightbox(works, index) {
  lbWorks = works;
  lbIndex = index;
  lastFocus = document.activeElement;
  lb.hidden = false;
  renderLightbox();
  document.body.classList.add("locked");
  if (lenis) lenis.stop();
  requestAnimationFrame(() => lb.classList.add("open"));
  $("#lbClose").focus({ preventScroll: true });
}
function closeLightbox() {
  lb.classList.remove("open");
  document.body.classList.remove("locked");
  if (lenis) lenis.start();
  if (lbShow) lbShow.stop();
  const v = $("video", lb);
  if (v) v.pause();
  setTimeout(() => { lb.hidden = true; $("#lbStage").innerHTML = ""; }, 400);
  if (lastFocus) lastFocus.focus({ preventScroll: true });
}
function stepLightbox(d) {
  lbIndex = (lbIndex + d + lbWorks.length) % lbWorks.length;
  renderLightbox();
}

$("#lbClose").addEventListener("click", closeLightbox);
$("#lbPrev").addEventListener("click", () => stepLightbox(-1));
$("#lbNext").addEventListener("click", () => stepLightbox(1));
lb.addEventListener("click", (e) => { if (e.target === lb || e.target === $("#lbStage")) closeLightbox(); });
window.addEventListener("keydown", (e) => {
  if (lb.hidden) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") stepLightbox(-1);
  if (e.key === "ArrowRight") stepLightbox(1);
});
// swipe left/right on touch screens
let touchX = null;
lb.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
lb.addEventListener("touchend", (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) > 60 && lbWorks.length > 1) stepLightbox(dx < 0 ? 1 : -1);
}, { passive: true });

/* ============ POSTER WALL: each new poster gently pushes the first one out ============ */
function initWall(images) {
  const track = $("#wallTrack");
  if (!images.length) return;
  let list = images.slice();
  while (list.length < 6) list = list.concat(images);   // enough posters to loop
  list.forEach((u) => {
    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.draggable = false;
    loaded(img, "load");
    const set = srcsetFor(u);
    if (set) { img.sizes = "(max-width: 809.98px) 50vw, 33vw"; img.srcset = set; }
    img.src = sized(u, 640);
    track.appendChild(img);
  });
  const stepSize = () => track.firstElementChild.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0);

  if (reduceMotion) {
    const wall = $("#wall");
    wall.style.overflowX = "auto";
    $("#wallPrev").addEventListener("click", () => wall.scrollBy({ left: -stepSize() }));
    $("#wallNext").addEventListener("click", () => wall.scrollBy({ left: stepSize() }));
    return;
  }

  const HOLD = 450, MOVE = 1300;   // short pause between pushes, so it reads as one slow flow
  const CLICK = 650;                // the arrows move quicker than the automatic flow
  const ease = "cubic-bezier(.65, 0, .35, 1)";
  let timer = 0, moving = false, visible = false, phase = null, done = 0;
  const currentX = () => new DOMMatrix(getComputedStyle(track).transform).m41 || 0;

  // A click while the row is moving takes over from wherever it is right now.
  function settle() {
    if (!moving) return;
    clearTimeout(done);
    const x = currentX();
    track.style.transition = "none";
    if (phase === "next") { track.appendChild(track.firstElementChild); track.style.transform = `translate3d(${x + stepSize()}px, 0, 0)`; }
    else track.style.transform = `translate3d(${x}px, 0, 0)`;
    track.getBoundingClientRect();
    moving = false;
  }

  // Forward: the whole row slides one poster to the left, then the first goes to the back.
  function next(ms = MOVE) {
    settle();
    moving = true; phase = "next";
    track.style.transition = `transform ${ms}ms ${ms === MOVE ? ease : "cubic-bezier(.22, 1, .36, 1)"}`;
    track.style.transform = `translate3d(${-stepSize()}px, 0, 0)`;
    done = setTimeout(() => {
      track.style.transition = "none";
      track.appendChild(track.firstElementChild);
      track.style.transform = "translate3d(0, 0, 0)";
      moving = false;
    }, ms + 40);
  }
  // Back: the last poster is put in front just out of view, then the row slides right.
  function prev(ms = CLICK) {
    settle();
    const x = currentX();
    moving = true; phase = "prev";
    track.style.transition = "none";
    track.insertBefore(track.lastElementChild, track.firstElementChild);
    track.style.transform = `translate3d(${x - stepSize()}px, 0, 0)`;
    track.getBoundingClientRect();   // apply that position before animating
    track.style.transition = `transform ${ms}ms cubic-bezier(.22, 1, .36, 1)`;
    track.style.transform = "translate3d(0, 0, 0)";
    done = setTimeout(() => { moving = false; }, ms + 40);
  }
  function restart() {
    clearInterval(timer);
    timer = visible ? setInterval(() => next(), HOLD + MOVE) : 0;
  }
  // After a click the automatic flow waits a moment before it carries on.
  let resume = 0;
  function manual(fn) {
    clearInterval(timer); timer = 0;
    clearTimeout(resume);
    fn(CLICK);
    resume = setTimeout(restart, 2500);
  }
  $("#wallPrev").addEventListener("click", () => manual(prev));
  $("#wallNext").addEventListener("click", () => manual(next));

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    clearTimeout(resume);
    restart();
  }, { threshold: 0.25 }).observe($("#wall"));
}

/* ============ PHONE MENU ============ */
function initMenu() {
  const menu = $("#mMenu"), open = $("#burger"), close = $("#mClose");
  if (!menu || !open) return;
  const set = (on) => {
    menu.classList.toggle("open", on);
    menu.setAttribute("aria-hidden", String(!on));
    menu.inert = !on;
    open.setAttribute("aria-expanded", String(on));
    // the page behind stays still while the menu is open
    document.documentElement.style.overflow = on ? "hidden" : "";
    if (lenis) on ? lenis.stop() : lenis.start();
    if (on) close.focus({ preventScroll: true }); else if (menu.contains(document.activeElement)) open.focus({ preventScroll: true });
  };
  open.addEventListener("click", () => set(true));
  close.addEventListener("click", () => set(false));
  // a link closes the menu and then goes where it points
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => set(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && menu.classList.contains("open")) set(false); });
  document.addEventListener("click", (e) => {
    if (menu.classList.contains("open") && !menu.contains(e.target) && !open.contains(e.target)) set(false);
  });
}

/* ============ SMALL THINGS ============ */
// "Last updated": the moment the current version of the site went live, Amsterdam time.
async function initUpdated() {
  try {
    const res = await fetch("api/updated", { cache: "no-cache" });
    const { updated } = await res.json();
    const when = new Date(updated);
    if (!updated || isNaN(when)) return;
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Amsterdam", day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(when).map((p) => [p.type, p.value]));
    $$(".js-updated").forEach((el) => {
      el.textContent = `${parts.day}/${parts.month}/${parts.year}, ${parts.hour}:${parts.minute}`;
      el.dateTime = when.toISOString();
    });
    $$(".js-updated-line").forEach((el) => { el.hidden = false; });
  } catch (e) { /* leave the line hidden */ }
}

function initClock() {
  const fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Amsterdam" });
  const tick = () => $$(".js-clock").forEach((el) => { el.textContent = fmt.format(new Date()); });
  tick();
  setInterval(tick, 15000);
}

// Text marked data-split is cut into words that come in one after another (the live site's text effect).
function splitText() {
  const blocks = $$("[data-split]");
  blocks.forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    // the last two words stay together, so a line never ends on a single word
    const tail = document.createElement("span");
    tail.className = "nw";
    words.forEach((word, i) => {
      const span = document.createElement("span");
      span.className = "w";
      span.textContent = word;
      span.style.setProperty("--i", Math.min(i, 44));
      const last = i === words.length - 1;
      if (words.length > 3 && i >= words.length - 2) {
        tail.append(span, last ? "" : " ");
        if (last) el.append(tail);
      } else {
        el.append(span, last ? "" : " ");
      }
    });
  });
}

// Ties the last two words of a text together with a non-breaking space.
const noWidow = (text) => (text.trim().split(/\s+/).length > 3 ? text.replace(/\s+(\S+)\s*$/, "\u00a0$1") : text);

function initReveal() {
  $$(".row-text p, .row h3, .footer-list li").forEach((el) => {
    const node = el.lastChild;
    if (node && node.nodeType === 3) node.textContent = noWidow(node.textContent);
  });
  if (!reduceMotion) splitText();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -24px 0px" });
  $$("[data-reveal], [data-split]").forEach((el) => io.observe(el));
}

/* ============ SMOOTH SCROLLING ============
   Lenis eases the wheel/trackpad scroll (the live Framer site uses it too).
   Touch screens keep their native scrolling. */
let lenis = null;
function initSmoothScroll() {
  if (reduceMotion || typeof Lenis === "undefined") return;
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, anchors: false });
  const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  // menu links glide to their section
  $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const target = document.querySelector(a.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { duration: 1.6 });
  }));
}

/* ============ BOOT ============ */
initClock();
initMenu();
initUpdated();
initReveal();
$("#year").textContent = new Date().getFullYear();
fitAll();
window.addEventListener("resize", fitAll);
if (document.fonts) document.fonts.ready.then(fitAll);
initHeroScroll();
initSmoothScroll();

Promise.all([
  getJSON("content/media.json").then((m) => { MEDIA = m || {}; }).catch(() => {}),
  getJSON("content/trail.json").catch(() => ({ posters: [] })),
  getJSON("content/works.json").catch(() => ({ works: [] })),
  getJSON("content/wall.json").catch(() => ({ posters: [] })),
]).then(([, trail, works, wall]) => {
  const images = (d) => (d.posters || []).map((p) => (typeof p === "string" ? p : p.image)).filter(Boolean);
  initTrail(images(trail));
  initWorks(works.works || []);
  initWall(images(wall));
});
