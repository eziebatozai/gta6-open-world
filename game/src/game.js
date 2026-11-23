// Solmar Bay — the simulation. createGame builds a fresh city and every
// system in it; stepGame advances one fixed step from a single input shape.
// No DOM here except the canvas-independent city layer: the loop (main.js)
// maps real keys to the input, and shots.js drives it scripted.
import { STEP, PLAYER, PISTOL, MONEY, CAR } from './config.js';
import { createRandom } from './random.js';
import { createCity, LANDMARKS as MARKS } from './world.js';
import { createPlayer, stepOnFoot, hurtPlayer, enterCar, exitCar } from './player.js';
import { createCar, stepCar, collideCars, carSpeed, CAR_TYPES } from './vehicles.js';
import { createTraffic, stepTraffic, nearestCar } from './traffic.js';
import { createPedestrians, stepPedestrians, scarePeds, knockDown } from './pedestrians.js';
import { createPolice, addWanted, stepPolice, playerPos } from './police.js';
import { createBullets, shoot, stepBullets, punchAt } from './combat.js';
import { createMissions, startMission, stepMissions, missionTarget, missionObjectiveText, currentMission, say } from './missions.js';
import { createEffects, spawnParticles, spawnExplosion, addSkid, addFlash, stepEffects } from './effects.js';
import { loadSave, writeSave } from './save.js';

void STEP;

const PICKUP_COUNT = 6;
const SPORTS_PRICE = 500;

export function createGame(seed, saved) {
  const random = createRandom(seed);
  const city = createCity(random);
  const player = createPlayer(700, 1250);
  const traffic = createTraffic(city, random);
  const peds = createPedestrians(city, random);
  const police = createPolice();
  const missions = createMissions();
  const bullets = createBullets();
  const effects = createEffects();
  const pickups = [];
  for (let i = 0; i < PICKUP_COUNT; i += 1) {
    const p = city.randomRoadPoint();
    pickups.push({ x: p.x, y: p.y });
  }
  const game = {
    seed,
    random,
    city,
    player,
    traffic,
    peds,
    police,
    missions,
    bullets,
    effects,
    pickups,
    clock: 480, // 08:00.
    time: 0,
    stats: { earned: 0, stolen: 0, escapes: 0, busted: 0, wasted: 0 },
    banner: null,
    bannerSub: null,
    bannerColor: '#ffd94a',
    bannerTimer: 0,
    hint: null,
    objectiveText: '',
    missionTarget: null,
    ownedSports: false,
    events: [],
    saveTimer: 0,
    lastWanted: 0,
  };
  if (saved) {
    if (typeof saved.money === 'number') player.money = saved.money;
    if (typeof saved.missionIndex === 'number') missions.index = Math.min(saved.missionIndex, 5);
    if (saved.ownedSports) game.ownedSports = true;
    if (saved.stats) game.stats = { ...game.stats, ...saved.stats };
  }
  game.objectiveText = missionObjectiveText(missions);
  return game;
}

function showBanner(game, text, sub, color) {
  game.banner = text;
  game.bannerSub = sub || null;
  game.bannerColor = color || '#ffd94a';
  game.bannerTimer = 3;
}

function explodeCar(game, car) {
  if (car.exploded) return;
  car.exploded = true;
  car.dead = true;
  spawnExplosion(game.effects, car.x, car.y);
  game.events.push('explosion');
  scarePeds(game.peds, car.x, car.y, 320);
  const pos = playerPos(game.player);
  if (Math.hypot(pos.x - car.x, pos.y - car.y) < 130) {
    if (game.player.car === car) {
      exitCar(game.player, game.city);
      hurtPlayer(game.player, 40);
    } else {
      hurtPlayer(game.player, 25);
    }
  }
  for (const ped of game.peds) {
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 120) knockDown(ped);
  }
  for (const other of [...game.traffic.moving, ...game.traffic.parked, ...game.police.cars]) {
    if (other !== car && !other.dead && Math.hypot(other.x - car.x, other.y - car.y) < 130) other.hp -= 45;
  }
}

