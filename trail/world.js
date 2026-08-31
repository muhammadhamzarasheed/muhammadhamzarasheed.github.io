/* The audit trail: world. Ground, sky, fog, light, the loop road, the
   centre lockup, and the shared low poly helpers. Everything here is
   dark solid meshes with brass edge lines, lit like a desk model after
   hours: one warm key lamp, a cool whisper of fill, and a sky that
   deepens from a warm horizon to the void. The palette never leaves
   the ledger. */

import * as THREE from "three";

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

/* Solid fills are proper lit surfaces: standard material, flat shaded
   so every face takes the lamplight on its own terms, with a whisper
   of warm emissive so nothing ever crushes to pure black. Roughness
   and metalness are open to callers for subtle surface variation. */
function fillMat(colour, opts = {}) {
  const roughness = opts.roughness ?? 0.85;
  const metalness = opts.metalness ?? 0.06;
  const emissive = opts.emissive ?? 0x0F0B07;
  const glow = opts.emissiveIntensity ?? 0.5;
  const key = "f" + colour + ":" + roughness + ":" + metalness + ":" + emissive + ":" + glow;
  if (!mats.has(key)) {
    mats.set(key, new THREE.MeshStandardMaterial({
      color: colour,
      roughness,
      metalness,
      flatShading: true,
      emissive,
      emissiveIntensity: glow,
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
  });
}

/* ---------- helpers ---------- */

/* A dark solid mesh wearing its own brass wireframe. Returns a Group
   of [mesh, line segments]. opts: fill, line, opacity, thresholdAngle,
   plus the lit look: roughness, metalness, emissive, emissiveIntensity,
   brass (true swaps the fill for brass metal), and castShadow or
   receiveShadow (both default true). */
export function edged(geometry, opts = {}) {
  const group = new THREE.Group();
  const material = opts.brass
    ? brassMat(opts)
    : fillMat(opts.fill ?? CHARCOAL, opts);
  const mesh = new THREE.Mesh(geometry, material);
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

export const helpers = { edged, floorText, blobShadow, plinth, column, beam, brassMat };

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
   dark band at the horizon, then back to void below the ground line.
   Unfogged, drawn first, and far enough out to sit behind everything. */
function skyDome() {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 256;
  const c = canvas.getContext("2d");
  const g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0.0, "#0A0B0C");
  g.addColorStop(0.34, "#0B0B0D");
  g.addColorStop(0.46, "#141110");
  g.addColorStop(0.5, "#1E1812");
  g.addColorStop(0.57, "#0E0C0B");
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
function lampPosts() {
  const group = new THREE.Group();
  const count = 14;
  const radius = ROAD_RADIUS - ROAD_WIDTH / 2 - 1.4;
  const postGeo = new THREE.CylinderGeometry(0.07, 0.11, 3.4, 6);
  const armGeo = new THREE.BoxGeometry(0.8, 0.07, 0.07);
  const headGeo = new THREE.BoxGeometry(0.28, 0.14, 0.28);
  const bulbGeo = new THREE.SphereGeometry(0.1, 8, 6);
  const poolGeo = new THREE.CircleGeometry(2.5, 24);
  const postMat = fillMat(0x17150F, { roughness: 0.55, metalness: 0.5 });
  const headMat = brassMat();
  const bulbMat = fillMat(LAMP, {
    roughness: 0.4,
    metalness: 0,
    emissive: LAMP,
    emissiveIntensity: 2.6,
  });
  const poolMat = new THREE.MeshBasicMaterial({
    map: radialTexture([
      [0, "rgba(255,214,160,0.32)"],
      [0.55, "rgba(255,205,145,0.10)"],
      [1, "rgba(255,205,145,0)"],
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
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(0.72, 3.18, 0);
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
  return group;
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

/* Builds the ground, sky, fog, light, road and centre lockup into the
   given scene. Returns { LAYOUT, SPAWN, keyLight }; the caller walks
   keyLight along with the car so the tight shadow camera always frames
   the action. */
export function buildWorld(THREE_, scene) {
  scene.background = new THREE.Color(VOID);
  /* Warm dark haze: deep enough that the far side of the loop softens
     away, close enough that a district still reads from the road. */
  scene.fog = new THREE.Fog(0x120E0B, 55, 300);
  scene.add(skyDome());

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

  const kerbMat = brassMat({ emissiveIntensity: 0.16 });
  for (const r of [ROAD_RADIUS - ROAD_WIDTH / 2, ROAD_RADIUS + ROAD_WIDTH / 2]) {
    const kerb = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 6, 220), kerbMat);
    kerb.rotation.x = -Math.PI / 2;
    kerb.position.y = 0.05;
    scene.add(kerb);
  }
  scene.add(chevrons(ROAD_RADIUS, 52));
  scene.add(lampPosts());

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
  lockup.rotation.y = Math.PI / 4;
  lockup.position.y = 0.04;
  scene.add(lockup);

  /* Start pad, where the car wakes up facing district 01. */
  const pad = ringLine(2.6, BRASS, 0.5, 64);
  pad.position.set(SPAWN.x, 0.04, SPAWN.z);
  scene.add(pad);

  return { LAYOUT, SPAWN, keyLight };
}
