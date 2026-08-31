/* The audit trail: the car. A brass toy on a raycast vehicle, tuned
   for arcade feel: quick to speed, tight at low speed, hard to flip,
   happy to slide on the handbrake.

   Conventions (verified against the vendored cannon-es source):
   local +x is the right axis, +y up, +z forward. With that layout a
   NEGATIVE engine force drives the car toward local +z, because the
   forward impulse is applied along surface normal cross axle. A
   positive steering value turns the car left. */

import { edged, blobShadow, brassMat, BRASS, BRASS_BRIGHT, LAMP } from "./world.js";

const MASS = 46;
const ENGINE = 350;          /* per driven wheel; two driven wheels */
export const TOP_SPEED = 18; /* world units per second */
const REVERSE_SPEED = 7;
const GRIP_REAR = 3.6;
const GRIP_REAR_DRIFT = 1.5;
const HANDBRAKE = 2;         /* light enough that a drift keeps rolling */
const FOOTBRAKE = 6;
const ROLL_DRAG = 0.12;      /* light rolling friction when coasting */
const DRIFT_YAW = 2.6;       /* steer led yaw while the handbrake is down */
const DRIFT_YAW_CAP = 1.8;   /* rad per second; the spin never runs away */
const AIR_YAW = 1.5;         /* a small say over heading while airborne */
const AIR_LEVEL = 7;         /* how firmly the car levels itself mid air */
const AIR_DAMP = 2.5;        /* bleed on tumbling spin while airborne */
const AIR_GRACE = 0.15;      /* seconds of air before flight rules apply */

