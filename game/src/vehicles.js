// Cars: arcade physics (velocity split into forward and lateral, grip pulls the
// car back to its heading; the handbrake loosens the grip so it drifts),
// damage, smoke and explosions, and the types the city spawns.
import { CAR } from './config.js';

export const CAR_TYPES = {
  sedan: { name: 'Marlin', length: 44, width: 22, maxSpeed: 1.0, accel: 1.0, colors: ['#c0392b', '#2e6fb0', '#7a7f85', '#d9a441', '#4a7a4f'] },
  hatch: { name: 'Pip', length: 38, width: 20, maxSpeed: 0.92, accel: 1.05, colors: ['#e07a3f', '#8a6fb0', '#3fa08a', '#b03a5a'] },
  taxi: { name: 'Cab', length: 44, width: 22, maxSpeed: 0.95, accel: 1.0, colors: ['#f2c230'] },
  truck: { name: 'Hauler', length: 58, width: 24, maxSpeed: 0.78, accel: 0.8, colors: ['#5a6a7a', '#8a5a3a', '#4a5a6a'] },
  sports: { name: 'Comet GT', length: 46, width: 22, maxSpeed: 1.18, accel: 1.25, colors: ['#d42a2a', '#1f8fff', '#ffd23f'] },
  police: { name: 'Interceptor', length: 46, width: 22, maxSpeed: 1.12, accel: 1.2, colors: ['#e8e8e8'] },
};

let nextId = 1;

/** A car entity. `driver` is 'player', 'npc', 'police' or null (parked). */
export function createCar(typeName, x, y, angle, color, driver) {
  const type = CAR_TYPES[typeName] || CAR_TYPES.sedan;
  return {
    id: nextId,
    type: typeName,
    name: type.name,
    x, y, angle,
    vx: 0, vy: 0,
    speed: 0,
    color: color || type.colors[0],
    driver: driver || null,
    hp: CAR.health,
    dead: false,
    steer: 0,
    smoke: 0,
    honk: 0,
    wanted: false,
  };
}
nextId = 1;

export function carForward(car) {
  return { x: Math.cos(car.angle), y: Math.sin(car.angle) };
}

export function carSpeed(car) {
  return Math.hypot(car.vx, car.vy);
}

/**
 * Advance one car. `drive` is { throttle: -1..1, steer: -1..1, handbrake }.
 * Returns an event object: { hitWall, speed } for the caller to react to.
 */
export function stepCar(car, drive, dt, city) {
  const type = CAR_TYPES[car.type];
  const maxSpeed = CAR.maxSpeed * type.maxSpeed;
  const maxReverse = CAR.maxReverse * type.maxSpeed;
  const accel = CAR.accel * type.accel;

  // Steering follows the direction of travel; a parked car does not turn.
  const moving = Math.hypot(car.vx, car.vy);
  const dir = car.speed >= 0 ? 1 : -1;
  const steerAuthority = Math.min(1, moving / 90);
  car.angle += drive.steer * CAR.steerRate * steerAuthority * dir * dt;
  car.steer = drive.steer;

  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  // Split velocity into forward and sideways; grip kills the sideways part.
  let forward = car.vx * fx + car.vy * fy;
  let sideX = car.vx - forward * fx;
  let sideY = car.vy - forward * fy;
  const grip = drive.handbrake ? CAR.driftGrip : CAR.grip;
  const keep = Math.exp(-grip * dt);
  sideX *= keep;
  sideY *= keep;
  if (drive.throttle > 0) forward += accel * drive.throttle * dt;
  else if (drive.throttle < 0) {
    // S brakes while moving forward, reverses once stopped.
    forward += (forward > 8 ? -CAR.brake : accel * 0.6 * drive.throttle) * dt;
  }
  // Rolling drag and the speed cap.
  forward *= Math.exp(-0.25 * dt);
  if (drive.handbrake) forward *= Math.exp(-1.4 * dt);
  forward = Math.max(-maxReverse, Math.min(maxSpeed, forward));
  car.speed = forward;
  car.vx = forward * fx + sideX;
  car.vy = forward * fy + sideY;

  const oldX = car.x;
  const oldY = car.y;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  const fixed = city.resolveCircle(car.x, car.y, CAR.radius);
  const hitWall = fixed.x !== car.x || fixed.y !== car.y;
  if (hitWall) {
    const impact = Math.hypot(car.vx, car.vy);
    car.x = fixed.x;
    car.y = fixed.y;
    // A hard hit costs speed and health.
    if (impact > 180) {
      car.hp -= (impact - 180) * 0.05;
      car.vx *= 0.35;
      car.vy *= 0.35;
      car.speed *= 0.35;
    } else {
      car.vx *= 0.6;
      car.vy *= 0.6;
      car.speed *= 0.6;
    }
    void oldX;
    void oldY;
  }
  if (car.hp <= 0 && !car.dead) car.dead = true;
  car.smoke = car.hp < 45 ? 1 - car.hp / 45 : 0;
  return { hitWall, speed: Math.hypot(car.vx, car.vy) };
}

