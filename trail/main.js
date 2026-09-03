/* ====================================================================
   The audit trail: shell. Boot, physics, input, camera, districts.

   District contract
   =================
   Each module in ./districts/ exports:

     id      string, stable slug, e.g. "d03-experience"
     index   number 1 to 8, the district's place along the loop
     title   string, exactly the homepage section title
     anchor  string, the homepage anchor, e.g. "#experience"
     build(ctx)       called once at boot, after the world exists
     update(dt, ctx)  optional, called every frame while running

   The ctx handed to build and update:

     THREE, CANNON  the live library namespaces
     scene          THREE.Scene
     world          CANNON.World
     origin         THREE.Vector3, the district's station centre on the
                    road. World coordinates throughout the contract.
     angle          number, the trail's heading at the station. Forward
                    along the trail is (sin angle, 0, cos angle);
                    outward, away from the loop centre and clear of the
                    road, is (cos angle, 0, -sin angle).
     helpers        everything world.js exports as helpers:
                    edged(geometry, opts), floorText(text, size, opts),
                    blobShadow(radius), plinth(w, h, d), column(r, h),
                    beam(length, thickness), brassMat(opts),
                    worldText3D(text, size, opts), which returns null
                    when the letterform face is unavailable
     addStatic(mesh, shape?, mass0Body?)
                    adds the mesh to the scene. With a CANNON shape it
                    also drops a static body at the mesh position,
                    lifted so a Box or Cylinder rests on the ground.
                    Pass a ready made mass 0 body instead for full
                    control. Returns the body, or null.
     addDynamic(mesh, body)
                    adds both and keeps the mesh synced to the body
                    every frame. For physics props.
     addTrigger(x, z, radius, onEnter)
                    a flat circle on the ground. onEnter fires once per
                    entry and re arms when the car leaves.
     addLink(x, z, label, url)
                    builds a floor plaque. Driving over it shows the
                    HUD prompt "Press E / tap to open <label>"; only
                    that explicit key or tap opens the url, and always
                    in a new tab. Never auto opens.
     onUpdate(fn)   registers fn(dt) to run every frame.
   ==================================================================== */

import * as THREE from "three";
import * as CANNON from "cannon-es";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { buildWorld, LAYOUT, SPAWN, ROAD_RADIUS, helpers } from "./world.js";
import { buildCar, TOP_SPEED } from "./vehicle.js";
import { initEffects } from "./effects.js";
import { initReceipts } from "./receipts.js";
import * as hud from "./hud.js";
import * as d01 from "./districts/d01-method.js";
import * as d02 from "./districts/d02-now.js";
import * as d03 from "./districts/d03-experience.js";
import * as d04 from "./districts/d04-education.js";
import * as d05 from "./districts/d05-journal.js";
import * as d06 from "./districts/d06-field-notes.js";
import * as d07 from "./districts/d07-research.js";
import * as d08 from "./districts/d08-contact.js";

const DISTRICTS = [d01, d02, d03, d04, d05, d06, d07, d08];

const FIXED_STEP = 1 / 60;
const MAX_SUBSTEPS = 3;
const WORLD_BOUND = 200;
const FALL_FLOOR = -20;
const IDLE_LIMIT = 60000;

const root = document.documentElement;

let renderer = null;
let scene = null;
let camera = null;
let physics = null;
let car = null;
let keyLight = null;
let composer = null;
let bloomPass = null;
let atmosphere = null;
let glowJoys = null;
let effects = null;
let receipts = null;
let booted = false;
let veiled = false;
let reduceMotion = false;
let coarsePointer = false;
let lastTime = performance.now();
let lastInputAt = performance.now();
let lastStation = SPAWN;
let activeLink = null;
let joyTime = 0;

/* Adaptive quality, decided fresh each session and stored nowhere.
   Once the veil lifts, the real frame loop averages its own frame
   times over four second windows. A window worse than the budget
   steps the pipeline down one tier: first the bloom drops to half
   resolution and the composer to a pixel ratio of 1, then the bloom
   goes altogether; a window inside the budget settles the decision. */
