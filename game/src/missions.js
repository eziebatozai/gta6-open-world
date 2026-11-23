// Missions and the story of Solmar Bay. Milo Kade is back in town with $120
// and a borrowed jacket. Lena Cruz, the fixer, has work. Five jobs, in order:
// steal a car, run deliveries, grab cash and lose the cops, move a crate, and
// the big score. Each job is steps with a target on the map; finishing one
// pays cash and unlocks the next.
import { LANDMARKS } from './world.js';

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    giver: 'Vic Moreno',
    reward: 150,
    briefing: "Vic: Milo! You're back. I need wheels — any wheels. Take a parked car, bring it to my garage, and I'll make it worth your while.",
    done: "Vic: She's a beauty. Here's your cut, kid. Sofia's got a lunch rush if you want more work.",
    steps: [
      { type: 'steal', text: 'Steal a car — walk up to a parked car and press E', radius: 0 },
      { type: 'goto', target: 'garage', text: "Drive to Vic's Garage", radius: 70 },
    ],
  },
  {
    id: 'lunch-rush',
    title: 'Lunch Rush',
    giver: 'Sofia Reyes',
    reward: 250,
    briefing: "Sofia: My delivery boy quit — again. Three orders, three stops, and the food's getting cold. Fast, Milo. Fast.",
    done: "Sofia: Every order hot, every customer happy. You're hired whenever you want the work.",
    timeLimit: 180,
    steps: [
      { type: 'goto', target: 'diner', text: "Pick up the orders at Sofia's Diner", radius: 70 },
      { type: 'goto', target: 'bank', text: 'Deliver to Solmar Trust Bank', radius: 70 },
      { type: 'goto', target: 'hospital', text: 'Deliver to St. Marina Hospital', radius: 70 },
      { type: 'goto', target: 'beach', text: 'Deliver to Sunset Beach', radius: 70 },
    ],
  },
  {
    id: 'getaway',
    title: 'The Getaway',
    giver: 'Lena Cruz',
    reward: 400,
    briefing: "Lena: The bank's cash room is open for exactly one minute. Grab the bag, then lose the cops and get to the safehouse. Don't get cute.",
    done: "Lena: Clean. The cops are still looking at an empty parking lot. You're moving up, Milo.",
    steps: [
      { type: 'goto', target: 'bank', text: 'Grab the cash bag at Solmar Trust Bank', radius: 70 },
      { type: 'escape', text: 'Lose the cops — stay out of sight until the heat cools', radius: 0, seconds: 10 },
      { type: 'goto', target: 'safehouse', text: 'Reach the Safehouse', radius: 70 },
    ],
  },
  {
    id: 'harbour-lights',
    title: 'Harbour Lights',
    giver: 'Vic Moreno',
    reward: 350,
    briefing: "Vic: A crate came in at the docks and the harbour police are sniffing around. Pick it up, bring it to the warehouse. Quietly.",
    done: "Vic: The crate's safe. Whatever's inside it, it's worth more than my garage. Good driving.",
    steps: [
      { type: 'goto', target: 'dock', text: 'Pick up the crate at the Harbour Dock', radius: 70 },
      { type: 'goto', target: 'warehouse', text: 'Deliver it to the Harbour Warehouse', radius: 70 },
    ],
  },
  {
    id: 'big-score',
    title: 'The Big Score',
    giver: 'Lena Cruz',
    reward: 800,
    briefing: "Lena: This is the one, Milo. The bank's vault, four stars of heat, and the safehouse on the other side of town. Pull this off and you own Solmar Bay.",
    done: "Lena: It's done. The whole city is talking about you. Solmar Bay is yours now, Milo Kade.",
    steps: [
      { type: 'goto', target: 'bank', text: 'Hit the vault at Solmar Trust Bank', radius: 70 },
      { type: 'goto', target: 'safehouse', text: 'Escape to the Safehouse — the whole city is after you', radius: 70 },
    ],
  },
];

export function createMissions() {
  return {
    index: 0,
    active: false,
    step: 0,
    timer: 0,
    escapeTimer: 0,
    failed: false,
    finished: false,
    dialogue: null,
    dialogueTimer: 0,
    cashBag: false,
  };
}

export function currentMission(missions) {
  return MISSIONS[missions.index] || null;
}

