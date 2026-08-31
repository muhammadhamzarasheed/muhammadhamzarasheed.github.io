/* The audit trail: world. Ground, fog, light, the loop road, the
   centre lockup, and the shared low poly helpers. Everything here is
   dark solid meshes with brass edge lines; the palette never leaves
   the ledger. */

import * as THREE from "three";

/* ---------- palette ---------- */
export const VOID = 0x0A0B0C;
export const GROUND = 0x0E0F11;      /* a shade above the void so edges read */
export const RAISE = 0x121415;
export const LINE = 0x22262A;
export const BRASS = 0xC9AA7C;
export const BRASS_BRIGHT = 0xE2C79A;
export const INK = 0xEDEAE4;
export const GREY = 0x7B858C;

/* ---------- geography ---------- */
/* A closed ring road. Seven stations sit evenly along it, roughly 60
   units apart, each with a generous plot on the outside of the kerb.
   At a station, forward along the trail is (sin angle, 0, cos angle)
   and outward from the loop centre is (cos angle, 0, -sin angle). */
export const ROAD_RADIUS = 67;
export const ROAD_WIDTH = 8;

export const LAYOUT = Array.from({ length: 7 }, (unused, k) => {
  const th = (k * Math.PI * 2) / 7;
  return {
    x: ROAD_RADIUS * Math.cos(th),
    z: ROAD_RADIUS * Math.sin(th),
    angle: -th,
  };
});

/* Where the car wakes up: on the apron between the monogram and
   district 01, already facing the trail. */
export const SPAWN = { x: 22, z: 0, angle: Math.PI / 2 };

/* ---------- shared materials ---------- */
const mats = new Map();

function lineMat(colour, opacity) {
  const key = "l" + colour + ":" + opacity;
  if (!mats.has(key)) {
    mats.set(key, new THREE.LineBasicMaterial({
      color: colour,
      transparent: opacity < 1,
      opacity,
    }));
  }
  return mats.get(key);
}

function fillMat(colour) {
  const key = "f" + colour;
  if (!mats.has(key)) {
    mats.set(key, new THREE.MeshLambertMaterial({ color: colour }));
  }
  return mats.get(key);
}

/* ---------- helpers ---------- */

/* A dark solid mesh wearing its own brass wireframe. Returns a Group
   of [mesh, line segments]. opts: fill, line, opacity, thresholdAngle. */
export function edged(geometry, opts = {}) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, fillMat(opts.fill ?? RAISE));
  const lines = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, opts.thresholdAngle ?? 1),
    lineMat(opts.line ?? BRASS, opts.opacity ?? 0.9),
  );
  group.add(mesh, lines);
  return group;
}

/* Mono type painted on the ground, like the eyebrows on the record.
   sizeUnits is the glyph height in world units. opts: colour ("brass",
   "ink", "grey" or any CSS colour), tracking (em), uppercase (default
   true). Drawn at high resolution and redrawn once the site's mono
   face has actually loaded, so the type stays crisp and true. */
export function floorText(text, sizeUnits = 1.5, opts = {}) {
  const track = opts.tracking ?? 0.2;
  const str = opts.uppercase === false ? String(text) : String(text).toUpperCase();
  let colour = "#C9AA7C";
  if (opts.colour === "ink") colour = "#EDEAE4";
  else if (opts.colour === "grey") colour = "#7B858C";
  else if (typeof opts.colour === "string" && opts.colour !== "brass") colour = opts.colour;

  const px = 96;                       /* canvas pixels per glyph height */
  const adv = (0.6 + track) * px;      /* IBM Plex Mono advance per char */
  const pad = 16;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(Math.max(1, str.length) * adv) + pad * 2;
  canvas.height = Math.ceil(px * 1.5);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const draw = () => {
    const c = canvas.getContext("2d");
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.font = '500 ' + px + 'px "IBM Plex Mono", monospace';
    c.textBaseline = "middle";
    c.fillStyle = colour;
    let x = pad;
    for (const ch of str) {
      c.fillText(ch, x, canvas.height / 2);
      x += adv;
    }
    texture.needsUpdate = true;
  };
  draw();
  if (document.fonts) {
    document.fonts.load('500 32px "IBM Plex Mono"').then(draw).catch(() => {});
    document.fonts.ready.then(draw).catch(() => {});
  }

  const worldW = (canvas.width / px) * sizeUnits;
  const worldH = (canvas.height / px) * sizeUnits;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(worldW, worldH),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.045;
  mesh.renderOrder = 2;
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}

/* Fake shadow: a soft dark disc. There are no shadow maps anywhere on
   this page; every object that leaves the ground gets one of these. */
let blobTexture = null;
function getBlobTexture() {
  if (blobTexture) return blobTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const c = canvas.getContext("2d");
  const g = c.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,0.4)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  blobTexture = new THREE.CanvasTexture(canvas);
  return blobTexture;
}

