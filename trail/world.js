/* The audit trail: world. Ground, sky, fog, light, the loop road, the
   centre lockup, and the shared low poly helpers. Everything here is
   dark solid meshes with brass edge lines, lit like a desk model after
   hours: one warm key lamp, a cool whisper of fill, and a sky that
   deepens from a warm horizon to the void. The palette never leaves
   the ledger. */

import * as THREE from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/* ---------- palette ---------- */
export const VOID = 0x0A0B0C;
export const GROUND = 0x11100E;      /* warm dark weave under everything */
export const RAISE = 0x121415;
export const CHARCOAL = 0x191816;    /* warm charcoal, the default fill */
export const LINE = 0x22262A;
export const BRASS = 0xC9AA7C;
export const BRASS_BRIGHT = 0xE2C79A;
export const INK = 0xEDEAE4;
export const GREY = 0x7B858C;
export const LAMP = 0xFFD9A6;        /* lamplight amber, faint and warm */

/* ---------- geography ---------- */
/* A closed ring road. Eight stations sit evenly along it, roughly 53
   units apart, each with a generous plot on the outside of the kerb.
   At a station, forward along the trail is (sin angle, 0, cos angle)
   and outward from the loop centre is (cos angle, 0, -sin angle). */
export const ROAD_RADIUS = 67;
export const ROAD_WIDTH = 8;
export const STATION_COUNT = 8;

