/* ====================================================================
   The audit trail: shell. Boot, physics, input, camera, districts.

   District contract
   =================
   Each module in ./districts/ exports:

     id      string, stable slug, e.g. "d03-experience"
     index   number 1 to 7, the district's place along the loop
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
                    beam(length, thickness)
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
import { buildWorld, LAYOUT, SPAWN, helpers } from "./world.js";
import { buildCar } from "./vehicle.js";
import * as hud from "./hud.js";
import * as d01 from "./districts/d01-method.js";
import * as d02 from "./districts/d02-now.js";
import * as d03 from "./districts/d03-experience.js";
import * as d04 from "./districts/d04-education.js";
import * as d05 from "./districts/d05-journal.js";
import * as d06 from "./districts/d06-field-notes.js";
import * as d07 from "./districts/d07-contact.js";

const DISTRICTS = [d01, d02, d03, d04, d05, d06, d07];

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
let booted = false;
let veiled = false;
let lastTime = performance.now();
let lastInputAt = performance.now();
let lastStation = SPAWN;
let activeLink = null;

const updateFns = [];
const triggers = [];
const dynamics = [];
const districtRuntime = [];
const keys = { fwd: false, back: false, left: false, right: false, brake: false };
const dialInput = { steer: 0, throttle: 0, active: false };
const input = { steer: 0, throttle: 0, brake: false };

const camOffset = new THREE.Vector3(20, 26, 20);
const camPos = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const camDesired = new THREE.Vector3();

/* ---------- boot ---------- */

function start() {
  if (booted || window.__trailDead) return;
  booted = true;
  try {
    boot();
  } catch (err) {
    if (window.__trailFallback) window.__trailFallback();
    console.error(err);
  }
}

function boot() {
  hud.initHud();

  scene = new THREE.Scene();
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute("aria-hidden", "true");
  document.getElementById("trailstage").appendChild(renderer.domElement);

  camera = new THREE.PerspectiveCamera(30, 1, 0.5, 400);

  buildWorld(THREE, scene);

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

  car = buildCar(THREE, CANNON, scene, physics);
  car.reset(new THREE.Vector3(SPAWN.x, 0, SPAWN.z), SPAWN.angle);

  /* Lay the districts out on their stations and wire the tally: the
     first entry into each reconciles it; all seven countersign. */
  for (const mod of DISTRICTS) {
    const station = LAYOUT[mod.index - 1];
    const ctx = makeCtx(station);
    mod.build(ctx);
    districtRuntime.push({ mod, ctx });
    addTriggerInternal(station.x, station.z, 9, () => {
      lastStation = station;
      if (hud.reconcile(mod.index, mod.title) === 7) hud.countersign();
    }, null);
  }

  wireInput();
  onResize();
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", () => {
    lastTime = performance.now();
    /* Returning to the tab earns a fresh idle grace period, so the
       world visibly resumes rather than waiting for a keypress. */
    lastInputAt = performance.now();
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
    new THREE.LineBasicMaterial({ color: 0xC9AA7C, transparent: true, opacity: 0.6 }),
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
  let coarse = false;
  try {
    coarse = window.matchMedia("(pointer: coarse)").matches;
  } catch (err) {
    coarse = false;
  }
  if (coarse) buildDial();
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
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
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

function updateCamera(dt) {
  const p = car.group.position;
  camDesired.set(p.x + camOffset.x, p.y + camOffset.y, p.z + camOffset.z);
  camPos.lerp(camDesired, 1 - Math.exp(-dt * 4.5));
  camTarget.lerp(p, 1 - Math.exp(-dt * 6));
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
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
  tick(dt, null);
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

  updateCamera(dt);
  renderer.render(scene, camera);

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
    hud,
  };
}
