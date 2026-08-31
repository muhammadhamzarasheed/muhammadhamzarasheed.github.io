/* 06 / Field notes. The play corner: the part of the record that does
   not have to tie out. A drivable ramp, a pyramid of ten receipts
   boxes that restacks itself, a tiebreaker coin to shove about, and
   two plaques pointing outward, to the games and to the appendix.
   All copy is lifted from the homepage and the appendix. */

export const id = "d06-field-notes";
export const index = 6;
export const title = "Field notes";
export const anchor = "#elsewhere";

/* Self restoring props: once a prop has sat still away from home for
   this long, it shrinks, teleports home and grows back. */
const RESTORE_AFTER = 8;
const SHRINK_TIME = 0.25;
const GROW_TIME = 0.35;

/* The ramp: a tilted slab, low edge buried so the lip is flush with
   the ground and the car rolls straight on. */
const RAMP_W = 5;
const RAMP_L = 11;
const RAMP_T = 0.5;
const RAMP_TILT = Math.PI / 15;      /* twelve degrees */

const BOX_U = 0.65;                  /* receipts box: across the plot */
const BOX_H = 0.5;
const BOX_V = 0.9;                   /* along the trail axis */

const COIN_R = 2;
const COIN_H = 0.35;

export function build(ctx) {
  const { THREE, CANNON, helpers, origin, angle } = ctx;

  /* Plot axes. u runs outward from the road, v runs along the trail. */
  const outX = Math.cos(angle);
  const outZ = -Math.sin(angle);
  const px = (u, v) => origin.x + outX * u + Math.sin(angle) * v;
  const pz = (u, v) => origin.z + outZ * u + Math.cos(angle) * v;

  const yAxis = new THREE.Vector3(0, 1, 0);
  const plotQ = new THREE.Quaternion().setFromAxisAngle(yAxis, angle);

  /* Floor text orientation, checked for this station rather than
     copied from the stub. The camera offset is fixed at (20, 26, 20),
     so screen up on the ground is about (-0.71, -0.71). Station six
     sits south of the loop: outward is (-0.22, -0.97), within 33
     degrees of screen up, and forward is (0.97, -0.22), within 33
     degrees of screen right. So with glyph tops outward and the
     baseline running forward, angle minus a quarter turn, the type
     reads left to right and right side up for a driver arriving
     along the trail here. */
  const textRot = Math.PI / 4;
  function ground(text, size, colour, u, v) {
    const t = helpers.floorText(text, size, { colour });
    t.position.set(px(u, v), 0, pz(u, v));
    t.rotation.y = textRot;
    ctx.addStatic(t);
  }

  /* Eyebrow and the section's own words, laid in the ground. */
  ground("06 / Field notes", 1.3, "brass", 6, 0);
  ground("The part I do not try to control.", 0.62, "ink", 9.5, 0);
  ground("The rest, que sera, sera.", 0.55, "grey", 21, -16);
  ground("None of it had to tie out.", 0.55, "grey", 21, 8);
  ground("the receipts", 0.65, "grey", 10.5, 12);
  ground("the tiebreaker", 0.65, "grey", 10.5, -11.8);

  /* ---------- the ramp ---------- */
  /* Tilted about the plot's out axis so the run climbs forward along
     the trail; the low edge is sunk so the top face meets the ground. */
  const rampU = 21;
  const rampV = -4;
  const rampY = 0.02
    - (RAMP_T / 2) * Math.cos(RAMP_TILT)
    + (RAMP_L / 2) * Math.sin(RAMP_TILT);
  const rampQ = plotQ.clone().multiply(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -RAMP_TILT),
  );
  const ramp = helpers.edged(new THREE.BoxGeometry(RAMP_W, RAMP_T, RAMP_L));
  ramp.position.set(px(rampU, rampV), rampY, pz(rampU, rampV));
  ramp.quaternion.copy(rampQ);
  const rampBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(new CANNON.Vec3(RAMP_W / 2, RAMP_T / 2, RAMP_L / 2)),
  });
  rampBody.position.set(ramp.position.x, ramp.position.y, ramp.position.z);
  rampBody.quaternion.set(rampQ.x, rampQ.y, rampQ.z, rampQ.w);
  ctx.addStatic(ramp, null, rampBody);

  const rampShadow = helpers.blobShadow(5);
  rampShadow.position.set(px(rampU, rampV), 0.02, pz(rampU, rampV));
  ctx.addStatic(rampShadow);

  /* ---------- self restoring props ---------- */
  const props = [];

  function addProp(mesh, body, tipLimit, farSq) {
    body.linearDamping = 0.2;
    body.angularDamping = 0.3;
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);
    ctx.addDynamic(mesh, body);
    props.push({
      mesh,
      body,
      hx: body.position.x,
      hy: body.position.y,
      hz: body.position.z,
      qx: body.quaternion.x,
      qy: body.quaternion.y,
      qz: body.quaternion.z,
      qw: body.quaternion.w,
      tipLimit,
      farSq,
      awayT: 0,
      animT: 0,
      phase: 0,
    });
  }

  /* ---------- the receipts: a pyramid of ten boxes ---------- */
  const boxGeo = new THREE.BoxGeometry(BOX_U, BOX_H, BOX_V);
  const boxProto = helpers.edged(boxGeo);
  const rows = [4, 3, 2, 1];
  for (let row = 0; row < rows.length; row += 1) {
    const count = rows[row];
    const y = BOX_H / 2 + row * (BOX_H + 0.01);
    for (let i = 0; i < count; i += 1) {
      const v = 12 + (i - (count - 1) / 2) * (BOX_V + 0.05);
      const mesh = boxProto.clone();
      const body = new CANNON.Body({
        mass: 0.8,
        shape: new CANNON.Box(new CANNON.Vec3(BOX_U / 2, BOX_H / 2, BOX_V / 2)),
      });
      body.position.set(px(14, v), y, pz(14, v));
      body.quaternion.set(plotQ.x, plotQ.y, plotQ.z, plotQ.w);
      addProp(mesh, body, 0.85, 0.36);
    }
  }

  const stackShadow = helpers.blobShadow(2.6);
  stackShadow.position.set(px(14, 12), 0.02, pz(14, 12));
  ctx.addStatic(stackShadow);

  /* ---------- the tiebreaker: the coin from the appendix ---------- */
  const coin = helpers.edged(new THREE.CylinderGeometry(COIN_R, COIN_R, COIN_H, 24));
  const coinBody = new CANNON.Body({
    mass: 4,
    shape: new CANNON.Cylinder(COIN_R, COIN_R, COIN_H, 12),
  });
  coinBody.position.set(px(14, -12), COIN_H / 2 + 0.01, pz(14, -12));
  coinBody.quaternion.set(plotQ.x, plotQ.y, plotQ.z, plotQ.w);
  addProp(coin, coinBody, 0.75, 4);

  const coinShadow = helpers.blobShadow(2.4);
  coinShadow.position.set(px(14, -12), 0.02, pz(14, -12));
  ctx.addStatic(coinShadow);

  /* ---------- plaques, pointing outward ---------- */
  ctx.addLink(px(10, 18), pz(10, 18), "Something for your mind", "/mind/");
  ctx.addLink(px(10, -18), pz(10, -18), "The appendix", "/appendix/");

  /* ---------- reconciliation of the play corner ---------- */
  /* A prop that has sat still away from home for eight seconds
     shrinks, teleports back and grows again, so nothing can block
     the road for good. No allocation in here; it runs every frame. */
  ctx.onUpdate((dt) => {
    for (let i = 0; i < props.length; i += 1) {
      const p = props[i];
      const b = p.body;

      if (p.phase === 1) {
        p.animT += dt;
        p.mesh.scale.setScalar(Math.max(0.05, 1 - p.animT / SHRINK_TIME));
        if (p.animT >= SHRINK_TIME) {
          b.position.set(p.hx, p.hy, p.hz);
          b.quaternion.set(p.qx, p.qy, p.qz, p.qw);
          b.velocity.set(0, 0, 0);
          b.angularVelocity.set(0, 0, 0);
          b.wakeUp();
          p.phase = 2;
          p.animT = 0;
        }
        continue;
      }

      if (p.phase === 2) {
        p.animT += dt;
        p.mesh.scale.setScalar(Math.min(1, 0.05 + (p.animT / GROW_TIME) * 0.95));
        if (p.animT >= GROW_TIME) {
          p.mesh.scale.setScalar(1);
          p.phase = 0;
          p.awayT = 0;
        }
        continue;
      }

      const dx = b.position.x - p.hx;
      const dy = b.position.y - p.hy;
      const dz = b.position.z - p.hz;
      const q = b.quaternion;
      const upY = 1 - 2 * (q.x * q.x + q.z * q.z);
      const displaced = dx * dx + dy * dy + dz * dz > p.farSq || upY < p.tipLimit;
      if (!displaced) {
        p.awayT = 0;
        continue;
      }
      const v = b.velocity;
      const w = b.angularVelocity;
      const still = v.x * v.x + v.y * v.y + v.z * v.z < 0.03
        && w.x * w.x + w.y * w.y + w.z * w.z < 0.03;
      p.awayT = still ? p.awayT + dt : 0;
      if (p.awayT >= RESTORE_AFTER) {
        p.phase = 1;
        p.animT = 0;
      }
    }
  });
}
