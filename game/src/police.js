// The law of Solmar Bay. A wanted level from 0 to 5 stars; crimes raise it,
// police cars and foot cops spawn to answer it, chase and ram, and a foot cop
// who holds the player still busts them. Below 3 stars it fades when the
// player stays out of sight.
import { WANTED, POLICE, CAR } from './config.js';
import { createCar, stepCar, collideCars, carSpeed } from './vehicles.js';
import { scarePeds } from './pedestrians.js';

export function createPolice() {
  return {
    stars: 0,
    decayTimer: 0,
    cars: [],
    cops: [],
    bustTimer: 0,
    siren: 0,
  };
}

export function playerPos(player) {
  if (player.car) return { x: player.car.x, y: player.car.y };
  return { x: player.x, y: player.y };
}

/** Raise the wanted level, capped at 5. Returns the new level. */
export function addWanted(police, n) {
  police.stars = Math.min(WANTED.maxStars, police.stars + n);
  police.decayTimer = 0;
  return police.stars;
}

function spawnPoliceCar(police, city, random, px, py) {
  const p = city.randomRoadPoint();
  // Keep the spawn off the player's screen but close enough to arrive.
  const d = Math.hypot(p.x - px, p.y - py);
  if (d < 500 || d > 1100) {
    const angle = random.range(0, Math.PI * 2);
    const spot = { x: px + Math.cos(angle) * 700, y: py + Math.sin(angle) * 700 };
    const road = city.nearestRoadPoint(spot.x, spot.y);
    const car = createCar('police', road.x, road.y, 0, '#e8e8e8', 'police');
    police.cars.push(car);
    return;
  }
  const car = createCar('police', p.x, p.y, 0, '#e8e8e8', 'police');
  police.cars.push(car);
}

function spawnFootCop(police, city, random, px, py) {
  const angle = random.range(0, Math.PI * 2);
  const x = px + Math.cos(angle) * random.range(220, 420);
  const y = py + Math.sin(angle) * random.range(220, 420);
  const fixed = city.resolveCircle(x, y, 12);
  police.cops.push({ x: fixed.x, y: fixed.y, health: 50, bustHold: 0, phase: random.range(0, 6) });
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Advance the police. Returns { busted } when a foot cop holds the player.
 * `world` carries { player, city, traffic, peds, effects, audio, random }.
 */
export function stepPolice(police, dt, world) {
  const { player, city, random } = world;
  const pos = playerPos(player);
  const stars = police.stars;

  // Keep the force matched to the stars.
  const wantCars = stars === 0 ? 0 : Math.min(stars, 4);
  const wantCops = stars === 0 ? 0 : Math.min(stars, 3);
  while (police.cars.length < wantCars) spawnPoliceCar(police, city, random, pos.x, pos.y);
  while (police.cops.length < wantCops) spawnFootCop(police, city, random, pos.x, pos.y);

  // Chase cars.
  for (let i = police.cars.length - 1; i >= 0; i -= 1) {
    const car = police.cars[i];
    if (car.dead) {
      police.cars.splice(i, 1);
      continue;
    }
    const want = Math.atan2(pos.y - car.y, pos.x - car.x);
    const diff = angleDiff(car.angle, want);
    const drive = { throttle: 1, steer: Math.max(-1, Math.min(1, diff * 2.4)), handbrake: false };
    stepCar(car, drive, dt, city);
    // Ram the player's car, or the player on foot.
    if (player.car) {
      const hit = collideCars(car, player.car);
      if (hit > 240) world.onRam?.(hit);
    } else {
      const d = Math.hypot(car.x - player.x, car.y - player.y);
      if (d < CAR.radius + 12 && carSpeed(car) > 120) {
        world.onRunOver?.();
      }
    }
    // Despawn far away when the heat is off.
    if (stars === 0 && Math.hypot(car.x - pos.x, car.y - pos.y) > 1000) police.cars.splice(i, 1);
  }

  // Foot cops.
  let busted = false;
  for (let i = police.cops.length - 1; i >= 0; i -= 1) {
    const cop = police.cops[i];
    if (cop.health <= 0) {
      police.cops.splice(i, 1);
      continue;
    }
    const dx = pos.x - cop.x;
    const dy = pos.y - cop.y;
    const d = Math.hypot(dx, dy);
    if (d > 12) {
      const speed = POLICE.footSpeed;
      const nx = cop.x + (dx / d) * speed * dt;
      const ny = cop.y + (dy / d) * speed * dt;
      const fixed = city.resolveCircle(nx, ny, 12);
      cop.x = fixed.x;
      cop.y = fixed.y;
    }
    if (d < 26 && !player.car) {
      cop.bustHold += dt;
      if (cop.bustHold >= POLICE.bustSeconds) busted = true;
    } else {
      cop.bustHold = Math.max(0, cop.bustHold - dt * 2);
    }
    if (stars === 0 && d > 900) police.cops.splice(i, 1);
  }

  // Wanted decay: below 3 stars, out of sight, the heat cools off.
  if (stars > 0 && stars < 3) {
    let nearest = Infinity;
    for (const car of police.cars) nearest = Math.min(nearest, Math.hypot(car.x - pos.x, car.y - pos.y));
    for (const cop of police.cops) nearest = Math.min(nearest, Math.hypot(cop.x - pos.x, cop.y - pos.y));
    if (nearest > 480) {
      police.decayTimer += dt;
      if (police.decayTimer >= WANTED.decaySeconds) {
        police.stars -= 1;
        police.decayTimer = 0;
        if (police.stars === 0) {
          police.cars = [];
          police.cops = [];
        }
      }
    } else {
      police.decayTimer = 0;
    }
  }
  police.siren = stars > 0 ? 1 : 0;
  return { busted };
}

export function drawPolice(ctx, police, time) {
  for (const cop of police.cops) {
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(1, 3, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Navy uniform, badge, cap.
    ctx.fillStyle = '#1f2a44';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(0, -2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1f2a44';
    ctx.beginPath();
    ctx.arc(0, -4, 5, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd94a';
    ctx.fillRect(-2, 2, 4, 3);
    ctx.restore();
  }
  void time;
}
