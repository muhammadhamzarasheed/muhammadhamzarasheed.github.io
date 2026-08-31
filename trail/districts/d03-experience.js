/* 03 / Experience. The roles timeline: one plinth per role the record
   lists, ordered by start date along the trail, heights stepping
   upward toward the present. A drivable ramp closes the line, because
   the record keeps going. All copy is lifted from the homepage record. */

export const id = "d03-experience";
export const index = 3;
export const title = "Experience";
export const anchor = "#experience";

/* The five roles exactly as the homepage lists them, reordered
   earliest first so the drive through the district reads forward
   in time. Dates are the record's own, written "X to Y". */
const ROLES = [
  { role: "Accounting Associate", who: "Atom Services", dates: "Jan 2019 to Dec 2021" },
  { role: "Sales Associate", who: "Skechers", dates: "Sep 2022 to present" },
  { role: "Student Ambassador", who: "BPP University", dates: "Feb 2024 to Feb 2025" },
  { role: "Student Voice Representative", who: "BPP Students Association", dates: "Jul 2024 to Feb 2025" },
  { role: "Assessment Lead", who: "UK Management College", dates: "Jul 2026 to present" },
];

const ROW_OUT = 20;      /* the plinth row, well clear of the kerb */
const TEXT_OUT = 11.5;   /* centre line of the floor text blocks */
const SPACING = 6.2;     /* plinth pitch along the trail */
const FIRST_ALONG = -13; /* the earliest role sits here */

export function build(ctx) {
  const { THREE, CANNON, helpers, origin, angle } = ctx;

  const fX = Math.sin(angle);
  const fZ = Math.cos(angle);
  const oX = Math.cos(angle);
  const oZ = -Math.sin(angle);

  /* along is forward on the trail; out is away from the loop centre. */
  const place = (obj, along, out) => {
    obj.position.set(
      origin.x + fX * along + oX * out,
      0,
      origin.z + fZ * along + oZ * out,
    );
  };

  /* Floor type reads left to right for a driver arriving along the
     trail direction, so every text group faces back down the road. */
  const READ = Math.PI / 4;

  const label = (text, size, colour, along, out) => {
    const t = helpers.floorText(text, size, { colour });
    place(t, along, out);
    t.rotation.y = READ;
    ctx.addStatic(t);
  };

  /* District eyebrow and the section heading, on the way in. */
  label("03 / Experience", 1.1, "brass", -19.5, 12);
  label("Where the method was built.", 0.58, "ink", -17.3, 12);

  /* The timeline: one plinth per role, stepping up to the present.
     Each block reads title, employer, dates as it is driven past. */
  ROLES.forEach((entry, i) => {
    const along = FIRST_ALONG + i * SPACING;
    const h = 0.85 + i * 0.35;

    const p = helpers.plinth(4.2, h, 4.2);
    place(p, along, ROW_OUT);
    p.rotation.y = angle;
    ctx.addStatic(p, new CANNON.Box(new CANNON.Vec3(2.1, h / 2, 2.1)));

    label(entry.role, 0.5, "ink", along + 1.25, TEXT_OUT);
    label(entry.who, 0.42, "grey", along, TEXT_OUT);
    label(entry.dates, 0.42, "grey", along - 1.25, TEXT_OUT);
  });

  /* The ramp at the end of the timeline: a static drivable wedge,
     6 wide, rising at 15 degrees, aimed onwards along the trail. */
  const theta = Math.PI / 12;
  const RAMP_L = 6.8;
  const RAMP_ALONG = 18.7;            /* centre of the wedge base */
  const H = RAMP_L * Math.tan(theta); /* about 1.82 at the high end */
  const hw = 3;
  const hl = RAMP_L / 2;

  /* Triangular prism, low edge toward the arriving driver. */
  const v = [
    [-hw, 0, -hl], [hw, 0, -hl], [hw, 0, hl],
    [-hw, 0, hl], [-hw, H, hl], [hw, H, hl],
  ];
  const tris = [
    [0, 5, 1], [0, 4, 5], /* slope */
    [2, 5, 4], [2, 4, 3], /* high face */
    [0, 3, 4],            /* left side */
    [1, 5, 2],            /* right side */
    [0, 1, 2], [0, 2, 3], /* underside */
  ];
  const pos = new Float32Array(tris.length * 9);
  tris.forEach((tri, i) => {
    tri.forEach((vi, j) => pos.set(v[vi], i * 9 + j * 3));
  });
  const wedgeGeo = new THREE.BufferGeometry();
  wedgeGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  wedgeGeo.computeVertexNormals();

  const wedge = new THREE.Group();
  wedge.add(helpers.edged(wedgeGeo), helpers.blobShadow(4.2));
  place(wedge, RAMP_ALONG, ROW_OUT);
  wedge.rotation.y = angle;

  /* Physics: a thin static slab lying flush along the slope face. */
  const slopeHalf = RAMP_L / (2 * Math.cos(theta));
  const body = new CANNON.Body({ mass: 0 });
  body.addShape(new CANNON.Box(new CANNON.Vec3(hw, 0.18, slopeHalf)));
  const pitch = new CANNON.Quaternion();
  pitch.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -theta);
  const yaw = new CANNON.Quaternion();
  yaw.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
  yaw.mult(pitch, body.quaternion);
  const cy = H / 2 - 0.18 * Math.cos(theta);
  const cz = 0.18 * Math.sin(theta);
  body.position.set(
    wedge.position.x + fX * cz,
    cy,
    wedge.position.z + fZ * cz,
  );
  ctx.addStatic(wedge, null, body);

  label("onwards", 0.8, "brass", RAMP_ALONG, 13);
}