const PERF_WINDOW_MS = 4000;
const PERF_BUDGET_MS = 22;
let composerRatio = 1;
let qualityTier = 0;
let qualitySettled = false;
let qualityAvgMs = 0;
let perfAccum = 0;
let perfFrames = 0;

const updateFns = [];
const triggers = [];
const dynamics = [];
const districtRuntime = [];
const keys = { fwd: false, back: false, left: false, right: false, brake: false };
const dialInput = { steer: 0, throttle: 0, active: false };
const input = { steer: 0, throttle: 0, brake: false };

const camOffset = new THREE.Vector3(20, 26, 20);
const keyOffset = new THREE.Vector3(38, 60, -26);
const camPos = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const camDesired = new THREE.Vector3();
const camAim = new THREE.Vector3();
const camRight = new THREE.Vector3();
const mapForward = new THREE.Vector3();
const mapState = { x: 0, z: 0, heading: 0, reconciledSet: null };

/* Camera dynamics: the frame breathes with speed, leads into a drift,
   and takes one brief soft knock on a hard landing. */
const CAM_FOV = 30;
const SHAKE_SPAN = 0.4;
let camZoom = 0;
let camLead = 0;
let shakeTime = 0;
let shakeAmp = 0;
let shakeClock = 0;
let dustTimer = 0;

/* ---------- boot ---------- */

function start() {
  if (booted || window.__trailDead) return;
  booted = true;
  /* boot is async, awaiting the world build; any failure along the
     way, sync or not, folds into the same fallback. */
  boot().catch((err) => {
    if (window.__trailFallback) window.__trailFallback();
    console.error(err);
  });
}

async function boot() {
  hud.initHud();
  hud.initMap(LAYOUT, ROAD_RADIUS);

  scene = new THREE.Scene();
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  document.getElementById("trailstage").appendChild(renderer.domElement);

  /* The far plane reaches past the sky dome; fog closes the world in
     long before it. */
  camera = new THREE.PerspectiveCamera(30, 1, 0.5, 900);

  try {
    coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  } catch (err) {
    coarsePointer = false;
  }

  /* The night pipeline: the scene renders through a selective bloom,
     thresholded high so only the genuinely emissive things halo, the
     brass, the lamps, the lenses, the stars, while the dark world
     stays crisp. The composer runs at a gentler pixel ratio than the
     canvas, capped tighter still on touch hardware; the OutputPass
     carries tone mapping and colour out. Should any of it fail to
     stand, the world simply renders plain: tick falls back to
     renderer.render whenever composer is null. */
  try {
    composer = new EffectComposer(renderer);
    composerRatio = Math.min(window.devicePixelRatio || 1, coarsePointer ? 1.25 : 1.5);
    composer.setPixelRatio(composerRatio);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth || 1, window.innerHeight || 1),
      0.55,   /* strength: a halo, never a wash */
      0.4,    /* radius */
      0.85,   /* threshold: only real light crosses */
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  } catch (err) {
    composer = null;
    bloomPass = null;
    console.error(err);
  }

  /* The world build awaits its letterform face, so 3D type stands
     ready before any district builds. */
  const world = await buildWorld(THREE, scene);
  keyLight = world.keyLight;
  atmosphere = world.updateAtmosphere;
  glowJoys = world.updateGlow;

  physics = new CANNON.World();
  physics.gravity.set(0, -9.82, 0);
  physics.broadphase = new CANNON.SAPBroadphase(physics);
  physics.allowSleep = true;
  physics.defaultContactMaterial.friction = 0.5;
  physics.defaultContactMaterial.restitution = 0;

  /* The ground is a vast static slab with its top face at y 0. */
  const ground = new CANNON.Body({ mass: 0 });
  ground.addShape(new CANNON.Box(new CANNON.Vec3(300, 1, 300)), new CANNON.Vec3(0, -1, 0));
  physics.addBody(ground);

  /* The standing monogram at the loop's centre is solid: one low box
     under the letters, turned with the lockup, so the heart landmark
     is driven around rather than through. */
  const heart = new CANNON.Body({ mass: 0 });
  heart.addShape(new CANNON.Box(new CANNON.Vec3(3.7, 0.75, 1.2)));
  heart.position.set(0, 0.75, 0);
  heart.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 4);
  physics.addBody(heart);

  car = buildCar(THREE, CANNON, scene, physics);
  car.reset(new THREE.Vector3(SPAWN.x, 0, SPAWN.z), SPAWN.angle);

  try {
    reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (err) {
    reduceMotion = false;
  }

  effects = initEffects(THREE, scene);
  receipts = initReceipts(THREE, scene, onReceipt, reduceMotion);

  /* Lay the districts out on their stations and wire the tally: the
     first entry into each reconciles it; all eight countersign. A
     first reconciliation fountains brass figures from the station and
     pulses the tally; the eighth bursts around the centre monogram. */
  for (const mod of DISTRICTS) {
    const station = LAYOUT[mod.index - 1];
    const ctx = makeCtx(station);
    mod.build(ctx);
    districtRuntime.push({ mod, ctx });
    addTriggerInternal(station.x, station.z, 9, () => {
      lastStation = station;
      const first = !hud.reconciledSet().has(mod.index);
      const total = hud.reconcile(mod.index, mod.title);
      if (first) {
        effects.glyphBurst(station.x, station.z, 24, false);
        hud.pulseTally();
      }
      if (total === 8) {
        if (first) effects.glyphBurst(0, 0, 40, true);
        hud.countersign();
      }
    }, null);
  }

  /* Each district's title stands as 3D letterforms behind its plot,
     out along the station's outward vector and turned to the fixed
     camera diagonal, the same convention the floor type reads by.
     Where the letterform face could not load, the eyebrows on the
     ground still carry the names alone. */
  for (const mod of DISTRICTS) {
    const st = LAYOUT[mod.index - 1];
    const standing = helpers.worldText3D(mod.title, 2.4);
    if (standing) {
      standing.position.set(
        st.x + Math.cos(st.angle) * 33,
        0,
        st.z - Math.sin(st.angle) * 33,
      );
      standing.rotation.y = Math.PI / 4;
      scene.add(standing);
    }
  }

  wireInput();
  onResize();
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", () => {
    lastTime = performance.now();
    /* Returning to the tab earns a fresh idle grace period, so the
       world visibly resumes rather than waiting for a keypress. */
    lastInputAt = performance.now();
    /* And a fresh measurement: a resize fired while hidden reads 0. */
    onResize();
  });

  camPos.set(SPAWN.x + camOffset.x, camOffset.y, SPAWN.z + camOffset.z);
  camTarget.set(SPAWN.x, 0, SPAWN.z);
  camera.position.copy(camPos);
  camera.lookAt(camTarget);

  window.__trailAlive = true;
  root.classList.add("trail-on");
  requestAnimationFrame(frame);
}