export function buildCar(THREE, CANNON, scene, world) {
  /* ---------- physics ---------- */
  const chassisBody = new CANNON.Body({ mass: MASS });
  /* The box sits above the centre of mass, keeping the car planted. */
  chassisBody.addShape(
    new CANNON.Box(new CANNON.Vec3(0.45, 0.17, 1.0)),
    new CANNON.Vec3(0, 0.09, 0),
  );
  chassisBody.angularDamping = 0.4;
  chassisBody.linearDamping = 0.01;
  chassisBody.allowSleep = false;
  world.addBody(chassisBody);

  const vehicle = new CANNON.RaycastVehicle({
    chassisBody,
    indexRightAxis: 0,
    indexUpAxis: 1,
    indexForwardAxis: 2,
  });

  const wheelOptions = {
    radius: 0.26,
    directionLocal: new CANNON.Vec3(0, -1, 0),
    axleLocal: new CANNON.Vec3(1, 0, 0),
    suspensionStiffness: 42,
    suspensionRestLength: 0.24,
    maxSuspensionTravel: 0.2,
    frictionSlip: 4.0,
    dampingRelaxation: 2.6,
    dampingCompression: 4.4,
    maxSuspensionForce: 100000,
    rollInfluence: 0.01,
    useCustomSlidingRotationalSpeed: true,
    customSlidingRotationalSpeed: -30,
  };

  /* Order: front left, front right, rear left, rear right. */
  const connections = [
    new CANNON.Vec3(0.48, 0, 0.62),
    new CANNON.Vec3(-0.48, 0, 0.62),
    new CANNON.Vec3(0.48, 0, -0.62),
    new CANNON.Vec3(-0.48, 0, -0.62),
  ];
  for (const point of connections) {
    vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: point });
  }
  vehicle.wheelInfos[2].frictionSlip = GRIP_REAR;
  vehicle.wheelInfos[3].frictionSlip = GRIP_REAR;
  vehicle.addToWorld(world);

  /* ---------- the toy itself ---------- */
  /* A proper little coupe: tub, bonnet, rear deck, cabin, a glossy
     screen, arches over the wheels, brass rims, lamps at both ends. */
  const group = new THREE.Group();

  const tub = edged(new THREE.BoxGeometry(0.94, 0.26, 1.9), { line: BRASS_BRIGHT });
  tub.position.y = 0.1;
  const bonnet = edged(new THREE.BoxGeometry(0.78, 0.13, 0.66), { line: BRASS_BRIGHT });
  bonnet.position.set(0, 0.29, 0.52);
  const deck = edged(new THREE.BoxGeometry(0.78, 0.11, 0.42), { line: BRASS_BRIGHT });
  deck.position.set(0, 0.28, -0.72);
  const cabin = edged(new THREE.BoxGeometry(0.7, 0.3, 0.8), { line: BRASS_BRIGHT });
  cabin.position.set(0, 0.44, -0.16);
  const screen = edged(new THREE.BoxGeometry(0.62, 0.28, 0.05), {
    fill: 0x151618,
    line: BRASS_BRIGHT,
    opacity: 0.55,
    roughness: 0.14,
    metalness: 0.4,
  });
  screen.position.set(0, 0.42, 0.3);
  screen.rotation.x = -0.42;
  group.add(tub, bonnet, deck, cabin, screen);

  /* Arches riding the tub's shoulders, one over each wheel. */
  const archGeo = new THREE.BoxGeometry(0.14, 0.15, 0.66);
  for (const [ax, az] of [[0.47, 0.62], [-0.47, 0.62], [0.47, -0.62], [-0.47, -0.62]]) {
    const arch = edged(archGeo, { line: BRASS, opacity: 0.5 });
    arch.position.set(ax, 0.22, az);
    group.add(arch);
  }

  /* Headlight lenses, emissive and warm; brass warm tail lamps. */
  const lensGeo = new THREE.BoxGeometry(0.16, 0.1, 0.04);
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0xFFEACB,
    emissive: 0xFFDFAE,
    emissiveIntensity: 2.4,
    roughness: 0.35,
    metalness: 0,
  });
  for (const lx of [0.3, -0.3]) {
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.set(lx, 0.2, 0.955);
    group.add(lens);
  }
  const tailGeo = new THREE.BoxGeometry(0.14, 0.07, 0.04);
  const tailMat = new THREE.MeshStandardMaterial({
    color: BRASS_BRIGHT,
    emissive: BRASS,
    emissiveIntensity: 1.3,
    roughness: 0.4,
    metalness: 0.2,
  });
  for (const tx of [0.32, -0.32]) {
    const tail = new THREE.Mesh(tailGeo, tailMat);
    tail.position.set(tx, 0.2, -0.955);
    group.add(tail);
  }

  /* One real headlight: a single warm spot pooling on the road ahead.
     Shadowless and cheap; the lenses above carry the glow itself. */
  const headBeam = new THREE.SpotLight(LAMP, 40, 30, 0.5, 0.6, 1.6);
  headBeam.position.set(0, 0.34, 0.9);
  headBeam.castShadow = false;
  const headTarget = new THREE.Object3D();
  headTarget.position.set(0, -0.2, 10);
  headBeam.target = headTarget;
  group.add(headBeam, headTarget);

  /* The whole toy throws a shadow; the lines stay lines. */
  group.traverse((node) => {
    if (node.isMesh) node.castShadow = true;
  });
  scene.add(group);

  const wheelGeometry = new THREE.CylinderGeometry(0.26, 0.26, 0.18, 12);
  wheelGeometry.rotateZ(Math.PI / 2);
  const rimGeometry = new THREE.CylinderGeometry(0.14, 0.14, 0.2, 8);
  rimGeometry.rotateZ(Math.PI / 2);
  const rimMat = brassMat({ emissiveIntensity: 0.12 });
  const wheelMeshes = connections.map(() => {
    const wheel = new THREE.Group();
    const tyre = edged(wheelGeometry, {
      line: BRASS,
      thresholdAngle: 40,
      fill: 0x141312,
      roughness: 0.9,
    });
    const rim = new THREE.Mesh(rimGeometry, rimMat);
    rim.castShadow = true;
    wheel.add(tyre, rim);
    scene.add(wheel);
    return wheel;
  });

  /* Contact tint only; the real shadow comes from the lamplight. */
  const shadow = blobShadow(1.25);
  scene.add(shadow);

  /* ---------- state ---------- */
  let steerCurrent = 0;
  let tiltTime = 0;
  let righting = false;
  let wasGrounded = true;
  let airTime = 0;
  let prevVy = 0;
  const workVec = new CANNON.Vec3();
  const workVec2 = new CANNON.Vec3();
  const upLocal = new CANNON.Vec3(0, 1, 0);
  const fwdLocal = new CANNON.Vec3(0, 0, 1);
  const rightLocal = new CANNON.Vec3(1, 0, 0);
  const yAxis = new CANNON.Vec3(0, 1, 0);
  const uprightQ = new CANNON.Quaternion();

  /* Read only flight data for the camera and the effects: filled in
     every update, never reallocated. slip is signed lateral speed
     along the car's right axis; landing is the downward speed a
     just landed frame arrived with. */
  const status = {
    speed: 0,
    forwardSpeed: 0,
    slip: 0,
    grounded: true,
    airborne: false,
    drifting: false,
    justLanded: false,
    landing: 0,
  };

  function syncMeshes() {
    group.position.copy(chassisBody.position);
    group.quaternion.copy(chassisBody.quaternion);
    for (let i = 0; i < wheelMeshes.length; i += 1) {
      vehicle.updateWheelTransform(i);
      const t = vehicle.wheelInfos[i].worldTransform;
      wheelMeshes[i].position.copy(t.position);
      wheelMeshes[i].quaternion.copy(t.quaternion);
    }
    /* Held a hair above the road surface so the tint reads there too. */
    shadow.position.set(chassisBody.position.x, 0.045, chassisBody.position.z);
  }

  /* input: { steer: -1..1 with +1 left, throttle: -1..1, brake: bool } */
  function update(dt, input) {
    const vel = chassisBody.velocity;
    const speed = Math.hypot(vel.x, vel.z);
    const forward = chassisBody.quaternion.vmult(fwdLocal, workVec);
    const forwardSpeed = forward.x * vel.x + forward.z * vel.z;
    const right = chassisBody.quaternion.vmult(rightLocal, workVec2);
    const slip = right.x * vel.x + right.z * vel.z;
    const grounded = vehicle.numWheelsOnGround > 0;

    /* Landing bookkeeping first, on last frame's air time: the frame
       the wheels return after real air, report the downward speed
       they arrived with. */
    status.justLanded = grounded && !wasGrounded && airTime > 0.12 && prevVy < -3;
    status.landing = status.justLanded ? -prevVy : 0;
    wasGrounded = grounded;
    if (grounded) airTime = 0;
    else airTime += dt;

    if (input.steer || input.throttle || input.brake) chassisBody.wakeUp();

    /* Steering: tight and eager at walking pace, relaxing as the car
       gathers speed so full tilt never snaps sideways. */
    const maxSteer = 0.75 / (1 + speed * 0.055);
    steerCurrent += (input.steer * maxSteer - steerCurrent) * Math.min(1, dt * 12);
    vehicle.setSteeringValue(steerCurrent, 0);
    vehicle.setSteeringValue(steerCurrent, 1);

    /* Throttle, footbrake and reverse. */
    let force = 0;
    let brake = input.throttle === 0 ? ROLL_DRAG : 0;
    if (input.throttle > 0) {
      const headroom = Math.max(0, 1 - Math.max(forwardSpeed, 0) / TOP_SPEED);
      force = ENGINE * input.throttle * headroom;
      /* Anti wheelie: power fades as the nose lifts, so a hard launch
         squats and surges rather than looping over backwards. */
      if (forward.y > 0.12) force *= Math.max(0, 1 - (forward.y - 0.12) * 6);
    } else if (input.throttle < 0) {
      if (forwardSpeed > 0.8) {
        brake = FOOTBRAKE;
      } else {
        const headroom = Math.max(0, 1 - Math.max(-forwardSpeed, 0) / REVERSE_SPEED);
        force = ENGINE * 0.55 * input.throttle * headroom;
      }
    }

    /* Handbrake on Space: the rear end loosens, a light lock keeps the
       car rolling through the slide, and a steer led nudge of yaw
       swings the tail so the drift answers the wheel. Positive steer
       yaws positive about y; verified against the vendored solver. */
    let rearGrip = GRIP_REAR;
    let rearBrake = brake;
    if (input.brake) {
      rearBrake = HANDBRAKE;
      rearGrip = GRIP_REAR_DRIFT;
      force = 0;
      if (grounded && forwardSpeed > 2) {
        chassisBody.angularVelocity.y +=
          steerCurrent * DRIFT_YAW * Math.min(1, forwardSpeed / 10) * dt;
        if (chassisBody.angularVelocity.y > DRIFT_YAW_CAP) {
          chassisBody.angularVelocity.y = DRIFT_YAW_CAP;
        } else if (chassisBody.angularVelocity.y < -DRIFT_YAW_CAP) {
          chassisBody.angularVelocity.y = -DRIFT_YAW_CAP;
        }
      }
    }
    vehicle.wheelInfos[2].frictionSlip = rearGrip;
    vehicle.wheelInfos[3].frictionSlip = rearGrip;
    vehicle.setBrake(brake, 0);
    vehicle.setBrake(brake, 1);
    vehicle.setBrake(rearBrake, 2);
    vehicle.setBrake(rearBrake, 3);

    /* Negative drives forward; see the note at the top of the file. */
    vehicle.applyEngineForce(-force, 2);
    vehicle.applyEngineForce(-force, 3);

    /* Airborne, and properly so rather than a one frame skip of the
       suspension: steer keeps a small say over heading, tumbling spin
       bleeds away, and the up axis is nudged back toward level so
       every jump comes down on the wheels, never the roof. */
    if (!grounded && airTime > AIR_GRACE) {
      chassisBody.angularVelocity.y += input.steer * AIR_YAW * dt;
      const upW = chassisBody.quaternion.vmult(upLocal, workVec2);
      const damp = 1 - Math.min(1, dt * AIR_DAMP);
      chassisBody.angularVelocity.x =
        chassisBody.angularVelocity.x * damp - upW.z * AIR_LEVEL * dt;
      chassisBody.angularVelocity.z =
        chassisBody.angularVelocity.z * damp + upW.x * AIR_LEVEL * dt;
    }

    /* Gentle self righting: tipped right over for a moment and the
       world quietly puts the car back on its wheels. */
    const up = chassisBody.quaternion.vmult(upLocal, workVec);
    if (up.y < 0.5) tiltTime += dt;
    else if (!righting) tiltTime = 0;
    if (tiltTime > 1.2) righting = true;
    if (righting) {
      const fwd = chassisBody.quaternion.vmult(fwdLocal, workVec);
      const yaw = Math.atan2(fwd.x, fwd.z);
      uprightQ.setFromAxisAngle(yAxis, yaw);
      chassisBody.quaternion.slerp(uprightQ, Math.min(1, dt * 2.5), chassisBody.quaternion);
      chassisBody.angularVelocity.scale(0.85, chassisBody.angularVelocity);
      const upNow = chassisBody.quaternion.vmult(upLocal, workVec);
      if (upNow.y > 0.95) {
        righting = false;
        tiltTime = 0;
      }
    }

    status.speed = speed;
    status.forwardSpeed = forwardSpeed;
    status.slip = slip;
    status.grounded = grounded;
    status.airborne = !grounded;
    status.drifting = !!input.brake && grounded && speed > 3;
    prevVy = chassisBody.velocity.y;

    syncMeshes();
  }

  /* Sets the car down upright at position, facing along angle, where
     forward is (sin angle, 0, cos angle). */
  function reset(position, angle) {
    chassisBody.position.set(position.x, 0.9, position.z);
    chassisBody.quaternion.setFromAxisAngle(yAxis, angle);
    chassisBody.velocity.setZero();
    chassisBody.angularVelocity.setZero();
    chassisBody.wakeUp();
    steerCurrent = 0;
    tiltTime = 0;
    righting = false;
    wasGrounded = true;
    airTime = 0;
    prevVy = 0;
    status.justLanded = false;
    status.landing = 0;
    status.drifting = false;
    for (let i = 0; i < vehicle.wheelInfos.length; i += 1) {
      vehicle.applyEngineForce(0, i);
      vehicle.setBrake(0, i);
      vehicle.setSteeringValue(0, i);
    }
    syncMeshes();
  }

  return { group, chassisBody, vehicle, status, update, reset };
}
