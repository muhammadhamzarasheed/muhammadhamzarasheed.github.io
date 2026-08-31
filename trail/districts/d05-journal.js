/* 05 / Journal. A reading room off the trail: seven lecterns stand in
   a semicircle, one for each Journal entry on the record. Before each
   lectern sits a brass plaque labelled with the entry number; press E
   or tap on a plaque and the essay opens in its own tab, so the record
   stays where you left it. The seven titles are ruled across the floor
   of the room in ink, like an index. Three loose volumes can be nudged
   about; left alone for a while, they find their way home. */

export const id = "d05-journal";
export const index = 5;
export const title = "Journal";
export const anchor = "#journal";

/* The seven entries, numbered and titled exactly as the homepage
   Journal section lists them; each links to its page under /notes/. */
const ENTRIES = [
  { n: "01", slug: "accuracy-is-an-equity-issue", title: "Accuracy is an equity issue" },
  { n: "02", slug: "starting-over-is-not-going-backwards", title: "Starting over is not going backwards" },
  { n: "03", slug: "the-person-you-are-becoming", title: "The person you are becoming" },
  { n: "04", slug: "rest-is-not-a-reward", title: "Rest is not a reward" },
  { n: "05", slug: "the-wrong-rulebook", title: "The wrong rulebook" },
  { n: "06", slug: "what-cannot-be-cured", title: "What cannot be cured" },
  { n: "07", slug: "you-never-know-who-is-watching", title: "You never know who is watching" },
];

/* Room plan, in the district's local frame: a runs outward from the
   station centre, b runs along the trail. The semicircle bulges
   outward; its opening faces the road. */
const ROOM_A = 10;                    /* room centre, outward of the kerb */
const LECTERN_R = 17.5;               /* lectern semicircle radius */
const PLAQUE_R = 12;                  /* plaque radius on each radial */
const PLAQUE_R_WIDE = 12.8;           /* two rows eased out so the plate
                                         text clears the neighbouring ring */
/* Outward centres for the seven title lines ruled across the floor,
   tuned so no line crosses a ring, a plate or the station circle. */
const TITLE_A = [12, 13.4, 13.5, 14, 14, 13.4, 12];

/* Loose volumes: local spot and a little yaw each, clear of the road,
   the plaques and the ruled titles. */
const BOOKS = [
  { a: 12.5, b: -9.3, yaw: 0.45 },
  { a: 17.5, b: 4.7, yaw: -0.3 },
  { a: 25.2, b: -1.6, yaw: 0.9 },
];

const REST_DELAY = 8;                 /* seconds at rest before a volume returns */
const FADE = 0.35;                    /* seconds for each half of the return fade */

