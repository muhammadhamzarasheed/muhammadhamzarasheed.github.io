/* The audit trail: the loose receipts. Fifteen slips of paper have
   blown off the ledger and settled around the ring and the plots; the
   car gathers one by driving through it. Session only, on purpose:
   nothing is stored, and every reload scatters them afresh. The spots
   are hand laid, clear of the road furniture and the district builds. */

const SPOTS = [
  { x: 60.4, z: 29.1 },     /* on the ring, between 01 and 02 */
  { x: 14.9, z: 65.3 },     /* on the ring, between 02 and 03 */
  { x: -25.6, z: 61.9 },    /* on the ring, between 03 and 04 */
  { x: -61.9, z: 25.6 },    /* on the ring, between 04 and 05 */
  { x: -61.9, z: -25.6 },   /* on the ring, between 05 and 06 */
  { x: 14.9, z: -65.3 },    /* on the ring, between 07 and 08 */
  { x: 60.4, z: -29.1 },    /* on the ring, between 08 and 01 */
  { x: 56.0, z: 2.0 },      /* inner apron, short of district 01 */
  { x: 30.0, z: -14.0 },    /* off the spawn apron */
  { x: 10.0, z: -10.0 },    /* by the centre lockup's approach */
  { x: 0.0, z: 38.0 },      /* inner field, north */
  { x: -6.0, z: -30.0 },    /* inner field, south */
  { x: -51.9, z: 64.8 },    /* outer verge, on the 03 to 04 arc */
  { x: 17.4, z: -76.0 },    /* outer verge, on the 07 to 08 arc */
  { x: -47.0, z: 22.2 },    /* inner field, toward 04 */
];

const COLLECT_R2 = 2.5 * 2.5;
const REST_Y = 0.95;

export function initReceipts(THREE, scene, onCollect, reduceMotion) {
  /* A faint warm pool under each slip, so it reads from the road. */
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 128;
  const c = glowCanvas.getContext("2d");
  const grad = c.createRadialGradient(64, 64, 6, 64, 64, 64);
  grad.addColorStop(0, "rgba(232,204,156,0.5)");
  grad.addColorStop(0.5, "rgba(212,178,128,0.18)");
  grad.addColorStop(1, "rgba(212,178,128,0)");
  c.fillStyle = grad;
  c.fillRect(0, 0, 128, 128);
  const glowTex = new THREE.CanvasTexture(glowCanvas);
  glowTex.colorSpace = THREE.SRGBColorSpace;

  const paperGeo = new THREE.PlaneGeometry(0.62, 0.88);
  /* The slip itself burns gently past the bloom threshold, a lit page
     hanging in the dark; the pool below stays a soft additive wash.
     Each slip clones the material at boot so its periodic twinkle can
     keep its own time; under reduced motion the glow simply holds. */
  const PAPER_GLOW = 1.1;
  const paperMat = new THREE.MeshStandardMaterial({
    color: 0xEDEAE4,
    roughness: 0.6,
    metalness: 0,
    emissive: 0xEDEAE4,
    emissiveIntensity: PAPER_GLOW,
    side: THREE.DoubleSide,
  });
  const glowGeo = new THREE.CircleGeometry(1.15, 20);
  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const group = new THREE.Group();
  const items = [];
  for (let i = 0; i < SPOTS.length; i += 1) {
    const spot = SPOTS[i];
    const g = new THREE.Group();
    const paper = new THREE.Mesh(paperGeo, paperMat.clone());
    paper.position.y = REST_Y;
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.035;
    glow.renderOrder = 1;
    g.add(paper, glow);
    g.position.set(spot.x, 0, spot.z);
    group.add(g);
    items.push({ g, paper, x: spot.x, z: spot.z, phase: i * 1.7, taken: false });
  }
  scene.add(group);

  let time = 0;
  let count = 0;

  /* Slow spin, gentle bob, a periodic twinkle, and the pick up check
     against the car. The twinkle is the crest of a slow sin wave, so
     each slip flares softly for a moment every several seconds; it is
     stilled entirely under reduced motion. */
  function update(dt, carX, carZ) {
    time += dt;
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      if (it.taken) continue;
      it.paper.rotation.y = time * 1.05 + it.phase;
      it.paper.position.y = REST_Y + Math.sin(time * 1.7 + it.phase) * 0.1;
      if (!reduceMotion) {
        const crest = Math.sin(time * 0.9 + it.phase * 2.3);
        it.paper.material.emissiveIntensity =
          PAPER_GLOW + (crest > 0.92 ? (crest - 0.92) * 7 : 0);
      }
      const dx = carX - it.x;
      const dz = carZ - it.z;
      if (dx * dx + dz * dz <= COLLECT_R2) {
        it.taken = true;
        it.g.visible = false;
        count += 1;
        if (onCollect) onCollect(it.x, it.paper.position.y, it.z, count);
      }
    }
  }

  return {
    update,
    collected: () => count,
    total: SPOTS.length,
  };
}
