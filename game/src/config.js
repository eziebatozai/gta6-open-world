// Solmar Bay — tuning and shared constants. One place for every number the
// systems share, so a tweak here retunes the whole game.
export const STEP = 1 / 60;

export const WORLD = {
  width: 3600,
  height: 2600,
  roadWidth: 92,
  sidewalk: 18,
};

// Road centre lines. The city is a grid; every road is axis-aligned.
export const ROADS_X = [200, 700, 1200, 1700, 2200, 2700, 3200];
export const ROADS_Y = [200, 700, 1200, 1700, 2200];

export const DISTRICTS = {
  downtown: { x0: 1000, y0: 500, x1: 2400, y1: 1900, name: 'Downtown' },
  oldTown: { x0: 0, y0: 0, x1: 1000, y1: 2600, name: 'Old Town' },
  harbour: { x0: 2900, y0: 0, x1: 3600, y1: 2600, name: 'Harbour' },
  suburbs: { x0: 1000, y0: 1900, x1: 2900, y1: 2600, name: 'Palms' },
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 175,
  sprintSpeed: 265,
  health: 100,
  punchDamage: 18,
  punchRange: 34,
  punchCooldown: 0.38,
};

export const PISTOL = {
  damage: 34,
  bulletSpeed: 760,
  cooldown: 0.22,
  range: 520,
  startAmmo: 24,
  maxAmmo: 120,
};

export const CAR = {
  // Physics are arcade: strong accel, grippy steering, a drift when the
  // handbrake is held or the wheel is cranked at speed.
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  steerRate: 2.6,
  grip: 6.5,
  driftGrip: 2.2,
  radius: 17,
  health: 100,
};

export const WANTED = {
  maxStars: 5,
  // Seconds with no cop in sight before a star fades (only below 3 stars).
  decaySeconds: 7,
  // Radius inside which a crime is seen by a cop.
  seenRadius: 520,
};

export const POLICE = {
  carSpeed: 590,
  footSpeed: 185,
  // Seconds a foot cop must stay touching the player to bust them.
  bustSeconds: 1.4,
  ramDamage: 9,
};

export const TRAFFIC = {
  carCount: 26,
  pedCount: 42,
  parkedCount: 22,
  carSpeed: 150,
  pedSpeed: 55,
};

export const MONEY = {
  start: 120,
  bustLoss: 0.2,
  wastedLoss: 0.2,
  pickup: 25,
};

export const SAVE_KEY = 'solmar-bay-save-v1';
export const BEST_KEY = 'solmar-bay-best-v1';