function respawnAt(game, markId, health) {
  const mark = MARKS[markId];
  game.player.health = health;
  game.police.stars = 0;
  game.police.cars = [];
  game.police.cops = [];
  if (game.player.car) {
    game.player.car.driver = null;
    game.player.car = null;
  }
  const spot = game.city.resolveCircle(mark.x + 40, mark.y + 40, PLAYER.radius);
  game.player.x = spot.x;
  game.player.y = spot.y;
}

function applyBusted(game) {
  const lost = Math.floor(game.player.money * MONEY.bustLoss);
  game.player.money -= lost;
  game.stats.busted += 1;
  respawnAt(game, 'policeHQ', 50);
  showBanner(game, 'BUSTED', `The cops took $${lost}.`, '#6ea8ff');
  game.events.push('busted');
}

function applyWasted(game) {
  const lost = Math.floor(game.player.money * MONEY.wastedLoss);
  game.player.money -= lost;
  game.stats.wasted += 1;
  respawnAt(game, 'hospital', PLAYER.health);
  showBanner(game, 'WASTED', `The medics took $${lost}.`, '#e5534b');
  game.events.push('wasted');
}

/**
 * One fixed step. `input` is { move: {x, y, sprint}, aim: {x, y}, shoot,
 * punch, enter, mission, buy, handbrake }. Sounds and banners are reported
 * through game.events and game.banner.
 */
