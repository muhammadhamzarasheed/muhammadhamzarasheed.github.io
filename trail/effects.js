/* The audit trail: effects. Dust off the rear wheels, skid marks
   written on the road, glyph fountains when a district reconciles, and
   the paper flick of a receipt coming off the ground. Every pool is
   built once at boot and recycled forever: a spawn only wakes a
   sleeping slot, and no frame ever allocates. The palette stays on the
   ledger: warm grey dust, brass glyphs, ink paper, near black rubber. */

const DUST_N = 36;
const GLYPH_N = 56;
const PAPER_N = 16;
const SKID_N = 240;
const SKID_LIFE = 6;        /* seconds a mark takes to fade right out */
const SKID_HALF = 0.09;     /* half width of a tyre's written line */
const SKID_ALPHA = 0.55;

function jitter(k) {
  return (Math.random() * 2 - 1) * k;
}

export function initEffects(THREE, scene) {
  /* ---------- baked sprite textures, tiny canvases ---------- */

  function softDisc() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const c = canvas.getContext("2d");
    const g = c.createRadialGradient(32, 32, 4, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,0.85)");
    g.addColorStop(0.55, "rgba(255,255,255,0.30)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* Brass glyphs for the reconciliation fountains: ledger digits and
     tick marks, half plain brass, half the brighter cut. Redrawn once
     the mono face lands so the figures come out true. */
  const glyphTexs = [];
  const glyphDraws = [];
  const GLYPH_SET = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "tick", "tick"];
  for (let i = 0; i < GLYPH_SET.length; i += 1) {
    const ch = GLYPH_SET[i];
    const colour = i % 2 === 0 ? "#C9AA7C" : "#E2C79A";
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const draw = () => {
      const c = canvas.getContext("2d");
      c.clearRect(0, 0, 64, 64);
      if (ch === "tick") {
        c.strokeStyle = colour;
        c.lineWidth = 7;
        c.lineCap = "round";
        c.lineJoin = "round";
        c.beginPath();
        c.moveTo(14, 36);
        c.lineTo(27, 48);
        c.lineTo(50, 17);
        c.stroke();
      } else {
        c.font = '500 46px "IBM Plex Mono", monospace';
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillStyle = colour;
        c.fillText(ch, 32, 34);
      }
      tex.needsUpdate = true;
    };
    draw();
    glyphTexs.push(tex);
    glyphDraws.push(draw);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      for (const d of glyphDraws) d();
    }).catch(() => {});
  }

  /* A small pale slip for the pickup flick: paper with faint rules. */
  function paperScrap() {
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 52;
    const c = canvas.getContext("2d");
    c.fillStyle = "#EDEAE4";
    c.fillRect(2, 2, 36, 48);
    c.strokeStyle = "rgba(90,86,78,0.55)";
    c.lineWidth = 2;
    for (let y = 14; y <= 40; y += 9) {
      c.beginPath();
      c.moveTo(8, y);
      c.lineTo(32, y);
      c.stroke();
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* ---------- dust ---------- */

  const dustTex = softDisc();
  const dust = [];
  const dustGroup = new THREE.Group();
  for (let i = 0; i < DUST_N; i += 1) {
    const m = new THREE.SpriteMaterial({
      map: dustTex,
      color: 0x57524B,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const s = new THREE.Sprite(m);
    s.visible = false;
    dustGroup.add(s);
    dust.push({ s, m, life: 0, ttl: 1, vx: 0, vy: 0, vz: 0, from: 0.5, grow: 1.6, peak: 0.4 });
  }
  scene.add(dustGroup);
  let dustHead = 0;

  function spawnDust(x, y, z, vx, vy, vz, ttl, from, grow, peak) {
    const d = dust[dustHead];
    dustHead = (dustHead + 1) % DUST_N;
    d.life = 0.0001;
    d.ttl = ttl;
    d.vx = vx;
    d.vy = vy;
    d.vz = vz;
    d.from = from;
    d.grow = grow;
    d.peak = peak;
    d.s.position.set(x, y, z);
    d.m.rotation = Math.random() * Math.PI * 2;
    d.s.visible = true;
  }

  /* One soft puff at a rear wheel, drifting up and a little astray. */
  function dustAt(x, y, z) {
    spawnDust(
      x + jitter(0.16), y, z + jitter(0.16),
      jitter(0.6), 0.9 + Math.random() * 0.7, jitter(0.6),
      0.5 + Math.random() * 0.25, 0.42, 1.7, 0.4,
    );
  }

  /* A ring of dust kicked out when the car comes down hard. */
  function landingPuff(x, z) {
    for (let i = 0; i < 9; i += 1) {
      const a = (i / 9) * Math.PI * 2 + jitter(0.2);
      spawnDust(
        x + Math.cos(a) * 0.9, 0.14, z + Math.sin(a) * 0.9,
        Math.cos(a) * (1.8 + Math.random()), 0.5, Math.sin(a) * (1.8 + Math.random()),
        0.55 + Math.random() * 0.2, 0.5, 2.2, 0.34,
      );
    }
  }

  /* ---------- brass glyph fountains ---------- */

  const glyphs = [];
  const glyphGroup = new THREE.Group();
  for (let i = 0; i < GLYPH_N; i += 1) {
    const m = new THREE.SpriteMaterial({
      map: glyphTexs[i % glyphTexs.length],
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    /* Driven past white in the linear buffer, so a fountain of
       figures blooms like sparks rather than confetti. */
    m.color.setScalar(2.3);
    const s = new THREE.Sprite(m);
    s.visible = false;
    glyphGroup.add(s);
    glyphs.push({ s, m, life: 0, ttl: 1, vx: 0, vy: 0, vz: 0, spin: 0, size: 0.5 });
  }
  scene.add(glyphGroup);
  let glyphHead = 0;

  /* Figures fountain up from a point and settle as they fade. big
     widens the mouth and throws harder, for the countersign. */
  function glyphBurst(x, z, count, big) {
    const n = Math.min(count, GLYPH_N);
    for (let i = 0; i < n; i += 1) {
      const g = glyphs[glyphHead];
      glyphHead = (glyphHead + 1) % GLYPH_N;
      const a = Math.random() * Math.PI * 2;
      const r = big ? 2.2 + Math.random() * 2.2 : 0.3 + Math.random() * 0.9;
      g.s.position.set(x + Math.cos(a) * r, 0.5, z + Math.sin(a) * r);
      const h = (big ? 1.0 : 0.6) + Math.random() * (big ? 2.6 : 1.8);
      g.vx = Math.cos(a) * h;
      g.vz = Math.sin(a) * h;
      g.vy = (big ? 6.4 : 4.8) + Math.random() * (big ? 3.4 : 2.4);
      g.spin = jitter(3.2);
      g.life = 0.0001;
      g.ttl = (big ? 1.5 : 1.15) + Math.random() * 0.35;
      g.size = (big ? 0.7 : 0.52) + Math.random() * 0.16;
      g.m.rotation = jitter(0.6);
      g.s.visible = true;
    }
  }

  /* ---------- paper flicks ---------- */

  const paperTex = paperScrap();
  const papers = [];
  const paperGroup = new THREE.Group();
  for (let i = 0; i < PAPER_N; i += 1) {
    const m = new THREE.SpriteMaterial({
      map: paperTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const s = new THREE.Sprite(m);
    s.visible = false;
    paperGroup.add(s);
    papers.push({ s, m, life: 0, ttl: 1, vx: 0, vy: 0, vz: 0, spin: 0, size: 0.24 });
  }
  scene.add(paperGroup);
  let paperHead = 0;

  function paperFlick(x, y, z) {
    for (let i = 0; i < 8; i += 1) {
      const p = papers[paperHead];
      paperHead = (paperHead + 1) % PAPER_N;
      p.s.position.set(x + jitter(0.2), y + jitter(0.2), z + jitter(0.2));
      p.vx = jitter(2.4);
      p.vy = 2.4 + Math.random() * 2;
      p.vz = jitter(2.4);
      p.spin = jitter(7);
      p.life = 0.0001;
      p.ttl = 0.65 + Math.random() * 0.3;
      p.size = 0.2 + Math.random() * 0.12;
      p.m.rotation = Math.random() * Math.PI * 2;
      p.s.visible = true;
    }
  }

  /* ---------- skid marks ---------- */
  /* A capped ring of quads in one geometry and one draw call. Fresh
     segments are written over the oldest; every live segment fades on
     its own clock through a per vertex alpha. */

  const skidPos = new Float32Array(SKID_N * 4 * 3);
  const skidAlpha = new Float32Array(SKID_N * 4);
  const skidAges = new Float32Array(SKID_N);
  skidAges.fill(SKID_LIFE);
  const skidIdx = new Uint16Array(SKID_N * 6);
  for (let i = 0; i < SKID_N; i += 1) {
    const v = i * 4;
    const t = i * 6;
    skidIdx[t] = v;
    skidIdx[t + 1] = v + 1;
    skidIdx[t + 2] = v + 2;
    skidIdx[t + 3] = v;
    skidIdx[t + 4] = v + 2;
    skidIdx[t + 5] = v + 3;
  }
  const skidGeo = new THREE.BufferGeometry();
  const skidPosAttr = new THREE.BufferAttribute(skidPos, 3);
  const skidAlphaAttr = new THREE.BufferAttribute(skidAlpha, 1);
  skidPosAttr.setUsage(THREE.DynamicDrawUsage);
  skidAlphaAttr.setUsage(THREE.DynamicDrawUsage);
  skidGeo.setAttribute("position", skidPosAttr);
  skidGeo.setAttribute("alpha", skidAlphaAttr);
  skidGeo.setIndex(new THREE.BufferAttribute(skidIdx, 1));
  const skidMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: [
      "attribute float alpha;",
      "varying float vAlpha;",
      "void main() {",
      "  vAlpha = alpha;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
      "}",
    ].join("\n"),
    fragmentShader: [
      "varying float vAlpha;",
      "void main() {",
      "  gl_FragColor = vec4(0.012, 0.011, 0.010, vAlpha);",
      "}",
    ].join("\n"),
  });
  const skidMesh = new THREE.Mesh(skidGeo, skidMat);
  skidMesh.frustumCulled = false;
  skidMesh.renderOrder = 1;
  scene.add(skidMesh);

  let skidHead = 0;
  const skidLast = [
    { x: 0, z: 0, has: false },
    { x: 0, z: 0, has: false },
  ];

  /* Feed one rear wheel's contact point per frame while the handbrake
     writes; segments are laid once the wheel has travelled a stride. */
  function skidAt(channel, x, z) {
    const last = skidLast[channel];
    if (!last.has) {
      last.x = x;
      last.z = z;
      last.has = true;
      return;
    }
    const dx = x - last.x;
    const dz = z - last.z;
    const len2 = dx * dx + dz * dz;
    if (len2 < 0.09) return;
    const len = Math.sqrt(len2);
    if (len > 3) {
      last.x = x;
      last.z = z;
      return;
    }
    const nx = (-dz / len) * SKID_HALF;
    const nz = (dx / len) * SKID_HALF;
    const seg = skidHead;
    skidHead = (skidHead + 1) % SKID_N;
    const p = seg * 12;
    const y = 0.038;
    skidPos[p] = last.x + nx;
    skidPos[p + 1] = y;
    skidPos[p + 2] = last.z + nz;
    skidPos[p + 3] = last.x - nx;
    skidPos[p + 4] = y;
    skidPos[p + 5] = last.z - nz;
    skidPos[p + 6] = x - nx;
    skidPos[p + 7] = y;
    skidPos[p + 8] = z - nz;
    skidPos[p + 9] = x + nx;
    skidPos[p + 10] = y;
    skidPos[p + 11] = z + nz;
    const a = seg * 4;
    skidAlpha[a] = SKID_ALPHA;
    skidAlpha[a + 1] = SKID_ALPHA;
    skidAlpha[a + 2] = SKID_ALPHA;
    skidAlpha[a + 3] = SKID_ALPHA;
    skidAges[seg] = 0;
    skidPosAttr.needsUpdate = true;
    skidAlphaAttr.needsUpdate = true;
    last.x = x;
    last.z = z;
  }

  function skidBreak() {
    skidLast[0].has = false;
    skidLast[1].has = false;
  }

  /* ---------- the one per frame walk over every pool ---------- */

  function update(dt) {
    for (let i = 0; i < DUST_N; i += 1) {
      const d = dust[i];
      if (d.life <= 0) continue;
      d.life += dt;
      const t = d.life / d.ttl;
      if (t >= 1) {
        d.life = 0;
        d.s.visible = false;
        d.m.opacity = 0;
        continue;
      }
      d.vy *= 1 - Math.min(1, dt * 1.4);
      d.s.position.x += d.vx * dt;
      d.s.position.y += d.vy * dt;
      d.s.position.z += d.vz * dt;
      const size = d.from + d.grow * t;
      d.s.scale.set(size, size, 1);
      d.m.opacity = d.peak * Math.min(1, t * 6) * (1 - t);
    }

    for (let i = 0; i < GLYPH_N; i += 1) {
      const g = glyphs[i];
      if (g.life <= 0) continue;
      g.life += dt;
      const t = g.life / g.ttl;
      if (t >= 1) {
        g.life = 0;
        g.s.visible = false;
        g.m.opacity = 0;
        continue;
      }
      g.vy -= 11 * dt;
      g.s.position.x += g.vx * dt;
      g.s.position.y += g.vy * dt;
      g.s.position.z += g.vz * dt;
      if (g.s.position.y < 0.16) g.s.position.y = 0.16;
      g.m.rotation += g.spin * dt;
      g.s.scale.set(g.size, g.size, 1);
      g.m.opacity = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
    }

    for (let i = 0; i < PAPER_N; i += 1) {
      const p = papers[i];
      if (p.life <= 0) continue;
      p.life += dt;
      const t = p.life / p.ttl;
      if (t >= 1) {
        p.life = 0;
        p.s.visible = false;
        p.m.opacity = 0;
        continue;
      }
      p.vy -= 8 * dt;
      p.s.position.x += p.vx * dt;
      p.s.position.y += p.vy * dt;
      p.s.position.z += p.vz * dt;
      if (p.s.position.y < 0.12) p.s.position.y = 0.12;
      p.m.rotation += p.spin * dt;
      p.s.scale.set(p.size, p.size * 1.3, 1);
      p.m.opacity = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
    }

    let fading = false;
    for (let i = 0; i < SKID_N; i += 1) {
      if (skidAges[i] >= SKID_LIFE) continue;
      skidAges[i] += dt;
      const left = skidAges[i] >= SKID_LIFE ? 0 : 1 - skidAges[i] / SKID_LIFE;
      const a = i * 4;
      const alpha = SKID_ALPHA * left;
      skidAlpha[a] = alpha;
      skidAlpha[a + 1] = alpha;
      skidAlpha[a + 2] = alpha;
      skidAlpha[a + 3] = alpha;
      fading = true;
    }
    if (fading) skidAlphaAttr.needsUpdate = true;
  }

  return { update, dustAt, landingPuff, glyphBurst, paperFlick, skidAt, skidBreak };
}
