// Milo Kade, the player. On foot he walks, sprints, punches and shoots toward
// the mouse; in a car he drives it. Health, money and ammo live here, and so
// does getting in and out of cars.
import { PLAYER, PISTOL, MONEY } from './config.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    health: PLAYER.health,
    money: MONEY.start,
    ammo: PISTOL.startAmmo,
    car: null,
    punchCooldown: 0,
    shootCooldown: 0,
    invulnerable: 0,
    sprinting: false,
    moving: false,
    // Last direction walked, for the idle pose.
    walkAngle: -Math.PI / 2,
  };
}

/** On-foot movement. Returns true when the player moved this step. */
export function stepOnFoot(player, move, dt, city) {
  const speed = move.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  const len = Math.hypot(move.x, move.y);
  if (len < 0.01) {
    player.moving = false;
    return false;
  }
  const nx = move.x / len;
  const ny = move.y / len;
  player.walkAngle = Math.atan2(ny, nx);
  player.sprinting = move.sprint;
  const fixed = city.resolveCircle(player.x + nx * speed * dt, player.y + ny * speed * dt, PLAYER.radius);
  player.x = fixed.x;
  player.y = fixed.y;
  player.moving = true;
  return true;
}

export function hurtPlayer(player, amount) {
  if (player.invulnerable > 0) return false;
  player.health -= amount;
  player.invulnerable = 0.6;
  return true;
}

/** Enter a car (driver's seat). The player vanishes into it. */
export function enterCar(player, car) {
  player.car = car;
  car.driver = 'player';
  player.x = car.x;
  player.y = car.y;
}

/** Step out beside the car, on the driver's side. */
export function exitCar(player, city) {
  const car = player.car;
  if (!car) return;
  car.driver = null;
  car.vx = 0;
  car.vy = 0;
  car.speed = 0;
  const side = { x: -Math.sin(car.angle), y: Math.cos(car.angle) };
  const spot = city.resolveCircle(car.x + side.x * 30, car.y + side.y * 30, PLAYER.radius);
  player.x = spot.x;
  player.y = spot.y;
  player.car = null;
}

export function drawPlayer(ctx, player, time) {
  if (player.car) return;
  const bob = player.moving ? Math.sin(time * 14) * 2 : 0;
  ctx.save();
  ctx.translate(player.x, player.y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs (two feet that alternate while walking).
  ctx.fillStyle = '#2c3550';
  const step = player.moving ? Math.sin(time * 14) * 4 : 0;
  ctx.beginPath();
  ctx.arc(-4 + step, 6, 4, 0, Math.PI * 2);
  ctx.arc(4 - step, 6, 4, 0, Math.PI * 2);
  ctx.fill();
  // Body: teal jacket, Milo's look.
  ctx.rotate(player.angle + Math.PI / 2);
  ctx.fillStyle = '#2a9d8f';
  ctx.beginPath();
  ctx.arc(0, bob * 0.3, 11, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(0, -2, 7, 0, Math.PI * 2);
  ctx.fill();
  // Hair.
  ctx.fillStyle = '#22201c';
  ctx.beginPath();
  ctx.arc(0, -4, 7, Math.PI, Math.PI * 2);
  ctx.fill();
  // Pistol in hand when armed.
  if (player.ammo > 0) {
    ctx.fillStyle = '#333333';
    ctx.fillRect(6, -14, 3, 10);
  }
  ctx.restore();
  // Health pip when hurt.
  if (player.health < PLAYER.health) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(player.x - 14, player.y - 26, 28, 4);
    ctx.fillStyle = player.health > 30 ? '#7ac74f' : '#e5534b';
    ctx.fillRect(player.x - 14, player.y - 26, 28 * Math.max(0, player.health) / PLAYER.health, 4);
  }
}