/* ---------- ctx ---------- */

function makeCtx(station) {
  return {
    THREE,
    CANNON,
    scene,
    world: physics,
    origin: new THREE.Vector3(station.x, 0, station.z),
    angle: station.angle,
    helpers,
    addStatic,
    addDynamic,
    addTrigger,
    addLink,
    onUpdate,
  };
}

function addStatic(mesh, shape, mass0Body) {
  scene.add(mesh);
  if (mass0Body) {
    physics.addBody(mass0Body);
    return mass0Body;
  }
  if (!shape) return null;
  const body = new CANNON.Body({ mass: 0, shape });
  let lift = 0;
  if (shape.halfExtents) lift = shape.halfExtents.y;
  else if (typeof shape.height === "number") lift = shape.height / 2;
  else if (typeof shape.radius === "number") lift = shape.radius;
  body.position.set(mesh.position.x, mesh.position.y + lift, mesh.position.z);
  body.quaternion.set(
    mesh.quaternion.x,
    mesh.quaternion.y,
    mesh.quaternion.z,
    mesh.quaternion.w,
  );
  physics.addBody(body);
  return body;
}

function addDynamic(mesh, body) {
  scene.add(mesh);
  physics.addBody(body);
  dynamics.push({ mesh, body });
  return body;
}

function addTriggerInternal(x, z, radius, onEnter, onLeave) {
  triggers.push({ x, z, r2: radius * radius, inside: false, onEnter, onLeave });
}

function addTrigger(x, z, radius, onEnter) {
  addTriggerInternal(x, z, radius, onEnter, null);
}

