// Pedestrians: the people of Solmar Bay. They stroll the sidewalks, cross at
// corners, flee from gunfire and speeding cars, and go down when a car hits
// them. A downed pedestrian is a crime the police notice.
import { TRAFFIC } from './config.js';

const SHIRTS = ['#e07a3f', '#3fa08a', '#8a6fb0', '#c0392b', '#2e6fb0', '#d9a441', '#7a7f85', '#e8e8e8', '#4a7a4f', '#b03a5a'];

export function createPedestrians(city, random) {
  const peds = [];
  for (let i = 0; i < TRAFFIC.pedCount; i += 1) {
    const p = city.randomSidewalkPoint();
    peds.push({
      x: p.x, y: p.y,
      tx: p.x, ty: p.y,
      speed: TRAFFIC.pedSpeed * random.range(0.7, 1.3),
      color: random.pick(SHIRTS),
      state: 'walk',
      downTimer: 0,
      fleeX: 0, fleeY: 0,
      phase: random.range(0, Math.PI * 2),
    });
  }
  return peds;
}

export function stepPedestrians(peds, dt, city, random) {
  for (const ped of peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.state = 'flee';
        ped.fleeX = ped.x;
        ped.fleeY = ped.y;
      }
      continue;
    }
    let tx = ped.tx;
    let ty = ped.ty;
    let speed = ped.speed;
    if (ped.state === 'flee') {
      tx = ped.fleeX;
      ty = ped.fleeY;
      speed = ped.speed * 2.6;
    }
    const dx = tx - ped.x;
    const dy = ty - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 8) {
      if (ped.state === 'flee') {
        ped.state = 'walk';
        const p = city.randomSidewalkPoint();
        ped.tx = p.x;
        ped.ty = p.y;
      } else {
        const p = city.randomSidewalkPoint();
        ped.tx = p.x;
        ped.ty = p.y;
      }
      continue;
    }
    const nx = ped.x + (dx / d) * speed * dt;
    const ny = ped.y + (dy / d) * speed * dt;
    const fixed = city.resolveCircle(nx, ny, 8);
    ped.x = fixed.x;
    ped.y = fixed.y;
    ped.phase += dt * 8;
  }
}

/** Everyone near a scare runs away from it. */
export function scarePeds(peds, x, y, radius) {
  for (const ped of peds) {
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius && ped.state !== 'down') {
      ped.state = 'flee';
      const away = Math.atan2(ped.y - y, ped.x - x);
      ped.fleeX = ped.x + Math.cos(away) * 300;
      ped.fleeY = ped.y + Math.sin(away) * 300;
    }
  }
}

/** Knock a pedestrian down (car hit). Returns true when it was a fresh hit. */
export function knockDown(ped) {
  if (ped.state === 'down') return false;
  ped.state = 'down';
  ped.downTimer = 3;
  return true;
}

export function drawPedestrians(ctx, peds, time) {
  for (const ped of peds) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      // Lying on the ground, stars circling.
      ctx.rotate(0.4);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 3, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8b98a';
      ctx.beginPath();
      ctx.arc(11, -2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd94a';
      const a = time * 4;
      for (let k = 0; k < 3; k += 1) {
        const sx = Math.cos(a + k * 2.1) * 12;
        const sy = -8 + Math.sin(a + k * 2.1) * 4;
        ctx.fillRect(sx - 1, sy - 1, 3, 3);
      }
      ctx.restore();
      continue;
    }
    const bob = Math.sin(ped.phase) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(1, 3, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(0, bob * 0.3, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(0, -2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
