/* 02 / Now. Skeleton stub: a plinth, the eyebrow, the trigger.
   District builders replace this body later; the exported names and
   the { id, index, title, anchor, build } shape are load bearing. */

export const id = "d02-now";
export const index = 2;
export const title = "Now";
export const anchor = "#now";

export function build(ctx) {
  const { CANNON, helpers, origin, angle } = ctx;
  const outX = Math.cos(angle);
  const outZ = -Math.sin(angle);

  const plinth = helpers.plinth(6, 2.2, 6);
  plinth.position.set(origin.x + outX * 11, 0, origin.z + outZ * 11);
  plinth.rotation.y = angle;
  ctx.addStatic(plinth, new CANNON.Box(new CANNON.Vec3(3, 1.1, 3)));

  const eyebrow = helpers.floorText("02 / Now", 1.3, { colour: "brass" });
  eyebrow.position.set(origin.x + outX * 6, 0, origin.z + outZ * 6);
  eyebrow.rotation.y = angle - Math.PI / 2;
  ctx.addStatic(eyebrow);

  ctx.addTrigger(origin.x, origin.z, 9, () => {
    /* First entry is reconciled by the shell; district behaviour lands here. */
  });
}
