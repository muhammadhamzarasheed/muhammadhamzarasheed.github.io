/* The audit trail: HUD. Everything the reader sees outside the canvas
   lives in the DOM and speaks the ledger's language: mono figures,
   brass accents, UK English, no theatrics. */

const els = {};
const done = new Set();
let toastTimer = 0;
let toastFade = 0;
let paused = false;
let signed = false;

export function initHud() {
  els.count = document.getElementById("trailcount");
  els.tally = document.getElementById("trailtally");
  els.rcount = document.getElementById("trailrcount");
  els.csReceipts = document.getElementById("trailcsreceipts");
  els.toast = document.getElementById("trailtoast");
  els.toastNum = document.getElementById("trailtoastnum");
  els.toastTxt = document.getElementById("trailtoasttxt");
  els.link = document.getElementById("traillink");
  els.veil = document.getElementById("trailveil");
  els.cs = document.getElementById("trailcs");
  els.pause = document.getElementById("trailpause");
  els.resume = document.getElementById("trailresume");

  const drive = document.getElementById("trailcsdrive");
  if (drive) drive.addEventListener("click", dismissCountersign);
  if (els.resume) els.resume.addEventListener("click", () => setPaused(false));
}

/* First entry into a district settles it: the tally ticks over once,
   the eyebrow toast shows on every entry. Returns how many of the
   seven districts are reconciled so far. */
export function reconcile(index, title) {
  if (!done.has(index)) {
    done.add(index);
    if (els.count) {
      els.count.textContent = String(done.size).padStart(2, "0");
    }
  }
  if (els.toast) {
    els.toastNum.textContent = String(index).padStart(2, "0");
    els.toastTxt.textContent = " / " + title;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    clearTimeout(toastFade);
    requestAnimationFrame(() => els.toast.classList.add("on"));
    toastTimer = setTimeout(() => {
      els.toast.classList.remove("on");
      toastFade = setTimeout(() => { els.toast.hidden = true; }, 400);
    }, 2500);
  }
  return done.size;
}

export function reconciledCount() {
  return done.size;
}

/* A short pulse on the tally figure when a district first settles. */
export function pulseTally() {
  if (!els.tally) return;
  els.tally.classList.remove("pulse");
  void els.tally.offsetWidth;
  els.tally.classList.add("pulse");
}

/* The receipts counter, mono under the tally. Session only. */
export function setReceipts(n) {
  if (els.rcount) els.rcount.textContent = String(n).padStart(2, "0");
}

/* All fifteen gathered: the countersign gains its extra line. */
export function receiptsComplete() {
  if (els.csReceipts) els.csReceipts.hidden = false;
}

/* The one source of truth for which districts have reconciled; the
   minimap reads this set rather than keeping a copy of its own. */
export function reconciledSet() {
  return done;
}

export function showLinkPrompt(label) {
  if (!els.link) return;
  els.link.textContent = "Press E / tap to open " + label;
  els.link.hidden = false;
}

export function hideLinkPrompt() {
  if (els.link) els.link.hidden = true;
}

/* 07/07: the mark countersigns the page, drawn stroke by stroke by a
   plain CSS dashoffset transition. */
export function countersign() {
  if (signed || !els.cs) return;
  signed = true;
  els.cs.hidden = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => els.cs.classList.add("on"));
  });
  const drive = document.getElementById("trailcsdrive");
  if (drive) drive.focus();
}

export function dismissCountersign() {
  if (!els.cs || els.cs.hidden) return;
  els.cs.classList.remove("on");
  setTimeout(() => { els.cs.hidden = true; }, 450);
}

export function countersignOpen() {
  return !!els.cs && !els.cs.hidden;
}

/* Escape: a small pause card with the same doors as the fallback. */
export function setPaused(next) {
  paused = !!next;
  if (els.pause) {
    els.pause.hidden = !paused;
    if (paused && els.resume) els.resume.focus();
  }
}

export function togglePause() {
  setPaused(!paused);
}

export function isPaused() {
  return paused;
}

export function veilDone() {
  if (!els.veil) return;
  els.veil.classList.add("off");
  setTimeout(() => { els.veil.hidden = true; }, 500);
}

/* ---------- routing slip minimap ----------
   A little card in the corner reading like a routing slip: the loop as
   a brass hairline, seven numbered station ticks, the monogram at the
   centre, and the car as a brass arrow. North stays fixed; the drawing
   is diagram true to world coordinates, +x right and +z down. */

const MAP_SIZES = [148, 300];      /* normal, large, in CSS pixels */

const map = {
  el: null,
  canvas: null,
  ctx: null,
  mode: 0,                         /* 0 normal, 1 large, 2 folded */
  layout: [],
  labels: [],
  radius: 1,
  size: 0,
  dpr: 1,
  fs: 10,
  font: "",
};

/* The monogram strokes from the letterhead, in its 64 unit frame. */
const MAP_MONOGRAM = [
  [[12, 45], [12, 19], [22, 32], [32, 19], [32, 45]],
  [[52, 19], [52, 45]],
  [[36, 32], [52, 32]],
];

