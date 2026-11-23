// Combat: bullets and punches. Bullets fly straight, spark off buildings,
// and hurt whatever they touch first — pedestrians, cops, cars, the player.
// A punch is a short arc in front of the player with a knockback.
import { PISTOL, PLAYER, CAR } from './config.js';

export function createBullets() {
  return [];
}

export function shoot(bullets, x, y, angle, from) {
  bullets.push({
    x, y,
    vx: Math.cos(angle) * PISTOL.bulletSpeed,
    vy: Math.sin(angle) * PISTOL.bulletSpeed,
    life: PISTOL.range / PISTOL.bulletSpeed,
    from,
    damage: PISTOL.damage,
  });
}

/**
 * Move bullets and resolve hits. `targets` is { player, peds, cops, cars }.
 * Returns events: { sparks: [{x,y}], hits: [{kind, target, damage}] }.
 */
export function stepBullets(bullets, dt, city, targets) {
  const events = { sparks: [], hits: [] };
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0;
    if (!dead && city.hitsBuilding(b.x, b.y, 2)) {
      events.sparks.push({ x: b.x, y: b.y });
      dead = true;
    }
    if (!dead && b.from !== 'player' && targets.player && !targets.player.car) {
      const d = Math.hypot(b.x - targets.player.x, b.y - targets.player.y);
      if (d < PLAYER.radius) {
        events.hits.push({ kind: 'player', target: targets.player, damage: b.damage });
        dead = true;
      }
    }
    if (!dead && b.from === 'player') {
      for (const ped of targets.peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(b.x - ped.x, b.y - ped.y) < 10) {
          events.hits.push({ kind: 'ped', target: ped, damage: b.damage });
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'player') {
      for (const cop of targets.cops) {
        if (Math.hypot(b.x - cop.x, b.y - cop.y) < 11) {
          events.hits.push({ kind: 'cop', target: cop, damage: b.damage });
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const car of targets.cars) {
        if (car.dead) continue;
        // Skip the car the shooter is driving.
        if (b.from === 'player' && targets.player && targets.player.car === car) continue;
        const dx = b.x - car.x;
        const dy = b.y - car.y;
        const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        const across = -dx * Math.sin(car.angle) + dy * Math.cos(car.angle);
        if (Math.abs(along) < 24 && Math.abs(across) < 13) {
          events.hits.push({ kind: 'car', target: car, damage: b.damage });
          dead = true;
          break;
        }
      }
    }
    if (dead) bullets.splice(i, 1);
  }
  return events;
}

/** A punch in front of (x, y) facing `angle`. Returns the first target hit. */
export function punchAt(x, y, angle, targets) {
  const reach = PLAYER.punchRange;
  const px = x + Math.cos(angle) * reach * 0.6;
  const py = y + Math.sin(angle) * reach * 0.6;
  for (const ped of targets.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - px, ped.y - py) < 22) return { kind: 'ped', target: ped };
  }
  for (const cop of targets.cops) {
    if (Math.hypot(cop.x - px, cop.y - py) < 22) return { kind: 'cop', target: cop };
  }
  for (const car of targets.cars) {
    if (car.dead) continue;
    if (Math.hypot(car.x - px, car.y - py) < CAR.radius + 10) return { kind: 'car', target: car };
  }
  return null;
}

export function drawBullets(ctx, bullets) {
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 2;
  for (const b of bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}