function addLink(x, z, label, url) {
  const group = new THREE.Group();
  const pts = [];
  for (let i = 0; i < 48; i += 1) {
    const a = (i / 48) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2));
  }
  const ring = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({
      color: new THREE.Color(0xC9AA7C).multiplyScalar(2.1),
      transparent: true,
      opacity: 0.6,
    }),
  );
  ring.position.y = 0.04;
  group.add(ring);
  const plate = helpers.floorText(label, 0.8, { colour: "ink" });
  plate.position.set(0, 0, 3.1);
  group.add(plate);
  group.position.set(x, 0, z);
  scene.add(group);
  addTriggerInternal(x, z, 3, () => {
    activeLink = { label, url };
    hud.showLinkPrompt(label);
  }, () => {
    activeLink = null;
    hud.hideLinkPrompt();
  });
  return group;
}

function onUpdate(fn) {
  updateFns.push(fn);
}

/* A receipt gathered: a flick of paper, and the counter ticks over.
   The full set earns its line on the countersign. */
function onReceipt(x, y, z, count) {
  effects.paperFlick(x, y, z);
  hud.setReceipts(count);
  if (count === receipts.total) hud.receiptsComplete();
}

/* Plaques only ever open on an explicit key press or tap, and always
   in a new tab. */
function openActiveLink() {
  if (!activeLink) return;
  window.open(activeLink.url, "_blank", "noopener");
}

/* ---------- input ---------- */

function poke() {
  lastInputAt = performance.now();
}

function onEscape() {
  if (hud.countersignOpen()) hud.dismissCountersign();
  else hud.togglePause();
}

function resetCar() {
  car.reset(
    new THREE.Vector3(lastStation.x, 0, lastStation.z),
    lastStation.angle,
  );
}

function onKey(event, down) {
  poke();
  switch (event.code) {
    case "KeyW":
    case "ArrowUp":
      keys.fwd = down;
      break;
    case "KeyS":
    case "ArrowDown":
      keys.back = down;
      break;
    case "KeyA":
    case "ArrowLeft":
      keys.left = down;
      break;
    case "KeyD":
    case "ArrowRight":
      keys.right = down;
      break;
    case "Space":
      keys.brake = down;
      break;
    case "KeyR":
      if (down) resetCar();
      break;
    case "KeyE":
      if (down) openActiveLink();
      break;
    case "KeyM":
      if (down) hud.cycleMap();
      break;
    case "Escape":
      if (down) onEscape();
      break;
    default:
      return;
  }
  if (event.code.startsWith("Arrow") || event.code === "Space") {
    event.preventDefault();
  }
}

function wireInput() {
  window.addEventListener("keydown", (e) => onKey(e, true));
  window.addEventListener("keyup", (e) => onKey(e, false));
  window.addEventListener("pointerdown", poke);
  window.addEventListener("touchstart", poke, { passive: true });
  document.getElementById("traillink").addEventListener("click", openActiveLink);
  if (coarsePointer) buildDial();
}

/* A brass dial for thumbs: drag up to drive, sideways to steer. */
function buildDial() {
  const dial = document.createElement("div");
  dial.id = "traildial";
  dial.setAttribute("aria-hidden", "true");
  const knob = document.createElement("div");
  knob.className = "knob";
  dial.appendChild(knob);
  document.body.appendChild(dial);

  const RANGE = 44;
  let pointerId = null;

  function setKnob(dx, dy) {
    knob.style.transform = "translate(" + dx + "px, " + dy + "px)";
  }

  function track(event) {
    const rect = dial.getBoundingClientRect();
    let dx = event.clientX - (rect.left + rect.width / 2);
    let dy = event.clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, RANGE);
    dx = (dx / len) * clamped;
    dy = (dy / len) * clamped;
    setKnob(dx, dy);
    dialInput.steer = -(dx / RANGE);       /* drag right steers right */
    dialInput.throttle = -(dy / RANGE);    /* drag up drives forward */
    dialInput.active = true;
    poke();
  }

  function release() {
    pointerId = null;
    dialInput.steer = 0;
    dialInput.throttle = 0;
    dialInput.active = false;
    setKnob(0, 0);
  }

  dial.addEventListener("pointerdown", (e) => {
    pointerId = e.pointerId;
    dial.setPointerCapture(pointerId);
    track(e);
  });
  dial.addEventListener("pointermove", (e) => {
    if (e.pointerId === pointerId) track(e);
  });
  dial.addEventListener("pointerup", release);
  dial.addEventListener("pointercancel", release);
  dial.addEventListener("contextmenu", (e) => e.preventDefault());
}

