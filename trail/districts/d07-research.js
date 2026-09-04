/* 07 / Research. A reading room off the trail, closest kin to the
   Journal: four lecterns stand in a shallow arc, one for each working
   paper on the record. Before each lectern sits a brass plaque named
   by the paper's own running head; press E or tap and the paper opens
   in its own tab, so the record stays where you left it. Beneath each
   plaque, a short line from the paper's own subtitle, ruled in ink
   across the floor. All copy is lifted from the papers themselves. */

export const id = "d07-research";
export const index = 7;
export const title = "Research";
export const anchor = "#research";

/* The four working papers in the order the record keeps them, posted
   pair first, running heads exactly as the papers carry them; each
   links to its reader under /papers/. */
const PAPERS = [
  {
    slug: "acca-embedded-masters",
    head: "Integration or compression?",
    line: "A document analysis of ACCA-embedded master's programmes",
  },
  {
    slug: "convergence-without-equivalence",
    head: "Convergence without equivalence",
    line: "UK sustainability reporting standards, the amended CSRD",
  },
  {
    slug: "reliance-in-partnership-assessment",
    head: "Accountability and reliance",
    line: "An audit-standards perspective on higher education",
  },
  {
    slug: "feedback-delivery-to-feedback-use",
    head: "From feedback delivery to feedback use",
    line: "A critical review with implications for accounting education",
  },
];

/* Room plan, in the district's local frame: a runs outward from the
   station centre, b runs along the trail. The arc bulges outward,
   opening toward the road; kept compact, eight stations sitting
   closer together than seven ever did. */
const ROOM_A = 9;                     /* room centre, outward of the kerb */
const LECTERN_R = 13;                 /* lectern arc radius */
const PLAQUE_R = 9;                   /* plaque radius on each radial */
const TITLE_A = 12;                   /* outward centre for the ruled lines */

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
  const eyebrow = helpers.floorText("07 / Research", 1.3, { colour: "brass" });
  eyebrow.position.set(wx(11, -18), 0, wz(11, -18));
  eyebrow.rotation.y = readable;
  ctx.addStatic(eyebrow);

  /* One lectern built once, cloned four times so the geometry is
     shared: a slim plinth with a tilted reading board on top. */
  const lecternTpl = new THREE.Group();
  const lecternBase = helpers.plinth(1.2, 1.5, 0.8);
  const lecternBoard = helpers.edged(new THREE.BoxGeometry(1.05, 0.07, 0.75));
  lecternBoard.position.set(0, 1.53, 0.1);
  lecternBoard.rotation.x = 0.32;
  lecternTpl.add(lecternBase, lecternBoard);
  const lecternShape = new CANNON.Box(new CANNON.Vec3(0.6, 0.8, 0.45));

  for (let k = 0; k < PAPERS.length; k += 1) {
    const paper = PAPERS[k];
    const t = ((-60 + 40 * k) * Math.PI) / 180;
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
    const pa = ROOM_A + PLAQUE_R * ca;
    const pb = PLAQUE_R * sa;
    const plaque = ctx.addLink(
      wx(pa, pb),
      wz(pa, pb),
      paper.head,
      "/papers/" + paper.slug + "/",
    );
    plaque.rotation.y = readable;

    /* A line of the paper's own subtitle, ruled in small ink. */
    const line = helpers.floorText(paper.line, 0.42, { colour: "ink", tracking: 0.06 });
    line.position.set(wx(TITLE_A, lb), 0, wz(TITLE_A, lb));
    line.rotation.y = readable;
    ctx.addStatic(line);
  }
}
