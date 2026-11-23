// The screenshot scenes behind ?shot=cover|foot|chase|mission. Each one stages
// the real game — a fresh world, a scripted driver playing the real rules
// forward for a few seconds — so the frame is what the game really looks
// like, and the same seed always gives the same frame.
import { STEP, CAR } from './config.js';
import { stepGame, resetGame } from './game.js';
import { createCar } from './vehicles.js';
import { addWanted } from './police.js';
import { startMission } from './missions.js';
import { SCREEN_PLAY } from './render.js';

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Steer a car toward a point, full throttle, no handbrake. */
function driveToward(game, tx, ty) {
  const car = game.player.car;
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleDiff(car.angle, want);
  return {
    move: { x: Math.max(-1, Math.min(1, diff * 2.2)), y: -1, sprint: false },
    aim: { x: car.x, y: car.y },
    shoot: false, punch: false, enter: false, mission: false, buy: false, handbrake: false,
  };
}

/** Walk on foot toward a point. */
function walkToward(game, tx, ty) {
  const dx = tx - game.player.x;
  const dy = ty - game.player.y;
  const d = Math.hypot(dx, dy) || 1;
  return {
    move: { x: dx / d, y: dy / d, sprint: false },
    aim: { x: tx, y: ty },
    shoot: false, punch: false, enter: false, mission: false, buy: false, handbrake: false,
  };
}

function idleInput(game) {
  return {
    move: { x: 0, y: 0, sprint: false },
    aim: { x: game.player.x, y: game.player.y },
    shoot: false, punch: false, enter: false, mission: false, buy: false, handbrake: false,
  };
}

function simulate(game, seconds, inputFn) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) stepGame(game, inputFn(game), STEP);
}

function putPlayerInCar(game, type, x, y, angle, color) {
  const car = createCar(type, x, y, angle, color, null);
  game.traffic.parked.push(car);
  game.player.x = x;
  game.player.y = y;
  game.player.car = car;
  car.driver = 'player';
  return car;
}

function putPoliceBehind(game, px, py, angle, count, gap) {
  for (let i = 0; i < count; i += 1) {
    const bx = px - Math.cos(angle) * (90 + i * gap);
    const by = py - Math.sin(angle) * (90 + i * gap);
    const car = createCar('police', bx, by, angle, '#e8e8e8', 'police');
    car.vx = Math.cos(angle) * 300;
    car.vy = Math.sin(angle) * 300;
    car.speed = 300;
    game.police.cars.push(car);
  }
}

function stageCover(game) {
  // Downtown, mid-afternoon: Milo in a Comet GT, two stars, two interceptors
  // on his tail, the getaway job live on the HUD.
  game.clock = 15 * 60;
  game.missions.index = 2;
  startMission(game.missions, { player: game.player, addWanted: (n) => addWanted(game.police, n) });
  const car = putPlayerInCar(game, 'sports', 1700, 900, Math.PI / 2, '#d42a2a');
  void car;
  addWanted(game.police, 2);
  putPoliceBehind(game, 1700, 900, Math.PI / 2, 2, 70);
  simulate(game, 6, (g) => driveToward(g, 1700, 2100));
}

function stageFoot(game) {
  // Old Town, late morning: Milo on foot among pedestrians, the city waking up.
  game.clock = 10 * 60;
  game.player.x = 700;
  game.player.y = 1150;
  game.player.angle = Math.PI / 2;
  simulate(game, 4, (g) => walkToward(g, 700, 1450));
  simulate(game, 1, idleInput);
}

function stageChase(game) {
  // Harbour, late afternoon: three stars, three interceptors, sirens, the docks.
  // Drive north, up the harbour road — mid-map, so the frame stays full of city.
  game.clock = 16 * 60 + 30;
  // The harbour's west road: the bay stays in frame, the world edge stays out.
  const car = putPlayerInCar(game, 'sedan', 2700, 2100, -Math.PI / 2, '#2e6fb0');
  void car;
  addWanted(game.police, 3);
  putPoliceBehind(game, 2700, 2100, -Math.PI / 2, 3, 65);
  simulate(game, 3, (g) => driveToward(g, 2700, 900));
}

function stageMission(game) {
  // Palms at dusk: the big score is live — four stars, the vault hit, and the
  // safehouse glowing on the minimap.
  game.clock = 18 * 60 + 30;
  game.missions.index = 4;
  startMission(game.missions, { player: game.player, addWanted: (n) => addWanted(game.police, n) });
  game.missions.step = 1;
  game.missions.cashBag = true;
  addWanted(game.police, 4);
  const car = putPlayerInCar(game, 'sports', 1700, 1200, Math.PI / 2, '#1f8fff');
  void car;
  putPoliceBehind(game, 1700, 1200, Math.PI / 2, 2, 180);
  // A short run straight south down the avenue: still moving fast, the
  // safehouse is a turn away, the interceptors are closing in behind.
  simulate(game, 1.5, (g) => driveToward(g, 1700, 2250));
}

/**
 * Set `game` to the named scene (cover, foot, chase or mission; any other
 * name is cover) and return the screen to draw.
 */
export function stageShot(name, game) {
  resetGame(game);
  if (name === 'foot') stageFoot(game);
  else if (name === 'chase') stageChase(game);
  else if (name === 'mission') stageMission(game);
  else stageCover(game);
  // A clean frame: no banner text over the action.
  game.banner = null;
  game.bannerSub = null;
  game.bannerTimer = 0;
  return { screen: SCREEN_PLAY };
}

export { CAR };
