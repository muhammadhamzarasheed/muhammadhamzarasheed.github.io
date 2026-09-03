/* 08 / Contact. The quietest district by design. A desk with an in
   tray, the address laid in brass on the ground, a plaque that opens
   a letter, and a finishing line across the trail just past the desk.
   The words come from the record: the email on #contact, and the
   countersign that closes the footer. */

export const id = "d08-contact";
export const index = 8;
export const title = "Contact";
export const anchor = "#contact";

export function build(ctx) {
  const { THREE, CANNON, helpers, origin, angle } = ctx;

  /* Local frame: u runs outward from the road, v runs forward along
     the trail. */
  const outX = Math.cos(angle);
  const outZ = -Math.sin(angle);
  const fwdX = Math.sin(angle);
  const fwdZ = Math.cos(angle);
  const at = (u, v) => ({
    x: origin.x + outX * u + fwdX * v,
    z: origin.z + outZ * u + fwdZ * v,
  });

  /* Ground type orientation. The camera looks along the world x plus
     z diagonal from a fixed offset, so at this station a rotation of
     exactly angle lays glyph tops away from the lens: the type reads
     left to right for a driver arriving along the trail. */
  const READ = Math.PI / 4;

  /* Eyebrow on the approach, clear of the kerb. */
  const eyebrow = helpers.floorText("08 / Contact", 1.3, { colour: "brass" });
  const eb = at(11, -8);
  eyebrow.position.set(eb.x, 0, eb.z);
  eyebrow.rotation.y = READ;
  ctx.addStatic(eyebrow);

  /* The address, exactly as it appears on the record, in brass before
     the desk. Lowercase preserved: an email is quoted, not shouted. */
  const email = helpers.floorText("hello@muhammadhamza.co.uk", 0.8, {
    colour: "brass",
    uppercase: false,
  });
  const em = at(13, -3.8);
  email.position.set(em.x, 0, em.z);
  email.rotation.y = READ;
  ctx.addStatic(email);

  /* The desk: one wide plinth, broadside to the road. */
  const desk = helpers.plinth(5, 1.1, 2);
  const dk = at(11.5, 0);
  desk.position.set(dk.x, 0, dk.z);
  desk.rotation.y = angle - Math.PI / 2;
  ctx.addStatic(desk, new CANNON.Box(new CANNON.Vec3(2.5, 0.55, 1)));

  /* A small edged in tray sitting on the desk, static: a shallow base
     and four low rails. Paired rails share their geometry. */
  const trayW = 1.25;
  const trayD = 0.9;
  const railT = 0.07;
  const railH = 0.18;
  const tray = new THREE.Group();
  const base = helpers.edged(new THREE.BoxGeometry(trayW, 0.06, trayD));
  base.position.y = 0.03;
  const railLong = helpers.edged(new THREE.BoxGeometry(trayW, railH, railT));
  railLong.position.set(0, 0.06 + railH / 2, (trayD - railT) / 2);
  const railLong2 = railLong.clone();
  railLong2.position.z = -(trayD - railT) / 2;
  const railShort = helpers.edged(
    new THREE.BoxGeometry(railT, railH, trayD - railT * 2),
  );
  railShort.position.set((trayW - railT) / 2, 0.06 + railH / 2, 0);
  const railShort2 = railShort.clone();
  railShort2.position.x = -((trayW - railT) / 2);
  tray.add(base, railLong, railLong2, railShort, railShort2);
  tray.add(helpers.blobShadow(0.55));
  const tr = at(12, 0.9);
  tray.position.set(tr.x, 1.1, tr.z);
  tray.rotation.y = angle - Math.PI / 2;
  ctx.addStatic(tray);

  /* The plaque: press E or tap to open a letter to the record. */
  const lp = at(7.5, 0);
  ctx.addLink(lp.x, lp.z, "Write to the record", "mailto:hello@muhammadhamza.co.uk");

  /* The finishing line, just past the desk: two brass hairline beams
     laid across the trail. Flat enough to drive over; no bodies, so
     the road is never blocked. */
  const tape1 = helpers.beam(11, 0.07);
  const t1 = at(0, 5);
  tape1.position.set(t1.x, 0.035, t1.z);
  tape1.rotation.y = angle;
  ctx.addStatic(tape1);
  const tape2 = tape1.clone();
  const t2 = at(0, 5.9);
  tape2.position.set(t2.x, 0.035, t2.z);
  ctx.addStatic(tape2);

  /* And the last line of ground type on the loop, small and grey,
     for whoever crosses it. */
  const close = helpers.floorText("THE RECORD AWAITS ITS COUNTERSIGN", 0.55, {
    colour: "grey",
  });
  const cl = at(0, 7.4);
  close.position.set(cl.x, 0, cl.z);
  close.rotation.y = READ;
  ctx.addStatic(close);
}