function readInput() {
  const steerKeys = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
  const throttleKeys = (keys.fwd ? 1 : 0) - (keys.back ? 1 : 0);
  input.steer = Math.max(-1, Math.min(1, steerKeys + dialInput.steer));
  input.throttle = Math.max(-1, Math.min(1, throttleKeys + dialInput.throttle));
  input.brake = keys.brake;
}

/* ---------- frame loop ---------- */

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  /* A hidden or collapsing tab can measure 0, which would fold the
     draw buffer to a single pixel; keep the last real size instead. */
  if (w < 2 || h < 2) return;
  renderer.setSize(w, h);
  if (composer) {
    composer.setSize(w, h);
    /* The composer hands every pass its full buffer size, so the half
       resolution bloom of quality tier 1 is reasserted after it. */
    if (qualityTier === 1 && bloomPass) {
      bloomPass.setSize(
        Math.max(1, Math.round((w * composerRatio) / 2)),
        Math.max(1, Math.round((h * composerRatio) / 2)),
      );
    }
  }
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

/* Steps the render pipeline down one tier. Tier 1 halves the bloom's
   working resolution and drops the composer to a pixel ratio of 1;
   tier 2 removes the bloom pass altogether. */
function applyQuality(tier) {
  if (!composer) return;
  if (tier === 1 && bloomPass) {
    composerRatio = 1;
    composer.setPixelRatio(1);
    bloomPass.setSize(
      Math.max(1, Math.round(window.innerWidth / 2)),
      Math.max(1, Math.round(window.innerHeight / 2)),
    );
  } else if (tier === 2 && bloomPass) {
    composer.removePass(bloomPass);
    bloomPass.dispose();
    bloomPass = null;
  }
}

/* One real frame's cost, in milliseconds, fed from the live loop
   only; the dev harness steps never count. */
function samplePerf(ms) {
  if (qualitySettled) return;
  perfAccum += Math.min(100, ms);
  perfFrames += 1;
  if (perfAccum < PERF_WINDOW_MS) return;
  qualityAvgMs = perfAccum / perfFrames;
  perfAccum = 0;
  perfFrames = 0;
  if (qualityAvgMs > PERF_BUDGET_MS && qualityTier < 2) {
    qualityTier += 1;
    applyQuality(qualityTier);
  } else {
    qualitySettled = true;
  }
}

function checkTriggers() {
  const p = car.chassisBody.position;
  for (const t of triggers) {
    const dx = p.x - t.x;
    const dz = p.z - t.z;
    const inside = dx * dx + dz * dz <= t.r2;
    if (inside && !t.inside) {
      t.inside = true;
      if (t.onEnter) t.onEnter();
    } else if (!inside && t.inside) {
      t.inside = false;
      if (t.onLeave) t.onLeave();
    }
  }
}

/* The lamplight walks with the car, so its tight shadow camera always
   frames the action without ever growing soft. */
function updateKeyLight() {
  if (!keyLight) return;
  const p = car.group.position;
  keyLight.position.set(p.x + keyOffset.x, keyOffset.y, p.z + keyOffset.z);
  keyLight.target.position.set(p.x, 0, p.z);
}

/* One brief soft knock, hard landings only, never continuous. */
function knockCamera(impact) {
  if (reduceMotion) return;
  shakeAmp = Math.min(0.45, impact * 0.05);
  shakeTime = SHAKE_SPAN;
  shakeClock = 0;
}