export function blobShadow(radius = 1.5) {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 24),
    new THREE.MeshBasicMaterial({
      map: getBlobTexture(),
      transparent: true,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  mesh.renderOrder = 1;
  return mesh;
}

/* A plinth resting on the ground, origin at its base centre. */
export function plinth(w = 6, h = 2, d = 6, opts = {}) {
  const group = new THREE.Group();
  const box = edged(new THREE.BoxGeometry(w, h, d), opts);
  box.position.y = h / 2;
  group.add(box, blobShadow(Math.max(w, d) * 0.72));
  return group;
}

/* A low poly column, origin at its base centre. */
export function column(radius = 0.45, height = 4, opts = {}) {
  const group = new THREE.Group();
  const shaft = edged(
    new THREE.CylinderGeometry(radius, radius, height, 6),
    opts,
  );
  shaft.position.y = height / 2;
  group.add(shaft, blobShadow(radius * 2.4));
  return group;
}

/* A beam, origin at its centre; the caller positions and lifts it. */
export function beam(length = 6, thickness = 0.35, opts = {}) {
  return edged(new THREE.BoxGeometry(length, thickness, thickness), opts);
}

export const helpers = { edged, floorText, blobShadow, plinth, column, beam };

/* ---------- world building ---------- */

function ringLine(radius, colour, opacity, segments = 160) {
  const pts = [];
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(radius * Math.cos(a), 0, radius * Math.sin(a)));
  }
  const line = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(pts),
    lineMat(colour, opacity),
  );
  line.position.y = 0.04;
  return line;
}

/* Faint chevrons ticking along the centreline in the direction of
   travel, like the ruled figures in a ledger margin. */
function chevrons(radius, count) {
  const pts = [];
  for (let i = 0; i < count; i += 1) {
    const th = (i / count) * Math.PI * 2;
    const cx = radius * Math.cos(th);
    const cz = radius * Math.sin(th);
    const tx = -Math.sin(th);
    const tz = Math.cos(th);
    const nx = Math.cos(th);
    const nz = Math.sin(th);
    const tipX = cx + tx * 0.9;
    const tipZ = cz + tz * 0.9;
    pts.push(
      new THREE.Vector3(tipX, 0, tipZ),
      new THREE.Vector3(cx - tx * 0.3 + nx * 0.7, 0, cz - tz * 0.3 + nz * 0.7),
      new THREE.Vector3(tipX, 0, tipZ),
      new THREE.Vector3(cx - tx * 0.3 - nx * 0.7, 0, cz - tz * 0.3 - nz * 0.7),
    );
  }
  const seg = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(pts),
    lineMat(BRASS, 0.22),
  );
  seg.position.y = 0.04;
  return seg;
}

/* The monogram from the site's letterhead, drawn flat on the ground
   in brass hairlines. Path geometry lifted from the footer mark:
   M 12 45 V 19 l 10 13 10 -13 v 26, M 52 19 v 26, M 36 32 h 16. */
function monogram(scale) {
  const group = new THREE.Group();
  const p = (x, y) => new THREE.Vector3((x - 32) * scale, 0, (y - 32) * scale);
  const strokes = [
    [p(12, 45), p(12, 19), p(22, 32), p(32, 19), p(32, 45)],
    [p(52, 19), p(52, 45)],
    [p(36, 32), p(52, 32)],
  ];
  for (const pts of strokes) {
    group.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      lineMat(BRASS, 0.9),
    ));
  }
  return group;
}

/* Builds the ground, fog, light, road and centre lockup into the
   given scene. Returns { LAYOUT, SPAWN } for convenience. */
export function buildWorld(THREE_, scene) {
  scene.background = new THREE.Color(VOID);
  scene.fog = new THREE.Fog(VOID, 70, 230);

  /* Ground: vast, matte, a breath lighter than the void. */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    fillMat(GROUND),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  /* No shadow maps; the light is here only to give the fills a hint
     of form. The edges do the drawing. */
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(40, 80, -30);
  scene.add(sun);

  /* The trail: two brass hairline kerbs and a ticking centreline. */
  scene.add(ringLine(ROAD_RADIUS - ROAD_WIDTH / 2, BRASS, 0.55));
  scene.add(ringLine(ROAD_RADIUS + ROAD_WIDTH / 2, BRASS, 0.55));
  scene.add(chevrons(ROAD_RADIUS, 52));

  /* A faint reconciliation circle at each station, so the trigger
     reads on the ground before it reads on the tally. */
  for (const st of LAYOUT) {
    const ring = ringLine(9, BRASS, 0.14, 96);
    ring.position.set(st.x, 0.04, st.z);
    scene.add(ring);
  }

  /* Centre of the loop: the letterhead, laid in the ground, turned
     to face the opening view. */
  const lockup = new THREE.Group();
  lockup.add(monogram(0.55));
  const name = floorText("MUHAMMAD HAMZA", 1.5, { colour: "brass" });
  name.position.set(0, 0, 9.5);
  lockup.add(name);
  const strap = floorText("THE AUDIT TRAIL", 1.0, { colour: "grey" });
  strap.position.set(0, 0, 12.2);
  lockup.add(strap);
  lockup.rotation.y = Math.PI / 4;
  scene.add(lockup);

  /* Start pad, where the car wakes up facing district 01. */
  const pad = ringLine(2.6, BRASS, 0.5, 64);
  pad.position.set(SPAWN.x, 0.04, SPAWN.z);
  scene.add(pad);

  return { LAYOUT, SPAWN };
}