/** Two cars bumping: push apart and trade a little damage on a hard hit. */
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = CAR.radius * 2 - 4;
  if (d >= min || d < 0.01) return 0;
  const push = (min - d) / 2;
  const nx = dx / d;
  const ny = dy / d;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const rel = Math.hypot(a.vx - b.vx, a.vy - b.vy);
  if (rel > 200) {
    a.hp -= (rel - 200) * 0.02;
    b.hp -= (rel - 200) * 0.02;
  }
  // Exchange a little velocity so the bump reads.
  const avx = a.vx;
  const avy = a.vy;
  a.vx = a.vx * 0.7 + b.vx * 0.3;
  a.vy = a.vy * 0.7 + b.vy * 0.3;
  b.vx = b.vx * 0.7 + avx * 0.3;
  b.vy = b.vy * 0.7 + avy * 0.3;
  return rel;
}

export function drawCar(ctx, car, time) {
  const type = CAR_TYPES[car.type];
  const len = type.length;
  const wid = type.width;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
  // Wheels.
  ctx.fillStyle = '#1a1a1a';
  const wheelTurn = car.steer * 0.35;
  ctx.save();
  ctx.translate(len * 0.32, -wid / 2 - 2);
  ctx.rotate(wheelTurn);
  ctx.fillRect(-7, -3, 14, 6);
  ctx.restore();
  ctx.save();
  ctx.translate(len * 0.32, wid / 2 - 4);
  ctx.rotate(wheelTurn);
  ctx.fillRect(-7, -3, 14, 6);
  ctx.restore();
  ctx.fillRect(-len * 0.32 - 7, -wid / 2 - 2, 14, 6);
  ctx.fillRect(-len * 0.32 - 7, wid / 2 - 4, 14, 6);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 7);
  ctx.fill();
  // Police livery.
  if (car.type === 'police') {
    ctx.fillStyle = '#22252c';
    ctx.fillRect(-len * 0.1, -wid / 2, len * 0.28, wid);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
    // Light bar, alternating.
    const phase = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2a2a' : '#2a6bff';
    ctx.fillRect(-6, -wid / 2 - 2, 12, 5);
    ctx.fillStyle = phase ? '#2a6bff' : '#ff2a2a';
    ctx.fillRect(-6, wid / 2 - 3, 12, 5);
  }
  // Windshield and rear window.
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  ctx.fillRect(len * 0.12, -wid / 2 + 3, len * 0.16, wid - 6);
  ctx.fillRect(-len * 0.32, -wid / 2 + 3, len * 0.1, wid - 6);
  // Headlights and tail lights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(len / 2 - 2, -wid / 2 + 2, 3, 5);
  ctx.fillRect(len / 2 - 2, wid / 2 - 7, 3, 5);
  ctx.fillStyle = '#ff3b30';
  ctx.fillRect(-len / 2 - 1, -wid / 2 + 2, 3, 5);
  ctx.fillRect(-len / 2 - 1, wid / 2 - 7, 3, 5);
  ctx.restore();
  // Smoke when wrecked.
  if (car.smoke > 0) {
    ctx.fillStyle = `rgba(80,80,80,${0.25 + car.smoke * 0.4})`;
    ctx.beginPath();
    ctx.arc(car.x - Math.cos(car.angle) * 8, car.y - Math.sin(car.angle) * 8, 6 + Math.sin(time * 9) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