function updateCamera(dt) {
  const p = car.group.position;
  const st = car.status;

  /* The frame breathes with pace: it pulls back and opens a touch at
     full tilt, and settles close and calm around the stations. */
  const pace = Math.min(1, st.speed / TOP_SPEED);
  camZoom += (pace - camZoom) * (1 - Math.exp(-dt * 2.2));
  const reach = 1 + camZoom * 0.24;

  /* A touch of lateral lead into the drift, so the slide reads. */
  const leadTarget = st.drifting ? Math.max(-2.6, Math.min(2.6, st.slip * 0.4)) : 0;
  camLead += (leadTarget - camLead) * (1 - Math.exp(-dt * 3));
  camRight.set(1, 0, 0).applyQuaternion(car.group.quaternion);

  camDesired.set(
    p.x + camOffset.x * reach,
    p.y + camOffset.y * reach,
    p.z + camOffset.z * reach,
  );
  camPos.lerp(camDesired, 1 - Math.exp(-dt * 4.5));
  camAim.set(p.x + camRight.x * camLead, p.y, p.z + camRight.z * camLead);
  camTarget.lerp(camAim, 1 - Math.exp(-dt * 6));
  camera.position.copy(camPos);

  if (shakeTime > 0) {
    shakeTime = Math.max(0, shakeTime - dt);
    shakeClock += dt;
    const ease = shakeTime / SHAKE_SPAN;
    camera.position.y += Math.sin(shakeClock * 34) * shakeAmp * ease;
    camera.position.x += Math.sin(shakeClock * 27 + 1.3) * shakeAmp * 0.5 * ease;
  }

  camera.lookAt(camTarget);

  const fovTarget = CAM_FOV + camZoom * 5;
  if (Math.abs(camera.fov - fovTarget) > 0.01) {
    camera.fov += (fovTarget - camera.fov) * (1 - Math.exp(-dt * 2.2));
    camera.updateProjectionMatrix();
  }
}