export function build(ctx) {
  const { THREE, CANNON, helpers, origin, angle } = ctx;

  const ux = Math.cos(angle);
  const uz = -Math.sin(angle);
  const vx = Math.sin(angle);
  const vz = Math.cos(angle);
  const wx = (a, b) => origin.x + ux * a + vx * b;
  const wz = (a, b) => origin.z + uz * a + vz * b;

  /* Floor type rotated so it reads left to right for a driver arriving
     along the trail direction. */
  const readable = Math.PI / 4;

  /* Eyebrow on the approach, read before the room arrives. */
  const eyebrow = helpers.floorText("05 / Journal", 1.3, { colour: "brass" });
  eyebrow.position.set(wx(13, -20), 0, wz(13, -20));
  eyebrow.rotation.y = readable;
  ctx.addStatic(eyebrow);

  /* One lectern built once, cloned seven times so the geometry is
     shared: a slim plinth with a tilted reading board on top. */
  const lecternTpl = new THREE.Group();
  const lecternBase = helpers.plinth(1.2, 1.5, 0.8);
  const lecternBoard = helpers.edged(new THREE.BoxGeometry(1.05, 0.07, 0.75));
  lecternBoard.position.set(0, 1.53, 0.1);
  lecternBoard.rotation.x = 0.32;
  lecternTpl.add(lecternBase, lecternBoard);
  const lecternShape = new CANNON.Box(new CANNON.Vec3(0.6, 0.8, 0.45));

  for (let k = 0; k < ENTRIES.length; k += 1) {
    const entry = ENTRIES[k];
    const t = ((-90 + 30 * k) * Math.PI) / 180;
    const ca = Math.cos(t);
    const sa = Math.sin(t);

    /* Lectern on the arc, turned to face the centre of the room. */
    const la = ROOM_A + LECTERN_R * ca;
    const lb = LECTERN_R * sa;
    const lectern = k === 0 ? lecternTpl : lecternTpl.clone();
    lectern.position.set(wx(la, lb), 0, wz(la, lb));
    lectern.rotation.y = angle + Math.atan2(-ca, -sa);
    ctx.addStatic(lectern, lecternShape);

    /* Plaque before the lectern, on the radial line toward the room
       centre. Rotating the group swings its label plate onto the
       approach side, readable on the way in. */
    const pr = k === 2 || k === 4 ? PLAQUE_R_WIDE : PLAQUE_R;
    const pa = ROOM_A + pr * ca;
    const pb = pr * sa;
    const plaque = ctx.addLink(
      wx(pa, pb),
      wz(pa, pb),
      "Entry " + entry.n,
      "/notes/" + entry.slug + "/",
    );
    plaque.rotation.y = readable;

    /* The entry title, ruled in small ink across the room floor. */
    const tb = -7.5 + 2.5 * k;
    const line = helpers.floorText(entry.title, 0.45, { colour: "ink", tracking: 0.06 });
    line.position.set(wx(TITLE_A[k], tb), 0, wz(TITLE_A[k], tb));
    line.rotation.y = readable;
    ctx.addStatic(line);
  }

  /* Three loose volumes, knockable and self restoring. */
  const bookTpl = new THREE.Group();
  bookTpl.add(helpers.edged(new THREE.BoxGeometry(0.85, 0.28, 0.6)));
  const bookShadow = helpers.blobShadow(0.65);
  bookShadow.position.y = -0.12;
  bookTpl.add(bookShadow);
  const bookShape = new CANNON.Box(new CANNON.Vec3(0.425, 0.14, 0.3));
  const up = new CANNON.Vec3(0, 1, 0);

  const books = [];
  for (let k = 0; k < BOOKS.length; k += 1) {
    const spec = BOOKS[k];
    const mesh = k === 0 ? bookTpl : bookTpl.clone();
    const body = new CANNON.Body({ mass: 1.1, shape: bookShape });
    body.position.set(wx(spec.a, spec.b), 0.145, wz(spec.a, spec.b));
    body.quaternion.setFromAxisAngle(up, angle + spec.yaw);
    body.linearDamping = 0.2;
    body.angularDamping = 0.3;
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);
    ctx.addDynamic(mesh, body);
    books.push({
      mesh,
      body,
      hx: body.position.x,
      hy: body.position.y,
      hz: body.position.z,
      hq: body.quaternion.clone(),
      timer: 0,
      phase: 0,
      animT: 0,
    });
  }

  /* A volume that has come to rest away from home for a while shrinks
     out, returns home and grows back; nothing can hold the room, or
     the road, out of order for long. No allocation per frame. */
  ctx.onUpdate((dt) => {
    for (const bk of books) {
      if (bk.phase === 0) {
        const dx = bk.body.position.x - bk.hx;
        const dz = bk.body.position.z - bk.hz;
        const q = bk.body.quaternion;
        const dot = Math.abs(
          q.x * bk.hq.x + q.y * bk.hq.y + q.z * bk.hq.z + q.w * bk.hq.w,
        );
        const displaced = dx * dx + dz * dz > 0.25 || dot < 0.99;
        const still =
          bk.body.velocity.lengthSquared() < 0.02 &&
          bk.body.angularVelocity.lengthSquared() < 0.05;
        bk.timer = displaced && still ? bk.timer + dt : 0;
        if (bk.timer >= REST_DELAY) {
          bk.phase = 1;
          bk.animT = 0;
        }
      } else if (bk.phase === 1) {
        bk.animT += dt;
        bk.mesh.scale.setScalar(Math.max(0.02, 1 - bk.animT / FADE));
        if (bk.animT >= FADE) {
          bk.body.velocity.set(0, 0, 0);
          bk.body.angularVelocity.set(0, 0, 0);
          bk.body.position.set(bk.hx, bk.hy, bk.hz);
          bk.body.quaternion.copy(bk.hq);
          bk.body.sleep();
          bk.phase = 2;
          bk.animT = 0;
          bk.timer = 0;
        }
      } else {
        bk.animT += dt;
        const s = Math.min(1, bk.animT / FADE);
        bk.mesh.scale.setScalar(s);
        if (s >= 1) bk.phase = 0;
      }
    }
  });
}
