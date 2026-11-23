// Traffic: the cars that fill the roads, and the parked cars waiting to be
// stolen. NPC drivers follow the grid: pick an intersection, drive to it,
// turn, repeat; they slow for the car ahead and never reverse.
import { TRAFFIC, CAR } from './config.js';
import { createCar, stepCar, CAR_TYPES } from './vehicles.js';
import { ROADS_X, ROADS_Y } from './config.js';

const NPC_TYPES = ['sedan', 'sedan', 'hatch', 'hatch', 'taxi', 'truck'];

function randomParkedSpot(city, random) {
  // Parked along the kerb, on the road's edge lane — never inside a block,
  // where a building could swallow the car.
  const kerb = 34;
  const vertical = random.chance(0.5);
  if (vertical) {
    const rx = random.pick(ROADS_X);
    const side = random.chance(0.5) ? 1 : -1;
    return {
      x: rx + side * kerb,
      y: random.range(120, 2480),
      angle: side > 0 ? Math.PI / 2 : -Math.PI / 2,
    };
  }
  const ry = random.pick(ROADS_Y);
  const side = random.chance(0.5) ? 1 : -1;
  return {
    x: random.range(120, 3480),
    y: ry + side * kerb,
    angle: side > 0 ? 0 : Math.PI,
  };
}

export function createTraffic(city, random) {
  const parked = [];
  const moving = [];
  for (let i = 0; i < TRAFFIC.parkedCount; i += 1) {
    const spot = randomParkedSpot(city, random);
    const type = random.pick(NPC_TYPES);
    const car = createCar(type, spot.x, spot.y, spot.angle, random.pick(CAR_TYPES[type].colors), null);
    parked.push(car);
  }
  for (let i = 0; i < TRAFFIC.carCount; i += 1) {
    moving.push(spawnMovingCar(city, random));
  }
  return { parked, moving, random, city };
}

function spawnMovingCar(city, random) {
  const p = city.randomRoadPoint();
  const type = random.pick(NPC_TYPES);
  const car = createCar(type, p.x, p.y, random.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), random.pick(CAR_TYPES[type].colors), 'npc');
  car.target = city.randomIntersection();
  return car;
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** One NPC driver's decision: throttle and steer toward its target corner. */
function driveNpc(car, traffic, dt) {
  const dx = car.target.x - car.x;
  const dy = car.target.y - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 30) {
    car.target = traffic.city.randomIntersection();
    return { throttle: 0.4, steer: 0, handbrake: false };
  }
  const want = Math.atan2(dy, dx);
  const diff = angleDiff(car.angle, want);
  let throttle = 0.55;
  // Slow for the car ahead.
  for (const other of traffic.moving) {
    if (other === car || other.driver !== 'npc') continue;
    const ox = other.x - car.x;
    const oy = other.y - car.y;
    const ahead = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
    const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 70 && side < 26) {
      throttle = 0;
      break;
    }
  }
  return { throttle, steer: Math.max(-1, Math.min(1, diff * 2.2)), handbrake: false };
}

export function stepTraffic(traffic, dt) {
  const { city, random } = traffic;
  for (const car of traffic.moving) {
    if (car.driver !== 'npc') continue;
    const drive = driveNpc(car, traffic, dt);
    // NPC cars cruise slower than the player's.
    const capped = { ...drive, throttle: drive.throttle * (TRAFFIC.carSpeed / CAR.maxSpeed) * 1.6 };
    stepCar(car, capped, dt, city);
    // A car that somehow left the roads gets a fresh target.
    if (!city.onRoad(car.x, car.y) && Math.hypot(car.vx, car.vy) < 20) {
      const p = city.randomRoadPoint();
      car.x = p.x;
      car.y = p.y;
      car.target = city.randomIntersection();
    }
  }
  // Keep the streets full: replace wrecked or stolen NPC cars.
  for (let i = traffic.moving.length - 1; i >= 0; i -= 1) {
    const car = traffic.moving[i];
    if (car.dead || car.driver === 'player') {
      traffic.moving.splice(i, 1);
      traffic.moving.push(spawnMovingCar(city, random));
    }
  }
  // Parked cars that were wrecked get towed and replaced.
  for (let i = traffic.parked.length - 1; i >= 0; i -= 1) {
    const car = traffic.parked[i];
    if (car.dead) {
      traffic.parked.splice(i, 1);
      const spot = randomParkedSpot(city, random);
      const type = random.pick(NPC_TYPES);
      traffic.parked.push(createCar(type, spot.x, spot.y, spot.angle, random.pick(CAR_TYPES[type].colors), null));
    }
  }
}

/** The closest car to a point, within maxDist. `filter` picks which cars count. */
export function nearestCar(cars, x, y, maxDist, filter) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (filter && !filter(car)) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}