/* Dust, skid marks and landing puffs, fed from the car's own state. */
function updateCarEffects(dt) {
  const st = car.status;
  const cp = car.chassisBody.position;

  /* Skid marks only where the handbrake writes on the road itself. */
  const offRing = Math.abs(Math.hypot(cp.x, cp.z) - ROAD_RADIUS);
  if (st.drifting && offRing < 4.4) {
    const wl = car.vehicle.wheelInfos[2].worldTransform.position;
    const wr = car.vehicle.wheelInfos[3].worldTransform.position;
    effects.skidAt(0, wl.x, wl.z);
    effects.skidAt(1, wr.x, wr.z);
  } else {
    effects.skidBreak();
  }

  /* Dust off the rear wheels under a hard pull away or through a
     drift; a short steady tick, not a stream. */
  dustTimer -= dt;
  const hardPull = st.grounded && input.throttle > 0.85 &&
    st.forwardSpeed > 0.4 && st.forwardSpeed < TOP_SPEED * 0.55;
  if ((st.drifting || hardPull) && dustTimer <= 0) {
    dustTimer = 0.055;
    const wl = car.vehicle.wheelInfos[2].worldTransform.position;
    const wr = car.vehicle.wheelInfos[3].worldTransform.position;
    effects.dustAt(wl.x, 0.18, wl.z);
    effects.dustAt(wr.x, 0.18, wr.z);
  }

  /* Landings: a puff for a real drop, a knock only for a hard one. */
  if (st.justLanded && st.landing > 4) {
    effects.landingPuff(cp.x, cp.z);
    if (st.landing > 6.5) knockCamera(st.landing);
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const rawMs = now - lastTime;
  const dt = Math.min(0.05, rawMs / 1000);
  lastTime = now;

  /* The page rests when hidden, paused, or left alone for a minute;
     any key or touch picks the trail straight back up. */
  /* The first frame always renders, even in a background tab, so the
     veil never outlives the load; only a running world pauses hidden. */
  if (document.hidden && veiled) return;
  if (hud.isPaused()) return;
  /* Never idle-park before the first frame has lifted the veil: a tab
     opened in the background for over a minute must still wake into a
     rendered world, not a black screen waiting for a keypress. */
  if (veiled && now - lastInputAt > IDLE_LIMIT) return;
  /* Frames behind the veil never count toward the quality decision. */
  const measurable = veiled;
  tick(dt, null);
  if (measurable) samplePerf(rawMs);
}

function tick(dt, forced) {
  if (forced) Object.assign(input, forced);
  else readInput();

  physics.step(FIXED_STEP, dt, MAX_SUBSTEPS);

  for (const d of dynamics) {
    d.mesh.position.copy(d.body.position);
    d.mesh.quaternion.copy(d.body.quaternion);
  }

  car.update(dt, input);

  /* Fell off the world, or wandered past the ledger's margins. */
  const cp = car.chassisBody.position;
  if (cp.y < FALL_FLOOR || Math.abs(cp.x) > WORLD_BOUND || Math.abs(cp.z) > WORLD_BOUND) {
    resetCar();
  }

  checkTriggers();

  for (const fn of updateFns) fn(dt);
  for (const d of districtRuntime) {
    if (typeof d.mod.update === "function") d.mod.update(dt, d.ctx);
  }

  updateCarEffects(dt);
  effects.update(dt);
  receipts.update(dt, cp.x, cp.z);
  /* The drifting air holds still under reduced motion: the mist and
     the motes stand as set dressing rather than scroll and drift. */
  if (atmosphere && !reduceMotion) atmosphere(dt, camPos.x, camPos.z);

  /* The small joys, none of which move under reduced motion: lamp
     bulbs waver a whisper, and the centre mark breathes very slowly. */
  if (glowJoys && !reduceMotion) {
    joyTime += dt;
    glowJoys(joyTime);
  }

  updateCamera(dt);
  updateKeyLight();

  /* The routing slip: position and heading from the chassis, the
     reconciled set straight from the tally's own bookkeeping. */
  mapForward.set(0, 0, 1).applyQuaternion(car.group.quaternion);
  mapState.x = cp.x;
  mapState.z = cp.z;
  mapState.heading = Math.atan2(mapForward.x, mapForward.z);
  mapState.reconciledSet = hud.reconciledSet();
  hud.updateMap(mapState);

  if (composer) composer.render();
  else renderer.render(scene, camera);

  if (!veiled) {
    veiled = true;
    hud.veilDone();
  }
}

/* ---------- handshake with the boot guard ---------- */

window.__trailStart = start;
if (window.__trailWanted) start();

/* ---------- dev harness, ?dev only ----------
   Steps the simulation deterministically from the console so the world
   can be exercised where requestAnimationFrame never ticks. Inert in
   normal visits. */
if (new URLSearchParams(window.location.search).has("dev")) {
  window.__trail = {
    step(frames, forced) {
      for (let i = 0; i < frames; i += 1) tick(1 / 60, forced || null);
    },
    gl() {
      return { scene, camera, renderer, keyLight, THREE };
    },
    goto(i) {
      const s = LAYOUT[i - 1];
      if (!s) return "no station " + i;
      car.reset(new THREE.Vector3(s.x, 1.2, s.z), s.angle);
      for (let k = 0; k < 40; k += 1) tick(1 / 60, { steer: 0, throttle: 0, brake: true });
      return this.pos();
    },
    plot(i, out) {
      const s = LAYOUT[i - 1];
      if (!s) return "no station " + i;
      const d = out || 14;
      const x = s.x + Math.cos(s.angle) * d;
      const z = s.z - Math.sin(s.angle) * d;
      car.reset(new THREE.Vector3(x, 1.2, z), s.angle);
      for (let k = 0; k < 40; k += 1) tick(1 / 60, { steer: 0, throttle: 0, brake: true });
      return this.pos();
    },
    pos() {
      const p = car.chassisBody.position;
      const v = car.chassisBody.velocity;
      return {
        x: Math.round(p.x * 100) / 100,
        y: Math.round(p.y * 100) / 100,
        z: Math.round(p.z * 100) / 100,
        speed: Math.round(Math.hypot(v.x, v.y, v.z) * 100) / 100,
      };
    },
    car() {
      return car.status;
    },
    receipts() {
      return receipts.collected() + "/" + receipts.total;
    },
    quality() {
      return {
        tier: qualityTier,
        settled: qualitySettled,
        avgMs: Math.round(qualityAvgMs * 100) / 100,
        bloom: qualityTier === 0 ? "full" : qualityTier === 1 ? "half" : "off",
        composerPixelRatio: composerRatio,
      };
    },
    hud,
  };
}