export function startMission(missions, world) {
  const def = currentMission(missions);
  if (!def || missions.active) return false;
  missions.active = true;
  missions.step = 0;
  missions.timer = def.timeLimit || 0;
  missions.escapeTimer = 0;
  missions.failed = false;
  missions.cashBag = false;
  say(missions, def.giver, def.briefing);
  if (def.id === 'harbour-lights') world.addWanted(1);
  return true;
}

export function say(missions, speaker, text) {
  missions.dialogue = { speaker, text };
  missions.dialogueTimer = 5;
}

function completeMission(missions, world) {
  const def = currentMission(missions);
  world.player.money += def.reward;
  say(missions, def.giver, def.done);
  world.onMissionComplete?.(def);
  missions.active = false;
  missions.index += 1;
  if (missions.index >= MISSIONS.length) missions.finished = true;
}

function failMission(missions, world, reason) {
  const def = currentMission(missions);
  say(missions, def.giver, `Job blown: ${reason}. Press N to try it again.`);
  world.onMissionFailed?.(def);
  missions.active = false;
  missions.failed = true;
}

/** The current objective's map target, for the HUD and minimap. */
export function missionTarget(missions) {
  if (!missions.active) return null;
  const def = currentMission(missions);
  if (!def) return null;
  const step = def.steps[missions.step];
  if (!step) return null;
  if (step.type === 'goto') {
    const mark = LANDMARKS[step.target];
    return { x: mark.x, y: mark.y, label: mark.name };
  }
  return null;
}

export function missionObjectiveText(missions) {
  if (!missions.active) {
    if (missions.finished) return 'Story complete — Solmar Bay is yours. Free roam!';
    const next = currentMission(missions);
    return next ? `Next job: ${next.title} — press N to start` : 'Free roam — find trouble or press N for work';
  }
  const def = currentMission(missions);
  const step = def.steps[missions.step];
  return `${def.title}: ${step.text}`;
}

/**
 * Advance the mission state. `world` carries { player, police, addWanted }.
 * Returns 'complete' | 'failed' | null.
 */
export function stepMissions(missions, dt, world) {
  if (missions.dialogueTimer > 0) missions.dialogueTimer -= dt;
  if (!missions.active) return null;
  const def = currentMission(missions);
  if (!def) return null;
  if (def.timeLimit) {
    missions.timer -= dt;
    if (missions.timer <= 0) {
      failMission(missions, world, 'out of time');
      return 'failed';
    }
  }
  const step = def.steps[missions.step];
  const pos = world.player.car
    ? { x: world.player.car.x, y: world.player.car.y }
    : { x: world.player.x, y: world.player.y };

  if (step.type === 'steal') {
    if (world.player.car) {
      missions.step += 1;
      say(missions, 'Vic Moreno', 'Good — now bring it to the garage. Careful with the paint.');
    }
    return null;
  }
  if (step.type === 'goto') {
    const mark = LANDMARKS[step.target];
    const d = Math.hypot(pos.x - mark.x, pos.y - mark.y);
    if (d < step.radius) {
      if (def.id === 'getaway' && missions.step === 0) {
        world.addWanted(3);
        missions.cashBag = true;
        say(missions, 'Lena Cruz', 'Bag secured! Three stars — lose them, then get to the safehouse.');
      } else if (def.id === 'big-score' && missions.step === 0) {
        world.addWanted(4);
        missions.cashBag = true;
        say(missions, 'Lena Cruz', 'Vault hit! Four stars on you — run!');
      }
      missions.step += 1;
      if (missions.step >= def.steps.length) {
        completeMission(missions, world);
        return 'complete';
      }
    }
    return null;
  }
  if (step.type === 'escape') {
    // Escape when no cop or police car is within 420 px.
    let nearest = Infinity;
    for (const car of world.police.cars) nearest = Math.min(nearest, Math.hypot(car.x - pos.x, car.y - pos.y));
    for (const cop of world.police.cops) nearest = Math.min(nearest, Math.hypot(cop.x - pos.x, cop.y - pos.y));
    if (nearest > 420) {
      missions.escapeTimer += dt;
      if (missions.escapeTimer >= step.seconds) {
        missions.step += 1;
        say(missions, 'Lena Cruz', "You're clear. Now the safehouse — don't stop.");
      }
    } else {
      missions.escapeTimer = Math.max(0, missions.escapeTimer - dt * 2);
    }
    return null;
  }
  return null;
}