export const LAYOUT = Array.from({ length: STATION_COUNT }, (unused, k) => {
  const th = (k * Math.PI * 2) / STATION_COUNT;
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

/* Brass hairlines render hot: pushed past white in the linear buffer
   so the bloom pass reads them as light, not paint. Grey and ink
   lines stay at their written value and never halo. */
const LINE_GLOW = 2.1;

function lineMat(colour, opacity) {
  const key = "l" + colour + ":" + opacity;
  if (!mats.has(key)) {
    const c = new THREE.Color(colour);
    if (colour === BRASS || colour === BRASS_BRIGHT) c.multiplyScalar(LINE_GLOW);
    mats.set(key, new THREE.LineBasicMaterial({
      color: c,
      transparent: opacity < 1,
      opacity,
    }));
  }
  return mats.get(key);
}

/* Solid fills are proper lit surfaces: standard material, flat shaded
   so every face takes the lamplight on its own terms, with a whisper
   of warm emissive so nothing ever crushes to pure black. Roughness
   and metalness are open to callers for subtle surface variation. */
function fillMat(colour, opts = {}) {
  const roughness = opts.roughness ?? 0.85;
  const metalness = opts.metalness ?? 0.06;
  const emissive = opts.emissive ?? 0x0F0B07;
  const glow = opts.emissiveIntensity ?? 0.5;
  const shaded = opts.vertexColors === true;
  const key = "f" + colour + ":" + roughness + ":" + metalness + ":" + emissive
    + ":" + glow + ":" + (shaded ? 1 : 0);
  if (!mats.has(key)) {
    mats.set(key, new THREE.MeshStandardMaterial({
      color: colour,
      roughness,
      metalness,
      flatShading: true,
      emissive,
      emissiveIntensity: glow,
      vertexColors: shaded,
    }));
  }
  return mats.get(key);
}

/* Brass as metal, for rims, kerbs and trims: high metalness, a low
   sheen, and the faintest self glow so it never dies in shadow.
   Materials are cached, so calling this freely costs nothing. */
export function brassMat(opts = {}) {
  return fillMat(opts.colour ?? BRASS, {
    roughness: opts.roughness ?? 0.32,
    metalness: opts.metalness ?? 0.78,
    emissive: opts.emissive ?? BRASS,
    emissiveIntensity: opts.emissiveIntensity ?? 0.07,
    vertexColors: opts.vertexColors === true,
  });
}

/* ---------- helpers ---------- */

/* Every box built through the helpers softens into a rounded,
   bevelled form by default: same outer dimensions, so the physics
   bodies the districts pair with these shapes still match exactly,
   only the faces ease. Geometries are cached by their dimensions and
   shared across the whole build. */
const roundedBoxes = new Map();
function roundedBox(w, h, d) {
  const key = w + ":" + h + ":" + d;
  if (!roundedBoxes.has(key)) {
    const radius = Math.min(w, h, d) * 0.08;
    roundedBoxes.set(key, new RoundedBoxGeometry(w, h, d, 3, radius));
  }
  return roundedBoxes.get(key);
}

/* A tiny bake pass, run once per geometry at build time, never per
   frame: vertices darken toward the base of the form, a contact
   gradient climbing about 1.2 units, and a touch into the corners,
   written as vertex colours. Forms then sit in the world the way
   baked lighting sits in a finished model, grounded and a little
   worn. Idempotent, so shared geometry is only ever baked once. */
const CONTACT_RISE = 1.2;
function bakeShade(geometry) {
  if (geometry.getAttribute("color")) return;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  const posn = geometry.getAttribute("position");
  const shades = new Float32Array(posn.count * 3);
  const rise = Math.min(CONTACT_RISE, Math.max(1e-6, bounds.max.y - bounds.min.y));
  const cx = (bounds.max.x + bounds.min.x) / 2;
  const cy = (bounds.max.y + bounds.min.y) / 2;
  const cz = (bounds.max.z + bounds.min.z) / 2;
  const hx = Math.max(1e-6, (bounds.max.x - bounds.min.x) / 2);
  const hy = Math.max(1e-6, (bounds.max.y - bounds.min.y) / 2);
  const hz = Math.max(1e-6, (bounds.max.z - bounds.min.z) / 2);
  for (let i = 0; i < posn.count; i += 1) {
    const y = posn.getY(i);
    const lift = Math.min(1, Math.max(0, (y - bounds.min.y) / rise));
    const corner =
      (Math.abs(posn.getX(i) - cx) / hx) *
      (Math.abs(y - cy) / hy) *
      (Math.abs(posn.getZ(i) - cz) / hz);
    const shade = Math.max(0.55, 1 - (1 - lift) * 0.32 - corner * 0.12);
    shades[i * 3] = shade;
    shades[i * 3 + 1] = shade;
    shades[i * 3 + 2] = shade;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(shades, 3));
}

/* A dark solid mesh wearing its own brass wireframe. Returns a Group
   of [mesh, line segments]. opts: fill, line, opacity, thresholdAngle,
   plus the lit look: roughness, metalness, emissive, emissiveIntensity,
   brass (true swaps the fill for brass metal), and castShadow or
   receiveShadow (both default true). Box geometry rounds by default
   (rounded: false keeps it sharp) and every solid takes the contact
   bake (shaded: false opts out, for meshes that tumble or spin). The
   hairlines trace the original sharp form, exactly on the outer
   bounds, so the silhouette stays crisp over the eased faces. */
export function edged(geometry, opts = {}) {
  const group = new THREE.Group();
  let solid = geometry;
  if (opts.rounded !== false && geometry.type === "BoxGeometry") {
    const p = geometry.parameters;
    solid = roundedBox(p.width, p.height, p.depth);
  }
  const shaded = opts.shaded !== false;
  if (shaded) bakeShade(solid);
  const material = opts.brass
    ? brassMat({ ...opts, vertexColors: shaded })
    : fillMat(opts.fill ?? CHARCOAL, { ...opts, vertexColors: shaded });
  const mesh = new THREE.Mesh(solid, material);
  mesh.castShadow = opts.castShadow ?? true;
  mesh.receiveShadow = opts.receiveShadow ?? true;
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
  const textMat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  /* Brass type on the ground carries a subtle overdrive, enough to
     clear the bloom threshold and glow faintly; ink and grey stay
     matte so the ledger keeps its contrast. */
  if (colour === "#C9AA7C") textMat.color.setScalar(2.1);
  else if (colour === "#E2C79A") textMat.color.setScalar(1.8);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(worldW, worldH),
    textMat,
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.045;
  mesh.renderOrder = 2;
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}

/* Contact tint. With the real shadow map on, this disc is no longer
   the shadow, only a soft grounding under anything that leaves the
   floor. Kept deliberately faint so the lamplight is never doubled. */
let blobTexture = null;
function getBlobTexture() {
  if (blobTexture) return blobTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const c = canvas.getContext("2d");
  const g = c.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.addColorStop(0, "rgba(6,5,3,0.16)");
  g.addColorStop(1, "rgba(6,5,3,0)");
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

/* ---------- standing type ---------- */

/* The display face for the world's standing letterforms, loaded once
   inside buildWorld before any district builds. When the face cannot
   load, worldText3D returns null and the world simply stands without
   its 3D type; nothing else is disturbed. */
let worldFont = null;
const FONT_PATH = "/vendor/three/examples/fonts/helvetiker_bold.typeface.json";

/* Type as geometry: extruded letterforms standing upright on the
   ground, dark charcoal faces with the bevel and returns in brass,
   emissive enough to catch the lamplight. sizeUnits is the glyph
   height in world units. opts: depth (extrusion), glow (bevel
   emissive intensity). The mesh stands with its baseline on y 0,
   centred on its anchor, and throws a real shadow. */
export function worldText3D(text, sizeUnits = 2, opts = {}) {
  if (!worldFont) return null;
  const geometry = new TextGeometry(String(text), {
    font: worldFont,
    size: sizeUnits,
    depth: opts.depth ?? sizeUnits * 0.24,
    curveSegments: 5,
    bevelEnabled: true,
    bevelThickness: sizeUnits * 0.035,
    bevelSize: sizeUnits * 0.025,
    bevelSegments: 2,
  });
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  geometry.translate(
    -(bounds.max.x + bounds.min.x) / 2,
    -bounds.min.y,
    -(bounds.max.z + bounds.min.z) / 2,
  );
  /* Two materials: extruded type puts its front and back faces in the
     first group and every side and bevel wall in the second. */
  const mesh = new THREE.Mesh(geometry, [
    fillMat(0x14120F, { roughness: 0.62, metalness: 0.22 }),
    brassMat({ emissiveIntensity: opts.glow ?? 1.0 }),
  ]);
  mesh.castShadow = true;
  return mesh;
}

export const helpers = {
  edged, floorText, blobShadow, plinth, column, beam, brassMat, worldText3D,
};

/* ---------- baked textures, all tiny canvases ---------- */

/* The ground weave: a faint woven grid, near invisible up close, that
   gives the lamplight something to hold at a distance. */
function weaveTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const c = canvas.getContext("2d");
  c.fillStyle = "#11100E";
  c.fillRect(0, 0, 128, 128);
  c.fillStyle = "rgba(255,240,220,0.006)";
  c.fillRect(0, 0, 64, 64);
  c.fillRect(64, 64, 64, 64);
  c.strokeStyle = "rgba(226,199,154,0.035)";
  c.lineWidth = 1;
  for (let i = 0; i <= 128; i += 32) {
    c.beginPath();
    c.moveTo(i + 0.5, 0);
    c.lineTo(i + 0.5, 128);
    c.stroke();
    c.beginPath();
    c.moveTo(0, i + 0.5);
    c.lineTo(128, i + 0.5);
    c.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(70, 70);
  texture.anisotropy = 4;
  return texture;
}

/* A radial gradient texture from an array of [stop, cssColour]. */
function radialTexture(stops, size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const c = canvas.getContext("2d");
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, colour] of stops) g.addColorStop(at, colour);
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/* The sky: a vast dome, deep void at the zenith easing into a warm
   band at the horizon, lamplight caught in the far haze behind the
   districts, then back to void below the ground line. Unfogged, drawn
   first, and far enough out to sit behind everything. */
function skyDome() {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 256;
  const c = canvas.getContext("2d");
  const g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0.0, "#0A0B0C");
  g.addColorStop(0.34, "#0B0B0D");
  g.addColorStop(0.45, "#161210");
  g.addColorStop(0.5, "#2A1F13");
  g.addColorStop(0.56, "#100D0B");
  g.addColorStop(1.0, "#0A0B0C");
  c.fillStyle = g;
  c.fillRect(0, 0, 1, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(430, 24, 16),
    new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    }),
  );
  dome.renderOrder = -1;
  return dome;
}

