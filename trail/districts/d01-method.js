/* 01 / Method. Three standing tablets in a gentle arc facing the
   road, one per rule of the method, each with its principle lettered
   on the ground before it and a brass numeral alongside. Beside the
   tablets, a neat stack of six workings boxes to knock about; the
   stack squares itself away again after a while, as workings should.
   All copy is lifted from the homepage method section. */

export const id = "d01-method";
export const index = 1;
export const title = "Method";
export const anchor = "#method";

/* Knockable boxes with their home transforms; the stack shares one
   home yaw. Populated in build, eased home in update. */
const crates = [];
let homeYaw = null;

const SETTLE_SECONDS = 8;    /* rest away from home this long, then return */
const POP_SECONDS = 0.35;    /* small scale fade as a returned box lands */

export function build(ctx) {
  const { THREE, CANNON, helpers, origin, angle } = ctx;

  /* Local frame: s runs forward along the trail, d runs outward,
     away from the loop centre and clear of the road. */
  const fx = Math.sin(angle);
  const fz = Math.cos(angle);
  const ox = Math.cos(angle);
  const oz = -Math.sin(angle);
  const px = (s, d) => origin.x + fx * s + ox * d;
  const pz = (s, d) => origin.z + fz * s + oz * d;

  /* Floor type set to read left to right for a driver arriving along
     the trail: glyph tops point down the direction of travel, and the
     line runs across the driver's view. */
  const READ = Math.PI / 4;

  /* ---------- eyebrow ---------- */
  /* Met first on the way in, before the tablets. */
  const eyebrow = helpers.floorText("01 / Method", 1.4, { colour: "brass" });
  eyebrow.position.set(px(-15, 11.5), 0, pz(-15, 11.5));
  eyebrow.rotation.y = READ;
  ctx.addStatic(eyebrow);

  /* ---------- the three tablets ---------- */
  /* A gentle arc bowing away from the road, the outer two toed in a
     touch so all three faces address the kerb. Principles are ink on
     the ground before each tablet; numerals sit brass at its foot. */
  const RULES = [
    { n: "01", text: "Reconcile before you report", s: -8, d: 19, toe: 0.22 },
    { n: "02", text: "Evidence every decision", s: 0, d: 21, toe: 0 },
    { n: "03", text: "Build the audit trail as you go", s: 8, d: 19, toe: -0.22 },
  ];

  const tabletProto = helpers.plinth(4, 5, 0.8);
  const tabletShape = new CANNON.Box(new CANNON.Vec3(2, 2.5, 0.4));

  for (let i = 0; i < RULES.length; i += 1) {
    const rule = RULES[i];

    const tablet = i === 0 ? tabletProto : tabletProto.clone();
    tablet.position.set(px(rule.s, rule.d), 0, pz(rule.s, rule.d));
    tablet.rotation.y = angle - Math.PI / 2 + rule.toe;
    ctx.addStatic(tablet, tabletShape);

    /* The principle, in ink, ending a stride short of the tablet and
       running back toward the road. Centred off its measured width so
       long and short lines all land the same clearance. */
    const line = helpers.floorText(rule.text, 0.5, { colour: "ink" });
    const lineW = line.children[0].geometry.parameters.width;
    const lineD = rule.d - 1.4 - lineW / 2;
    line.position.set(px(rule.s, lineD), 0, pz(rule.s, lineD));
    line.rotation.y = READ;
    ctx.addStatic(line);

    const numeral = helpers.floorText(rule.n, 0.8, { colour: "brass" });
    numeral.position.set(px(rule.s + 1.2, rule.d - 3), 0, pz(rule.s + 1.2, rule.d - 3));
    numeral.rotation.y = READ;
    ctx.addStatic(numeral);
  }

  /* ---------- the workings ---------- */
  /* Six small boxes stacked three, two, one beside the third tablet.
     Dynamic, knockable, and self restoring: each remembers its home
     and is put back once it has rested elsewhere long enough. */
  const boxGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
  const boxProto = helpers.edged(boxGeo);
  const boxShape = new CANNON.Box(new CANNON.Vec3(0.4, 0.4, 0.4));
  homeYaw = new CANNON.Quaternion();
  homeYaw.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);

  /* [offset along the trail, resting height], tiny gaps so nothing
     spawns intersecting. */
  const STACK = [
    [-0.85, 0.4], [0, 0.4], [0.85, 0.4],
    [-0.425, 1.205], [0.425, 1.205],
    [0, 2.01],
  ];

  crates.length = 0;
  for (let i = 0; i < STACK.length; i += 1) {
    const hx = px(15 + STACK[i][0], 13);
    const hy = STACK[i][1];
    const hz = pz(15 + STACK[i][0], 13);

    const mesh = i === 0 ? boxProto : boxProto.clone();
    const body = new CANNON.Body({ mass: 1.2, shape: boxShape });
    body.position.set(hx, hy, hz);
    body.quaternion.copy(homeYaw);
    body.linearDamping = 0.2;
    body.angularDamping = 0.2;
    ctx.addDynamic(mesh, body);

    /* A grounded shadow per box; update keeps it under the box. */
    const shadow = helpers.blobShadow(0.7);
    shadow.position.x = hx;
    shadow.position.z = hz;
    ctx.addStatic(shadow);

    crates.push({ body, mesh, shadow, hx, hy, hz, timer: 0, pop: 0 });
  }

  const tag = helpers.floorText("the workings", 0.6, { colour: "grey" });
  tag.position.set(px(15, 8.8), 0, pz(15, 8.8));
  tag.rotation.y = READ;
  ctx.addStatic(tag);
}

export function update(dt) {
  for (let i = 0; i < crates.length; i += 1) {
    const c = crates[i];
    const b = c.body;

    /* Shadows track the boxes on the flat, never leaving the ground. */
    c.shadow.position.x = b.position.x;
    c.shadow.position.z = b.position.z;

    /* Finish the landing fade of a freshly returned box. */
    if (c.pop > 0) {
      c.pop -= dt;
      if (c.pop < 0) c.pop = 0;
      c.mesh.scale.setScalar(0.25 + 0.75 * (1 - c.pop / POP_SECONDS));
    }

    /* Away from home, at rest, for long enough: put it back. */
    const dx = b.position.x - c.hx;
    const dy = b.position.y - c.hy;
    const dz = b.position.z - c.hz;
    const q = b.quaternion;
    const dot = q.x * homeYaw.x + q.y * homeYaw.y + q.z * homeYaw.z + q.w * homeYaw.w;
    const moved = dx * dx + dy * dy + dz * dz > 0.12 || dot * dot < 0.98;
    if (!moved) {
      c.timer = 0;
      continue;
    }

    const v = b.velocity;
    const w = b.angularVelocity;
    const still =
      v.x * v.x + v.y * v.y + v.z * v.z < 0.04 &&
      w.x * w.x + w.y * w.y + w.z * w.z < 0.05;
    if (!still) {
      c.timer = 0;
      continue;
    }

    c.timer += dt;
    if (c.timer < SETTLE_SECONDS) continue;
    c.timer = 0;
    b.position.set(c.hx, c.hy, c.hz);
    b.quaternion.copy(homeYaw);
    b.velocity.set(0, 0, 0);
    b.angularVelocity.set(0, 0, 0);
    b.wakeUp();
    c.pop = POP_SECONDS;
    c.mesh.scale.setScalar(0.25);
  }
}
