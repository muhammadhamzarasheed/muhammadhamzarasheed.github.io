/* 04 / Education. A colonnade of thirteen columns for the ACCA
   papers, ten passed in brass and three still grey; two plinths for
   the MSc and the PgC; and, set slightly apart, a fork of two brass
   paths where one ends in a grey block and the other carries on to
   the trail. Copy lifted from the record at #education and from the
   Journal entry on starting over. */

import { BRASS, GREY } from "../world.js";

export const id = "d04-education";
export const index = 4;
export const title = "Education";
export const anchor = "#education";

/* Knockable props ease home again: at rest away from home for eight
   seconds, they fade down, teleport back, and fade up. */
const AWAY_SQ = 0.2;       /* squared distance that counts as knocked away */
const REST_LIN = 0.012;    /* squared linear speed below which a prop rests */
const REST_ANG = 0.05;     /* squared angular speed below which a prop rests */
const RESTORE_AFTER = 8;   /* seconds at rest away from home before reset */
const FADE_HALF = 0.22;    /* seconds to fade down; the same again back up */
const FADE_FULL = FADE_HALF * 2;

export function build(ctx) {
  const { THREE, CANNON, helpers, origin, angle } = ctx;

  /* Local frame: f runs forward along the trail, o runs outward,
     away from the loop centre and clear of the road. */
  const fx = Math.sin(angle);
  const fz = Math.cos(angle);
  const ox = Math.cos(angle);
  const oz = -Math.sin(angle);
  const wx = (f, o) => origin.x + fx * f + ox * o;
  const wz = (f, o) => origin.z + fz * f + oz * o;

  /* Floor type reads left to right for a driver arriving along the
     trail: the top of each glyph points forward, so the group turns
     by angle plus pi. */
  const READ = Math.PI / 4;

  function label(text, size, f, o, opts) {
    const t = helpers.floorText(text, size, opts);
    t.position.set(wx(f, o), 0, wz(f, o));
    t.rotation.y = READ;
    ctx.addStatic(t);
    return t;
  }

  /* Eyebrow, met first on the way in. */
  label("04 / Education", 1.0, -18, 10.5, { colour: "brass", tracking: 0.12 });

  /* The colonnade: thirteen papers in a row. The first ten stand in
     brass, the last three wait in grey. */
  const colBrass = helpers.column(0.45, 3.2);
  const colGrey = helpers.column(0.45, 3.2, { line: GREY, opacity: 0.45 });
  for (let i = 0; i < 13; i += 1) {
    let col;
    if (i === 0) col = colBrass;
    else if (i < 10) col = colBrass.clone();
    else if (i === 10) col = colGrey;
    else col = colGrey.clone();
    const f = -12 + i * 2;
    col.position.set(wx(f, 11), 0, wz(f, 11));
    ctx.addStatic(col, new CANNON.Cylinder(0.45, 0.45, 3.2, 8));
  }

  /* The tally, written large on the floor behind the columns. */
  label("10/13", 2.4, 1.0, 17.5, { colour: "brass" });
  label("ACCA", 1.0, -1.9, 17.5, { colour: "ink" });

  /* Two plinths: the MSc at BPP, the PgC at Cumbria. */
  const msc = helpers.plinth(4.6, 1.9, 4.6);
  msc.position.set(wx(-14, 19.5), 0, wz(-14, 19.5));
  msc.rotation.y = angle;
  ctx.addStatic(msc, new CANNON.Box(new CANNON.Vec3(2.3, 0.95, 2.3)));

  label("MSc", 1.1, -8.3, 17.0, { colour: "brass" });
  label("Accounting and Finance", 0.5, -9.3, 17.0, { colour: "ink", tracking: 0.08 });
  label("BPP University", 0.5, -10.2, 17.0, { colour: "grey", tracking: 0.08 });
  label("Merit", 0.7, -11.0, 17.0, { colour: "brass" });

  const pgc = helpers.plinth(4.6, 1.9, 4.6);
  pgc.position.set(wx(12, 19.5), 0, wz(12, 19.5));
  pgc.rotation.y = angle;
  ctx.addStatic(pgc, new CANNON.Box(new CANNON.Vec3(2.3, 0.95, 2.3)));

  label("PgC", 1.1, 8.7, 17.0, { colour: "brass" });
  label("Teaching and Learning", 0.5, 7.7, 17.0, { colour: "ink", tracking: 0.08 });
  label("University of Cumbria", 0.5, 6.8, 17.0, { colour: "grey", tracking: 0.08 });
  label("In progress", 0.7, 6.0, 17.0, { colour: "brass" });

  /* The side spur: a fork on the ground. One path ends in a grey
     block; the other carries on towards the trail. */
  const spurMat = new THREE.LineBasicMaterial({
    color: BRASS,
    transparent: true,
    opacity: 0.8,
  });
  function path(pts) {
    const v = pts.map((p) => new THREE.Vector3(wx(p[0], p[1]), 0.04, wz(p[0], p[1])));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(v), spurMat);
    ctx.addStatic(line);
  }
  path([[21.0, 14.8], [19.0, 11.6]]);                          /* shared stem */
  path([[19.0, 11.6], [20.5, 10.1], [21.2, 9.0]]);             /* into the block */
  path([[19.0, 11.6], [17.4, 9.0], [16.6, 6.9], [16.3, 5.3]]); /* on to the trail */

  const block = helpers.plinth(1.6, 1.0, 1.6, { line: GREY, opacity: 0.5 });
  block.position.set(wx(21.2, 9.0), 0, wz(21.2, 9.0));
  block.rotation.y = angle + 0.4;
  ctx.addStatic(block, new CANNON.Box(new CANNON.Vec3(0.8, 0.5, 0.8)));

  label("2022", 0.7, 21.2, 13.2, { colour: "grey" });

  const plaque = ctx.addLink(
    wx(17.6, 9.7),
    wz(17.6, 9.7),
    "Starting over",
    "/notes/starting-over-is-not-going-backwards/",
  );
  /* Turn the plaque so its label sits on the road side of the ring
     and reads along the direction of travel. */
  plaque.rotation.y = angle - Math.PI / 2;

  /* Three papers still to sit: a loose stack of grey slabs by the
     grey end of the colonnade. Knockable; they find their way home. */
  const slabProto = helpers.edged(new THREE.BoxGeometry(1.15, 0.16, 0.85), {
    line: GREY,
    opacity: 0.6,
  });
  const up = new CANNON.Vec3(0, 1, 0);
  const slabDefs = [
    { f: 10.0, o: 7.5, y: 0.08, yaw: 0 },
    { f: 10.06, o: 7.45, y: 0.245, yaw: 0.16 },
    { f: 9.95, o: 7.56, y: 0.41, yaw: -0.11 },
  ];
  const props = [];
  for (let i = 0; i < slabDefs.length; i += 1) {
    const d = slabDefs[i];
    const mesh = i === 0 ? slabProto : slabProto.clone();
    const body = new CANNON.Body({
      mass: 0.8,
      shape: new CANNON.Box(new CANNON.Vec3(0.575, 0.08, 0.425)),
      linearDamping: 0.2,
      angularDamping: 0.25,
    });
    body.position.set(wx(d.f, d.o), d.y, wz(d.f, d.o));
    body.quaternion.setFromAxisAngle(up, angle + d.yaw);
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);
    ctx.addDynamic(mesh, body);
    props.push({
      mesh,
      body,
      home: body.position.clone(),
      homeQ: body.quaternion.clone(),
    });
  }
  const stackShadow = helpers.blobShadow(1.3);
  stackShadow.position.set(wx(10.0, 7.5), 0.02, wz(10.0, 7.5));
  ctx.addStatic(stackShadow);

  /* Self restoring stack: once every slab is at rest and any slab
     has strayed from home, wait, then fade the lot back into place. */
  function allAtRest() {
    for (let i = 0; i < props.length; i += 1) {
      const v = props[i].body.velocity;
      const w = props[i].body.angularVelocity;
      if (v.x * v.x + v.y * v.y + v.z * v.z > REST_LIN
        || w.x * w.x + w.y * w.y + w.z * w.z > REST_ANG) return false;
    }
    return true;
  }
  let awayFor = 0;
  let fade = -1;
  ctx.onUpdate((dt) => {
    if (fade >= 0) {
      /* Struck mid fade, before the teleport: abandon the restore so
         it never fights the car; the idle watch will retry later. */
      if (fade < FADE_HALF && !allAtRest()) {
        fade = -1;
        awayFor = 0;
        for (let i = 0; i < props.length; i += 1) props[i].mesh.scale.setScalar(1);
        return;
      }
      const before = fade;
      fade += dt;
      if (before < FADE_HALF && fade >= FADE_HALF) {
        for (let i = 0; i < props.length; i += 1) {
          const p = props[i];
          p.body.position.copy(p.home);
          p.body.quaternion.copy(p.homeQ);
          p.body.velocity.set(0, 0, 0);
          p.body.angularVelocity.set(0, 0, 0);
          p.body.wakeUp();
        }
      }
      let s;
      if (fade >= FADE_FULL) {
        s = 1;
        fade = -1;
      } else if (fade < FADE_HALF) {
        s = 1 - fade / FADE_HALF;
      } else {
        s = (fade - FADE_HALF) / FADE_HALF;
      }
      const clamped = Math.min(1, Math.max(0.001, s));
      for (let i = 0; i < props.length; i += 1) props[i].mesh.scale.setScalar(clamped);
      return;
    }
    let anyAway = false;
    for (let i = 0; i < props.length; i += 1) {
      const b = props[i].body;
      const h = props[i].home;
      const dx = b.position.x - h.x;
      const dy = b.position.y - h.y;
      const dz = b.position.z - h.z;
      if (dx * dx + dy * dy + dz * dz > AWAY_SQ) {
        anyAway = true;
        break;
      }
    }
    if (anyAway && allAtRest()) {
      awayFor += dt;
      if (awayFor >= RESTORE_AFTER) {
        awayFor = 0;
        fade = 0;
      }
    } else {
      awayFor = 0;
    }
  });
}