/* Lamp posts along the inner kerb, one roughly every thirty units.
   The glow is honest theatre: an emissive bulb and a warm pool decal
   laid on the road, no real point lights anywhere. They stand just
   clear of the carriageway, so they carry no physics bodies. */
const BULB_GLOW = 3.6;
function lampPosts() {
  const group = new THREE.Group();
  const bulbs = [];
  const count = 14;
  const radius = ROAD_RADIUS - ROAD_WIDTH / 2 - 1.4;
  const postGeo = new THREE.CylinderGeometry(0.07, 0.11, 3.4, 6);
  const armGeo = new THREE.BoxGeometry(0.8, 0.07, 0.07);
  const headGeo = new THREE.BoxGeometry(0.28, 0.14, 0.28);
  const bulbGeo = new THREE.SphereGeometry(0.12, 8, 6);
  const poolGeo = new THREE.CircleGeometry(3.1, 24);
  const postMat = fillMat(0x17150F, { roughness: 0.55, metalness: 0.5 });
  const headMat = brassMat();
  const poolMat = new THREE.MeshBasicMaterial({
    map: radialTexture([
      [0, "rgba(255,206,140,0.48)"],
      [0.5, "rgba(255,196,126,0.16)"],
      [1, "rgba(255,196,126,0)"],
    ]),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  for (let i = 0; i < count; i += 1) {
    const a = ((i + 0.5) * Math.PI * 2) / count;
    const lamp = new THREE.Group();
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.y = 1.7;
    post.castShadow = true;
    const arm = new THREE.Mesh(armGeo, postMat);
    arm.position.set(0.36, 3.36, 0);
    arm.castShadow = true;
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0.72, 3.3, 0);
    /* The bulb burns well past the bloom threshold; the pass turns it
       into a true halo hanging in the night. Each lamp carries its own
       material so its whisper of flicker keeps its own time. */
    const bulbMat = new THREE.MeshStandardMaterial({
      color: LAMP,
      roughness: 0.4,
      metalness: 0,
      flatShading: true,
      emissive: LAMP,
      emissiveIntensity: BULB_GLOW,
    });
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(0.72, 3.18, 0);
    bulbs.push({ mat: bulbMat, phase: i * 2.39996 });
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(1.9, 0.05, 0);
    pool.renderOrder = 1;
    lamp.add(post, arm, head, bulb, pool);
    /* Local +x turned to point outward, toward the carriageway. */
    lamp.position.set(radius * Math.cos(a), 0, radius * Math.sin(a));
    lamp.rotation.y = -a;
    group.add(lamp);
  }
  return { group, bulbs };
}

/* ---------- atmosphere: stars, ground mist, dust motes ---------- */

/* One soft round speck, shared by the stars and the motes. */
let speckTexture = null;
function getSpeckTexture() {
  if (speckTexture) return speckTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  const c = canvas.getContext("2d");
  const g = c.createRadialGradient(16, 16, 2, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.5, "rgba(255,255,255,0.28)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 32, 32);
  speckTexture = new THREE.CanvasTexture(canvas);
  return speckTexture;
}

/* A dome of stars, far beyond the fog: most a faint ink white, a
   scattering of brass toned ones driven bright enough to halo. */
function starField() {
  const N = 2000;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const ink = new THREE.Color(INK);
  const brass = new THREE.Color(BRASS);
  const tone = new THREE.Color();
  for (let i = 0; i < N; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const e = 0.04 + Math.acos(Math.random()) * 0.94;
    const r = 396;
    pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
    pos[i * 3 + 1] = Math.sin(e) * r;
    pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    if (i % 34 === 0) {
      /* A brass star, hot enough to cross the bloom threshold. */
      tone.copy(brass).multiplyScalar(1.9 + Math.random() * 1.3);
    } else {
      tone.copy(ink).multiplyScalar(0.1 + Math.random() * 0.3);
    }
    col[i * 3] = tone.r;
    col[i * 3 + 1] = tone.g;
    col[i * 3 + 2] = tone.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({
    map: getSpeckTexture(),
    size: 2.2,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  }));
  stars.renderOrder = -1;
  return stars;
}

/* Thin ground mist at knee height: huge, slow scrolling additive
   planes wearing a soft blotched texture, barely there until a lamp
   or a headlight catches it. */
function mistTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d");
  for (let i = 0; i < 15; i += 1) {
    const bx = Math.random() * 256;
    const by = Math.random() * 256;
    const br = 40 + Math.random() * 70;
    const alpha = 0.04 + Math.random() * 0.06;
    /* Drawn wrapped, so the tile repeats without a seam. */
    for (let ox = -256; ox <= 256; ox += 256) {
      for (let oy = -256; oy <= 256; oy += 256) {
        const g = c.createRadialGradient(bx + ox, by + oy, 2, bx + ox, by + oy, br);
        g.addColorStop(0, "rgba(255,255,255," + alpha.toFixed(3) + ")");
        g.addColorStop(1, "rgba(255,255,255,0)");
        c.fillStyle = g;
        c.fillRect(0, 0, 256, 256);
      }
    }
  }
  return canvas;
}

function groundMist() {
  const group = new THREE.Group();
  const canvas = mistTexture();
  const layers = [];
  const specs = [
    { size: 360, y: 0.5, repeat: 3, opacity: 0.06, sx: 0.011, sy: 0.004 },
    { size: 420, y: 0.8, repeat: 2, opacity: 0.05, sx: -0.007, sy: 0.006 },
    { size: 300, y: 0.65, repeat: 4, opacity: 0.045, sx: 0.005, sy: -0.009 },
  ];
  for (const spec of specs) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(spec.repeat, spec.repeat);
    tex.offset.set(Math.random(), Math.random());
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(spec.size, spec.size),
      new THREE.MeshBasicMaterial({
        map: tex,
        color: LAMP,
        transparent: true,
        opacity: spec.opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = spec.y;
    group.add(plane);
    layers.push({ tex, sx: spec.sx, sy: spec.sy });
  }
  return { group, layers };
}

/* Dust motes hanging in the lamplit air over the loop, drifting
   slowly, each tethered loosely to its home. */
function dustMotes() {
  const N = 150;
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const home = new Float32Array(N * 2);
  for (let i = 0; i < N; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const r = 34 + Math.random() * 58;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    pos[i * 3] = x;
    pos[i * 3 + 1] = 0.2 + Math.random() * 2.6;
    pos[i * 3 + 2] = z;
    vel[i * 3] = (Math.random() * 2 - 1) * 0.12;
    vel[i * 3 + 1] = (Math.random() * 2 - 1) * 0.05;
    vel[i * 3 + 2] = (Math.random() * 2 - 1) * 0.12;
    home[i * 2] = x;
    home[i * 2 + 1] = z;
  }
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("position", posAttr);
  const motes = new THREE.Points(geo, new THREE.PointsMaterial({
    map: getSpeckTexture(),
    color: BRASS,
    size: 0.14,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  motes.frustumCulled = false;
  return { motes, pos, vel, home, posAttr, count: N };
}

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
    lineMat(BRASS, 0.28),
  );
  seg.position.y = 0.05;
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

/* The same mark standing: each stroke of the letterhead extruded as
   a slim brass box, 0.4 deep, all in emissive brass. Points share the
   footer path; the y axis flips so the mark stands on its baseline. */
const MARK_GLOW = 0.85;
function standingMonogram(scale) {
  const group = new THREE.Group();
  const thickness = scale * 7;
  /* One dedicated material, never the shared cache: the centre mark
     breathes very slowly, and nothing else may breathe with it. */
  const markMat = new THREE.MeshStandardMaterial({
    color: BRASS,
    roughness: 0.32,
    metalness: 0.78,
    flatShading: true,
    emissive: BRASS,
    emissiveIntensity: MARK_GLOW,
  });
  const seg = (x1, y1, x2, y2) => {
    const ax = (x1 - 32) * scale;
    const ay = (45 - y1) * scale;
    const bx = (x2 - 32) * scale;
    const by = (45 - y2) * scale;
    const len = Math.hypot(bx - ax, by - ay);
    const mesh = new THREE.Mesh(
      roundedBox(len + thickness * 0.9, thickness, 0.4),
      markMat,
    );
    mesh.position.set((ax + bx) / 2, (ay + by) / 2, 0);
    mesh.rotation.z = Math.atan2(by - ay, bx - ax);
    mesh.castShadow = true;
    group.add(mesh);
  };
  seg(12, 45, 12, 19);
  seg(12, 19, 22, 32);
  seg(22, 32, 32, 19);
  seg(32, 19, 32, 45);
  seg(52, 19, 52, 45);
  seg(36, 32, 52, 32);
  return { group, markMat };
}

/* The name standing in a gentle arc, letter by letter so each glyph
   faces the bend's own centre; the ends bow forward, embracing the
   mark. Null when the letterform face never loaded. */
function standingName(sizeUnits) {
  if (!worldFont) return null;
  const group = new THREE.Group();
  const gap = sizeUnits * 0.14;
  const space = sizeUnits * 0.55;
  const letters = [];
  let total = 0;
  for (const ch of "MUHAMMAD HAMZA") {
    if (ch === " ") {
      letters.push(null);
      total += space;
      continue;
    }
    const mesh = worldText3D(ch, sizeUnits);
    const bounds = mesh.geometry.boundingBox;
    const w = bounds.max.x - bounds.min.x;
    letters.push({ mesh, w });
    total += w + gap;
  }
  total -= gap;
  const ARC = 0.85;                    /* the whole bend, in radians */
  const radius = total / ARC;
  let pen = -total / 2;
  for (const item of letters) {
    if (!item) {
      pen += space;
      continue;
    }
    const phi = (pen + item.w / 2) / radius;
    item.mesh.position.set(
      Math.sin(phi) * radius,
      0,
      radius * (1 - Math.cos(phi)),
    );
    item.mesh.rotation.y = -phi;
    group.add(item.mesh);
    pen += item.w + gap;
  }
  return group;
}

/* Builds the ground, sky, fog, light, road and centre lockup into the
   given scene. Returns { LAYOUT, SPAWN, keyLight }; the caller walks
   keyLight along with the car so the tight shadow camera always frames
   the action. Async: the letterform face loads first, before anything
   stands, so standing type is available to the centre build and to
   every district. A failed load leaves the world standing without its
   3D type rather than dead. */
export async function buildWorld(THREE_, scene) {
  if (!worldFont) {
    try {
      worldFont = await new FontLoader().loadAsync(FONT_PATH);
    } catch (err) {
      worldFont = null;
    }
  }
  scene.background = new THREE.Color(VOID);
  /* Warm dark haze, pulled in a touch so the far side of the loop
     sinks away and the lamp glows punch through it; a district still
     reads clearly from the road. */
  scene.fog = new THREE.Fog(0x120E0B, 50, 260);
  scene.add(skyDome());
  scene.add(starField());

  /* Ground: vast, matte, faintly woven, a breath warmer than void. */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshStandardMaterial({
      map: weaveTexture(),
      roughness: 0.94,
      metalness: 0.02,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  /* Far field vignette: the world darkens softly toward its margins. */
  const vignette = new THREE.Mesh(
    new THREE.CircleGeometry(300, 48),
    new THREE.MeshBasicMaterial({
      map: radialTexture([
        [0, "rgba(0,0,0,0)"],
        [0.45, "rgba(0,0,0,0)"],
        [1, "rgba(0,0,0,0.5)"],
      ], 512),
      transparent: true,
      depthWrite: false,
      fog: false,
    }),
  );
  vignette.rotation.x = -Math.PI / 2;
  vignette.position.y = 0.012;
  scene.add(vignette);

  /* Lamplight: one warm key carrying the only shadow map, a cool dim
     fill from the far side, and a hemisphere so faces turned from both
     still shade rather than vanish. */
  scene.add(new THREE.HemisphereLight(0x26241F, 0x161210, 0.8));

  const keyLight = new THREE.DirectionalLight(0xFFE7C4, 2.2);
  keyLight.position.set(38, 60, -26);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -32;
  keyLight.shadow.camera.right = 32;
  keyLight.shadow.camera.top = 32;
  keyLight.shadow.camera.bottom = -32;
  keyLight.shadow.camera.near = 18;
  keyLight.shadow.camera.far = 170;
  keyLight.shadow.bias = -0.0003;
  keyLight.shadow.normalBias = 0.06;
  scene.add(keyLight, keyLight.target);

  const fill = new THREE.DirectionalLight(0xB9C2CC, 0.35);
  fill.position.set(-50, 32, 42);
  scene.add(fill);

  /* The trail itself: a darker ribbon a hair above the ground, brass
     kerbs at both edges, chevrons ticking the centreline. */
  const road = new THREE.Mesh(
    new THREE.RingGeometry(ROAD_RADIUS - ROAD_WIDTH / 2, ROAD_RADIUS + ROAD_WIDTH / 2, 160),
    new THREE.MeshStandardMaterial({
      color: 0x0C0C0D,
      roughness: 0.55,
      metalness: 0.12,
    }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.03;
  road.receiveShadow = true;
  scene.add(road);

  /* Kerbs burn: emissive driven past the bloom threshold, so the two
     brass rails read as the lit spine of the whole night world. */
  const kerbMat = brassMat({ emissiveIntensity: 2.0 });
  for (const r of [ROAD_RADIUS - ROAD_WIDTH / 2, ROAD_RADIUS + ROAD_WIDTH / 2]) {
    const kerb = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 6, 220), kerbMat);
    kerb.rotation.x = -Math.PI / 2;
    kerb.position.y = 0.05;
    scene.add(kerb);
  }
  scene.add(chevrons(ROAD_RADIUS, 52));
  const lamps = lampPosts();
  scene.add(lamps.group);

  /* A faint reconciliation circle at each station, so the trigger
     reads on the ground before it reads on the tally. */
  for (const st of LAYOUT) {
    const ring = ringLine(9, BRASS, 0.14, 96);
    ring.position.set(st.x, 0.055, st.z);
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

  /* The heart landmark: the mark itself stands at the centre of the
     loop, strokes extruded in emissive brass on a low plinth, tall
     enough to read over the mist from anywhere on the trail. The flat
     letterhead stays laid in the ground as the secondary detail. */
  lockup.add(plinth(7.4, 0.5, 2.4));
  const mark = standingMonogram(0.16);
  mark.group.position.y = 0.5;
  lockup.add(mark.group);

  /* The name stands behind the mark in a gentle arc, the strap
     smaller before it, both facing the opening view. */
  const standing = standingName(3);
  if (standing) {
    standing.position.z = -13;
    lockup.add(standing);
  }
  const standingStrap = worldText3D("THE AUDIT TRAIL", 1.1);
  if (standingStrap) {
    standingStrap.position.z = -8.5;
    lockup.add(standingStrap);
  }

  lockup.rotation.y = Math.PI / 4;
  lockup.position.y = 0.04;
  scene.add(lockup);

  /* Start pad, where the car wakes up facing district 01. */
  const pad = ringLine(2.6, BRASS, 0.5, 64);
  pad.position.set(SPAWN.x, 0.04, SPAWN.z);
  scene.add(pad);

  /* The drifting air: mist at knee height, motes in the lamplight.
     Their walk is closed over here so the frame loop touches nothing
     but numbers already allocated. */
  const mist = groundMist();
  scene.add(mist.group);
  const dust = dustMotes();
  scene.add(dust.motes);

  /* Motes only drift while the camera is close enough to see them
     move; a far mote holds still and costs nothing. The camera's x
     and z arrive from the frame loop, already allocated. */
  const MOTE_NEAR2 = 70 * 70;
  function updateAtmosphere(dt, camX, camZ) {
    for (let i = 0; i < mist.layers.length; i += 1) {
      const layer = mist.layers[i];
      layer.tex.offset.x = (layer.tex.offset.x + layer.sx * dt) % 1;
      layer.tex.offset.y = (layer.tex.offset.y + layer.sy * dt) % 1;
    }
    const pos = dust.pos;
    const vel = dust.vel;
    const home = dust.home;
    let moved = false;
    for (let i = 0; i < dust.count; i += 1) {
      const p = i * 3;
      const cx = pos[p] - camX;
      const cz = pos[p + 2] - camZ;
      if (cx * cx + cz * cz > MOTE_NEAR2) continue;
      moved = true;
      pos[p] += vel[p] * dt;
      pos[p + 1] += vel[p + 1] * dt;
      pos[p + 2] += vel[p + 2] * dt;
      /* Kept near its home patch and its lamplit band of air. */
      const dx = pos[p] - home[i * 2];
      const dz = pos[p + 2] - home[i * 2 + 1];
      if (dx > 2.5) vel[p] = -Math.abs(vel[p]);
      else if (dx < -2.5) vel[p] = Math.abs(vel[p]);
      if (dz > 2.5) vel[p + 2] = -Math.abs(vel[p + 2]);
      else if (dz < -2.5) vel[p + 2] = Math.abs(vel[p + 2]);
      if (pos[p + 1] > 3) vel[p + 1] = -Math.abs(vel[p + 1]);
      else if (pos[p + 1] < 0.15) vel[p + 1] = Math.abs(vel[p + 1]);
    }
    if (moved) dust.posAttr.needsUpdate = true;
  }

  /* The small joys, driven from the frame loop only when motion is
     welcome: each lamp bulb wavers almost imperceptibly on its own
     phase, and the centre mark breathes on a slow nine second swell.
     Pure sin arithmetic on materials already made; nothing allocates
     and nothing translates. */
  function updateGlow(t) {
    const bulbs = lamps.bulbs;
    for (let i = 0; i < bulbs.length; i += 1) {
      const b = bulbs[i];
      b.mat.emissiveIntensity = BULB_GLOW
        + Math.sin(t * 11 + b.phase) * 0.09
        + Math.sin(t * 2.7 + b.phase * 1.7) * 0.07;
    }
    mark.markMat.emissiveIntensity = MARK_GLOW + Math.sin(t * 0.7) * 0.07;
  }

  return { LAYOUT, SPAWN, keyLight, updateAtmosphere, updateGlow };
}