export function stepGame(game, input, dt) {
  game.time += dt;
  game.clock += dt * 0.667; // One game hour per 90 real seconds.
  game.events = [];
  const player = game.player;
  const city = game.city;
  if (player.punchCooldown > 0) player.punchCooldown -= dt;
  if (player.shootCooldown > 0) player.shootCooldown -= dt;
  if (player.invulnerable > 0) player.invulnerable -= dt;
  if (game.bannerTimer > 0) game.bannerTimer -= dt;
  if (game.missions.dialogueTimer > 0) game.missions.dialogueTimer -= dt;

  // Aim follows the mouse, on foot and in the car.
  const aimX = input.aim ? input.aim.x : player.x;
  const aimY = input.aim ? input.aim.y : player.y;
  if (!player.car) player.angle = Math.atan2(aimY - player.y, aimX - player.x);

  // ---- Entering and leaving cars. ----
  if (input.enter) {
    if (player.car) {
      exitCar(player, city);
    } else {
      const allCars = [...game.traffic.parked, ...game.traffic.moving];
      const car = nearestCar(allCars, player.x, player.y, 52, (c) => !c.dead && c.type !== 'police' && c.driver !== 'player');
      if (car) {
        const stolen = !car.owned;
        enterCar(player, car);
        if (stolen) {
          game.stats.stolen += 1;
          addWanted(game.police, 1);
          showBanner(game, 'CAR STOLEN', 'The owner called the cops!', '#ff9a3d');
        }
      }
    }
  }

  // ---- The garage shop: a faster car for $500. ----
  game.hint = null;
  const garage = MARKS.garage;
  if (!player.car && Math.hypot(player.x - garage.x, player.y - garage.y) < 110) {
    if (!game.ownedSports) {
      game.hint = player.money >= SPORTS_PRICE ? 'B — Buy the Comet GT ($500)' : `Comet GT $500 — you have $${Math.floor(player.money)}`;
      if (input.buy && player.money >= SPORTS_PRICE) {
        player.money -= SPORTS_PRICE;
        game.ownedSports = true;
        const car = createCar('sports', garage.x + 60, garage.y + 30, Math.PI / 2, '#d42a2a', null);
        car.owned = true;
        game.traffic.parked.push(car);
        showBanner(game, 'COMET GT BOUGHT', 'Your own sports car — parked at the garage.', '#7ac74f');
        game.events.push('pickup');
      }
    } else {
      game.hint = 'Your Comet GT is parked here';
    }
  }

  // ---- On foot or driving. ----
  if (player.car) {
    const car = player.car;
    const drive = {
      throttle: (input.move.y < 0 ? 1 : 0) + (input.move.y > 0 ? -1 : 0),
      steer: (input.move.x > 0 ? 1 : 0) - (input.move.x < 0 ? 1 : 0),
      handbrake: !!input.handbrake,
    };
    const before = carSpeed(car);
    const result = stepCar(car, drive, dt, city);
    if (result.hitWall && before > 200) {
      game.events.push('crash');
      spawnParticles(game.effects, car.x, car.y, 8, '#ffd23f', 160, 0.4, 3);
      scarePeds(game.peds, car.x, car.y, 160);
    }
    // Skid marks while drifting.
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    const side = Math.abs(-car.vx * fy + car.vy * fx);
    if ((drive.handbrake && before > 150) || side > 170) {
      addSkid(game.effects, car.x - fx * 14, car.y - fy * 14, car.angle);
      if (Math.random() < 0.3) game.events.push('skid');
    }
    // Car vs car.
    for (const other of [...game.traffic.moving, ...game.traffic.parked, ...game.police.cars]) {
      if (other === car || other.dead) continue;
      const hit = collideCars(car, other);
      if (hit > 240) {
        game.events.push('crash');
        spawnParticles(game.effects, (car.x + other.x) / 2, (car.y + other.y) / 2, 6, '#ffd23f', 140, 0.35, 3);
      }
    }
    // Car vs pedestrian: a crime.
    for (const ped of game.peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d < CAR.radius + 8 && carSpeed(car) > 120) {
        if (knockDown(ped)) {
          addWanted(game.police, 1);
          game.events.push('crash');
          showBanner(game, 'PEDESTRIAN DOWN', 'Someone saw that.', '#ff6b5e');
          scarePeds(game.peds, car.x, car.y, 300);
        }
      }
    }
    if (car.dead) explodeCar(game, car);
  } else {
    stepOnFoot(player, { x: input.move.x, y: input.move.y, sprint: input.move.sprint }, dt, city);
    // Shooting toward the mouse.
    if (input.shoot && player.shootCooldown <= 0 && player.ammo > 0) {
      player.shootCooldown = PISTOL.cooldown;
      player.ammo -= 1;
      const mx = player.x + Math.cos(player.angle) * 20;
      const my = player.y + Math.sin(player.angle) * 20;
      shoot(game.bullets, mx, my, player.angle, 'player');
      addFlash(game.effects, mx, my);
      game.events.push('gunshot');
      scarePeds(game.peds, player.x, player.y, 260);
    }
    // Punching.
    if (input.punch && player.punchCooldown <= 0) {
      player.punchCooldown = PLAYER.punchCooldown;
      const hit = punchAt(player.x, player.y, player.angle, {
        peds: game.peds,
        cops: game.police.cops,
        cars: [...game.traffic.parked, ...game.traffic.moving, ...game.police.cars],
      });
      game.events.push('punch');
      if (hit) {
        if (hit.kind === 'ped') {
          if (knockDown(hit.target)) {
            addWanted(game.police, 1);
            showBanner(game, 'ASSAULT', 'Someone saw that.', '#ff6b5e');
          }
        } else if (hit.kind === 'cop') {
          hit.target.health -= PLAYER.punchDamage;
          addWanted(game.police, 1);
        } else if (hit.kind === 'car') {
          hit.target.hp -= PLAYER.punchDamage;
        }
        spawnParticles(game.effects, player.x + Math.cos(player.angle) * 26, player.y + Math.sin(player.angle) * 26, 5, '#ffd23f', 120, 0.3, 3);
      }
    }
  }

  // ---- Traffic and pedestrians. ----
  stepTraffic(game.traffic, dt);
  stepPedestrians(game.peds, dt, city, game.random);

  // ---- Bullets. ----
  const allCars = [...game.traffic.parked, ...game.traffic.moving, ...game.police.cars];
  const bulletEvents = stepBullets(game.bullets, dt, city, { player, peds: game.peds, cops: game.police.cops, cars: allCars });
  for (const spark of bulletEvents.sparks) spawnParticles(game.effects, spark.x, spark.y, 4, '#ffd23f', 120, 0.25, 2);
  for (const hit of bulletEvents.hits) {
    if (hit.kind === 'player') {
      hurtPlayer(player, hit.damage);
    } else if (hit.kind === 'ped') {
      if (knockDown(hit.target)) {
        addWanted(game.police, 1);
        showBanner(game, 'PEDESTRIAN DOWN', 'Someone saw that.', '#ff6b5e');
        scarePeds(game.peds, hit.target.x, hit.target.y, 280);
      }
    } else if (hit.kind === 'cop') {
      hit.target.health -= hit.damage;
      if (hit.target.health <= 0) addWanted(game.police, 1);
    } else if (hit.kind === 'car') {
      hit.target.hp -= hit.damage;
      spawnParticles(game.effects, hit.target.x, hit.target.y, 5, '#ffb84d', 130, 0.3, 3);
      if (hit.target.hp <= 0) explodeCar(game, hit.target);
    }
  }

  // ---- Wrecks catch fire. ----
  for (const car of allCars) {
    if (car.hp <= 0 && !car.dead) explodeCar(game, car);
  }

  // ---- The police. ----
  const policeResult = stepPolice(game.police, dt, {
    player,
    city,
    random: game.random,
    onRam: () => game.events.push('crash'),
    onRunOver: () => {
      hurtPlayer(player, 30);
      addWanted(game.police, 1);
    },
  });
  if (policeResult.busted) applyBusted(game);
  if (game.lastWanted >= 3 && game.police.stars === 0) game.stats.escapes += 1;
  game.lastWanted = game.police.stars;

  // ---- Cash pickups. ----
  const pos = playerPos(player);
  for (const pick of game.pickups) {
    if (Math.hypot(pick.x - pos.x, pick.y - pos.y) < 28) {
      player.money += MONEY.pickup;
      game.stats.earned += MONEY.pickup;
      game.events.push('pickup');
      spawnParticles(game.effects, pick.x, pick.y, 8, '#7ac74f', 120, 0.4, 3);
      const np = city.randomRoadPoint();
      pick.x = np.x;
      pick.y = np.y;
    }
  }

  // ---- Missions. ----
  if (input.mission && !game.missions.active && !game.missions.finished) {
    if (startMission(game.missions, { player, addWanted: (n) => addWanted(game.police, n) })) {
      game.events.push('mission-start');
    }
  }
  const missionResult = stepMissions(game.missions, dt, {
    player,
    police: game.police,
    addWanted: (n) => addWanted(game.police, n),
    onMissionComplete: (def) => {
      game.stats.earned += def.reward;
      showBanner(game, 'JOB DONE', `+$${def.reward} — ${def.title}`, '#7ac74f');
      game.events.push('mission-complete');
    },
    onMissionFailed: () => game.events.push('mission-failed'),
  });
  void missionResult;
  game.objectiveText = missionObjectiveText(game.missions);
  game.missionTarget = missionTarget(game.missions);

  // ---- Wasted. ----
  if (player.health <= 0) applyWasted(game);

  // ---- Effects and autosave. ----
  stepEffects(game.effects, dt);
  game.saveTimer += dt;
  if (game.saveTimer > 10) {
    game.saveTimer = 0;
    writeSave({
      money: player.money,
      missionIndex: game.missions.index,
      ownedSports: game.ownedSports,
      stats: game.stats,
    });
  }
}

/** Reset the game to a fresh state with the same seed. */
export function resetGame(game) {
  const saved = null;
  const fresh = createGame(game.seed, saved);
  for (const key of Object.keys(fresh)) game[key] = fresh[key];
}