export function initMap(layout, roadRadius) {
  map.el = document.getElementById("trailmap");
  map.canvas = document.getElementById("trailmapcanvas");
  if (!map.el || !map.canvas) return;
  map.ctx = map.canvas.getContext("2d");
  map.layout = layout;
  map.labels = layout.map((unused, i) => String(i + 1).padStart(2, "0"));
  map.radius = roadRadius;
  sizeMapCanvas();
  /* Tapping or clicking the card walks the same states as the M key. */
  map.el.addEventListener("click", cycleMap);
  window.addEventListener("resize", () => {
    if (map.mode !== 2) sizeMapCanvas();
  });
}

function sizeMapCanvas() {
  const size = MAP_SIZES[map.mode === 1 ? 1 : 0];
  map.size = size;
  map.dpr = Math.min(window.devicePixelRatio || 1, 2);
  map.canvas.width = Math.round(size * map.dpr);
  map.canvas.height = Math.round(size * map.dpr);
  map.canvas.style.width = size + "px";
  map.canvas.style.height = size + "px";
  map.fs = Math.max(7, Math.min(13, Math.round(size * 0.05)));
  map.font = "500 " + map.fs + 'px "IBM Plex Mono", monospace';
}

/* M, or a tap on the card: normal, then large, then folded down to
   its caption. The caption stays on show so a tap can always bring
   the map back where there is no M key to press. */
export function cycleMap() {
  if (!map.el) return;
  map.mode = (map.mode + 1) % 3;
  map.el.classList.toggle("big", map.mode === 1);
  map.el.classList.toggle("folded", map.mode === 2);
  if (map.mode !== 2) sizeMapCanvas();
}

/* Redrawn each frame it is visible; skipped entirely when the card is
   folded or the tab is hidden. state: { x, z, heading, reconciledSet }. */
export function updateMap(state) {
  if (!map.ctx || map.mode === 2 || document.hidden) return;
  const c = map.ctx;
  const size = map.size;
  const half = size / 2;
  const pad = size * 0.14;
  const s = (half - pad) / map.radius;
  const ringR = map.radius * s;

  c.setTransform(map.dpr, 0, 0, map.dpr, 0, 0);
  c.clearRect(0, 0, size, size);
  c.lineCap = "round";
  c.lineJoin = "round";

  /* The ring road, a brass hairline. */
  c.strokeStyle = "rgba(201,170,124,0.5)";
  c.lineWidth = 1;
  c.beginPath();
  c.arc(half, half, ringR, 0, Math.PI * 2);
  c.stroke();

  /* The centre monogram, tiny, in the same hairline brass. */
  const gs = size / 520;
  c.strokeStyle = "rgba(201,170,124,0.85)";
  c.beginPath();
  for (const stroke of MAP_MONOGRAM) {
    for (let j = 0; j < stroke.length; j += 1) {
      const gx = half + (stroke[j][0] - 32) * gs;
      const gy = half + (stroke[j][1] - 32) * gs;
      if (j === 0) c.moveTo(gx, gy);
      else c.lineTo(gx, gy);
    }
  }
  c.stroke();

  /* Seven station ticks and their figures, 01 to 07: grey until the
     district reconciles, then brass and filled. */
  const fs = map.fs;
  const tick = Math.max(2.5, size * 0.018);
  const dot = Math.max(2, size * 0.015);
  c.font = map.font;
  c.textAlign = "center";
  c.textBaseline = "middle";
  for (let i = 0; i < map.layout.length; i += 1) {
    const st = map.layout[i];
    const ux = st.x / map.radius;
    const uz = st.z / map.radius;
    const px = half + st.x * s;
    const py = half + st.z * s;
    const on = !!(state.reconciledSet && state.reconciledSet.has(i + 1));
    const colour = on ? "#C9AA7C" : "#7B858C";
    c.strokeStyle = colour;
    c.beginPath();
    c.moveTo(px - ux * tick, py - uz * tick);
    c.lineTo(px + ux * tick, py + uz * tick);
    c.stroke();
    if (on) {
      c.fillStyle = "#C9AA7C";
      c.beginPath();
      c.arc(px, py, dot, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = colour;
    c.fillText(
      map.labels[i],
      half + ux * (ringR + fs * 1.15),
      half + uz * (ringR + fs * 1.15),
    );
  }

  /* The car: a small bright brass arrow showing heading. Forward at
     heading h is (sin h, cos h) in world x and z, so the same pair
     gives the arrow's direction on the card. Held inside the frame
     even when the car wanders off the loop. */
  let cx = state.x * s;
  let cy = state.z * s;
  const reach = Math.hypot(cx, cy);
  const maxReach = half - Math.max(6, size * 0.04);
  if (reach > maxReach) {
    cx *= maxReach / reach;
    cy *= maxReach / reach;
  }
  const al = Math.max(5, size * 0.038);
  c.save();
  c.translate(half + cx, half + cy);
  c.rotate(Math.atan2(Math.cos(state.heading), Math.sin(state.heading)));
  c.fillStyle = "#E2C79A";
  c.beginPath();
  c.moveTo(al, 0);
  c.lineTo(-al * 0.55, al * 0.45);
  c.lineTo(-al * 0.28, 0);
  c.lineTo(-al * 0.55, -al * 0.45);
  c.closePath();
  c.fill();
  c.restore();
}
