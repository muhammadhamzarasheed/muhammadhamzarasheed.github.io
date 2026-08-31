/* 02 / Now. Assessment Lead at UK Management College in Manchester.
   The scope, straight from the record: 12,000 plus students in scope,
   seven programmes, six campuses, four validating partner universities.
   Counts on the ground, a skyline of six campus blocks, a rack of
   seven programme skittles the car can bowl through, and four slender
   columns for the partners. The exported names and the
   { id, index, title, anchor, build } shape are load bearing. */

export const id = "d02-now";
export const index = 2;
export const title = "Now";
export const anchor = "#now";

export function build(ctx) {
  const { THREE, CANNON, helpers, origin, angle } = ctx;

  /* Local frame: f runs forward along the trail, o runs outward from
     the loop centre, clear of the road. */
  const fwdX = Math.sin(angle);
  const fwdZ = Math.cos(angle);
  const outX = Math.cos(angle);
  const outZ = -Math.sin(angle);

  /* Floor type default reads along +x with glyph tops toward -z.
     A driver arriving along the trail faces (sin angle, 0, cos angle),
     so glyph tops must point along that heading and the baseline must
     run along the driver's right. Both solve to angle + PI. */
  const readRot = Math.PI / 4;

  const place = (obj, f, o) => {
    obj.position.set(
      origin.x + fwdX * f + outX * o,
      0,
      origin.z + fwdZ * f + outZ * o,
    );
  };

  /* ---------- eyebrow ---------- */

  const eyebrow = helpers.floorText("02 / Now", 1.3, { colour: "brass" });
  place(eyebrow, -4, 9.5);
  eyebrow.rotation.y = readRot;
  ctx.addStatic(eyebrow);

  /* ---------- the monument: 12,000 students in scope ---------- */

  const figure = helpers.floorText("12,000", 2.8, { colour: "brass" });
  place(figure, 2, 14);
  figure.rotation.y = readRot;
  ctx.addStatic(figure);

  const caption = helpers.floorText("students across six campuses", 0.8, {
    colour: "ink",
  });
  place(caption, -1.6, 14.3);
  caption.rotation.y = readRot;
  ctx.addStatic(caption);

  /* ---------- six campus blocks, a small skyline behind it ---------- */

  const blocks = [
    [-13.0, 26.0, 3.0, 3.4, 3.0],
    [-8.0, 25.2, 2.6, 2.2, 2.6],
    [-3.0, 26.6, 2.8, 5.0, 2.8],
    [2.5, 25.6, 2.6, 2.8, 2.6],
    [7.5, 26.4, 3.2, 4.2, 3.2],
    [12.5, 25.4, 2.4, 2.0, 2.4],
  ];
  for (const [f, o, w, h, d] of blocks) {
    const block = helpers.plinth(w, h, d);
    place(block, f, o);
    block.rotation.y = angle;
    ctx.addStatic(block, new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)));
  }

  /* ---------- seven programme skittles, a 2-3-2 rack ---------- */

  const PIN_R = 0.5;
  const PIN_H = 2.2;
  const pinGeometry = new THREE.CylinderGeometry(PIN_R, PIN_R, PIN_H, 10);
  const pinSpots = [
    [-12.8, 7.5], [-11.0, 7.5],
    [-13.7, 9.2], [-11.9, 9.2], [-10.1, 9.2],
    [-12.8, 10.9], [-11.0, 10.9],
  ];
  const pins = [];
  for (const [f, o] of pinSpots) {
    const homeX = origin.x + fwdX * f + outX * o;
    const homeZ = origin.z + fwdZ * f + outZ * o;

    const mesh = helpers.edged(pinGeometry);
    const body = new CANNON.Body({
      mass: 1.2,
      shape: new CANNON.Cylinder(PIN_R, PIN_R, PIN_H, 10),
      linearDamping: 0.2,
      angularDamping: 0.25,
    });
    body.position.set(homeX, PIN_H / 2, homeZ);
    ctx.addDynamic(mesh, body);

    const shadow = helpers.blobShadow(1.2);
    shadow.position.set(homeX, 0.02, homeZ);
    ctx.addStatic(shadow);

    pins.push({ body, mesh, homeX, homeZ, rest: 0, pop: 0 });
  }

  const rackLabel = helpers.floorText("seven programmes", 0.85, {
    colour: "grey",
  });
  place(rackLabel, -15.5, 11);
  rackLabel.rotation.y = readRot;
  ctx.addStatic(rackLabel);

  /* ---------- four slender columns for the partners ---------- */

  const COL_R = 0.38;
  const COL_H = 5.5;
  for (let i = 0; i < 4; i += 1) {
    const col = helpers.column(COL_R, COL_H);
    place(col, 12, 7 + i * 3);
    ctx.addStatic(col, new CANNON.Cylinder(COL_R, COL_R, COL_H, 6));
  }

  const partnerLabel = helpers.floorText("four partner universities", 0.85, {
    colour: "grey",
  });
  place(partnerLabel, 15.8, 14.5);
  partnerLabel.rotation.y = readRot;
  ctx.addStatic(partnerLabel);

  /* ---------- self restoring rack ---------- */

  /* A pin counts as displaced once it has left its spot or its lean
     passes about 25 degrees. After 8 seconds at rest away from home it
     teleports back with a quick scale in, so a bowled rack always
     re racks itself and nothing blocks the road for good. Scalar
     maths only in here; nothing is allocated per frame. */
  const DISP2 = 0.25;
  const UP_MIN = 0.9;
  const STILL_V2 = 0.04;
  const STILL_W2 = 0.09;
  const RESTORE_AFTER = 8;
  /* A restore holds off while any other pin lies within 1.2 units of
     the home spot, otherwise the teleport lands one pin inside another
     and the solver detonates the pair. Rack spots sit 1.7 plus apart,
     so a correctly racked neighbour never blocks a restore. */
  const CLEAR2 = 1.44;

  ctx.onUpdate((dt) => {
    for (let i = 0; i < pins.length; i += 1) {
      const pin = pins[i];

      if (pin.pop > 0) {
        pin.pop = Math.max(0, pin.pop - dt * 2.5);
        pin.mesh.scale.setScalar(1 - pin.pop * 0.99);
      }

      const b = pin.body;
      const dx = b.position.x - pin.homeX;
      const dy = b.position.y - PIN_H / 2;
      const dz = b.position.z - pin.homeZ;
      const q = b.quaternion;
      const upY = 1 - 2 * (q.x * q.x + q.z * q.z);
      const displaced = dx * dx + dy * dy + dz * dz > DISP2 || upY < UP_MIN;

      const v = b.velocity;
      const w = b.angularVelocity;
      const still =
        v.x * v.x + v.y * v.y + v.z * v.z < STILL_V2 &&
        w.x * w.x + w.y * w.y + w.z * w.z < STILL_W2;

      if (displaced && still) pin.rest += dt;
      else pin.rest = 0;

      if (pin.rest > RESTORE_AFTER) {
        let clear = true;
        for (let j = 0; j < pins.length; j += 1) {
          if (j === i) continue;
          const other = pins[j].body.position;
          const ox = other.x - pin.homeX;
          const oz = other.z - pin.homeZ;
          if (ox * ox + oz * oz < CLEAR2) {
            clear = false;
            break;
          }
        }
        if (!clear) {
          /* Home occupied; stay down and retry next frame. */
          pin.rest = RESTORE_AFTER;
          continue;
        }
        pin.rest = 0;
        b.position.set(pin.homeX, PIN_H / 2, pin.homeZ);
        b.velocity.set(0, 0, 0);
        b.angularVelocity.set(0, 0, 0);
        b.quaternion.set(0, 0, 0, 1);
        b.wakeUp();
        pin.pop = 1;
        pin.mesh.scale.setScalar(0.01);
      }
    }
  });
}
