/* The audit trail: the car. A brass toy on a raycast vehicle, tuned
   for arcade feel: quick to speed, tight at low speed, hard to flip,
   happy to slide on the handbrake.

   Conventions (verified against the vendored cannon-es source):
   local +x is the right axis, +y up, +z forward. With that layout a
   NEGATIVE engine force drives the car toward local +z, because the
   forward impulse is applied along surface normal cross axle. A
   positive steering value turns the car left. */

import { edged, blobShadow, BRASS, BRASS_BRIGHT } from "./world.js";

const MASS = 46;
const ENGINE = 230;          /* per driven wheel; two driven wheels */
const TOP_SPEED = 13;        /* world units per second */
const REVERSE_SPEED = 6;
const GRIP_REAR = 3.6;
const GRIP_REAR_DRIFT = 1.15;
const HANDBRAKE = 8;
const FOOTBRAKE = 6;
const ROLL_DRAG = 0.12;      /* light rolling friction when coasting */

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
  const group = new THREE.Group();
  const body = edged(new THREE.BoxGeometry(0.9, 0.32, 1.9), { line: BRASS_BRIGHT });
  body.position.y = 0.12;
  const cabin = edged(new THREE.BoxGeometry(0.68, 0.24, 0.8), { line: BRASS_BRIGHT });
  cabin.position.set(0, 0.4, -0.22);
  const screen = edged(new THREE.BoxGeometry(0.6, 0.2, 0.08), { line: BRASS_BRIGHT });
  screen.position.set(0, 0.37, 0.24);
  screen.rotation.x = -0.32;
  group.add(body, cabin, screen);
  scene.add(group);

  const wheelGeometry = new THREE.CylinderGeometry(0.26, 0.26, 0.18, 12);
  wheelGeometry.rotateZ(Math.PI / 2);
  const wheelMeshes = connections.map(() => {
    const wheel = edged(wheelGeometry, { line: BRASS, thresholdAngle: 40 });
    scene.add(wheel);
    return wheel;
  });

  const shadow = blobShadow(1.25);
  scene.add(shadow);

  /* ---------- state ---------- */
  let steerCurrent = 0;
  let tiltTime = 0;
  let righting = false;
  const workVec = new CANNON.Vec3();
  const upLocal = new CANNON.Vec3(0, 1, 0);
  const fwdLocal = new CANNON.Vec3(0, 0, 1);
  const yAxis = new CANNON.Vec3(0, 1, 0);
  const uprightQ = new CANNON.Quaternion();

  function syncMeshes() {
    group.position.copy(chassisBody.position);
    group.quaternion.copy(chassisBody.quaternion);
    for (let i = 0; i < wheelMeshes.length; i += 1) {
      vehicle.updateWheelTransform(i);
      const t = vehicle.wheelInfos[i].worldTransform;
      wheelMeshes[i].position.copy(t.position);
      wheelMeshes[i].quaternion.copy(t.quaternion);
    }
    shadow.position.set(chassisBody.position.x, 0.02, chassisBody.position.z);
  }

  /* input: { steer: -1..1 with +1 left, throttle: -1..1, brake: bool } */
  function update(dt, input) {
    const vel = chassisBody.velocity;
    const speed = Math.hypot(vel.x, vel.z);
    const forward = chassisBody.quaternion.vmult(fwdLocal, workVec);
    const forwardSpeed = forward.x * vel.x + forward.z * vel.z;

    if (input.steer || input.throttle || input.brake) chassisBody.wakeUp();

    /* Steering: quick, but it tightens up as speed drops. */
    const maxSteer = 0.62 / (1 + speed * 0.07);
    steerCurrent += (input.steer * maxSteer - steerCurrent) * Math.min(1, dt * 9);
    vehicle.setSteeringValue(steerCurrent, 0);
    vehicle.setSteeringValue(steerCurrent, 1);

    /* Throttle, footbrake and reverse. */
    let force = 0;
    let brake = input.throttle === 0 ? ROLL_DRAG : 0;
    if (input.throttle > 0) {
      const headroom = Math.max(0, 1 - Math.max(forwardSpeed, 0) / TOP_SPEED);
      force = ENGINE * input.throttle * headroom;
    } else if (input.throttle < 0) {
      if (forwardSpeed > 0.8) {
        brake = FOOTBRAKE;
      } else {
        const headroom = Math.max(0, 1 - Math.max(-forwardSpeed, 0) / REVERSE_SPEED);
        force = ENGINE * 0.55 * input.throttle * headroom;
      }
    }

    /* Handbrake on Space: rear wheels lock and loosen for the drift. */
    let rearGrip = GRIP_REAR;
    let rearBrake = brake;
    if (input.brake) {
      rearBrake = HANDBRAKE;
      rearGrip = GRIP_REAR_DRIFT;
      force = 0;
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

    /* Gentle self righting: tipped past sixty degrees for two seconds
       and the world quietly puts the car back on its wheels. */
    const up = chassisBody.quaternion.vmult(upLocal, workVec);
    if (up.y < 0.5) tiltTime += dt;
    else if (!righting) tiltTime = 0;
    if (tiltTime > 2) righting = true;
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
    for (let i = 0; i < vehicle.wheelInfos.length; i += 1) {
      vehicle.applyEngineForce(0, i);
      vehicle.setBrake(0, i);
      vehicle.setSteeringValue(0, i);
    }
    syncMeshes();
  }

  return { group, chassisBody, vehicle, update, reset };
}
