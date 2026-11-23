// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. Screens: title, play, paused, story done.
//
// ?seed=N fixes the city. ?shot=cover|foot|chase|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createGame, stepGame, resetGame } from './game.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_PUNCH, ACTION_MISSION, ACTION_BUY, ACTION_MUTE, createInput } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_COMPLETE } from './render.js';
import { drawHud, drawTitle, drawPaused, drawStoryComplete } from './hud.js';
import { stageShot } from './shots.js';
import { createAudio, unlockAudio, setEngine, setSiren, playGunshot, playPunch, playPickup, playCrash, playExplosion, playMissionComplete, playClick, playBusted, setMuted } from './audio.js';
import { loadSave, readBest, writeBest } from './save.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const saved = loadSave();
const game = createGame(seed, saved);
game.hasSave = !!saved;
const renderer = createRenderer(canvas);
const audio = createAudio();

let screen = SCREEN_TITLE;
let completeShown = false;
let best = readBest();
let titleButtons = [];

function announce(message) {
  status.textContent = message;
}

function startGame() {
  unlockAudio(audio);
  playClick(audio);
  screen = SCREEN_PLAY;
  announce('Playing. WASD to move, E to steal a car, N for the next job.');
}

function restartDay() {
  resetGame(game);
  game.hasSave = false;
  completeShown = false;
  screen = SCREEN_PLAY;
  announce('A new day in Solmar Bay.');
}

/** Screen-space mouse to world coordinates, through the camera. */
function mouseToWorld() {
  const m = input.mouse();
  const cam = renderer.camera;
  return {
    x: (m.x - renderer.view.w / 2) / cam.zoom + cam.x,
    y: (m.y - renderer.view.h / 2) / cam.zoom + cam.y,
  };
}

const input = createInput(canvas);

function buildInput() {
  const held = input.held;
  return {
    move: {
      x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
      y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
      sprint: held.sprint,
    },
    aim: mouseToWorld(),
    shoot: input.mouseDown(),
    punch: false,
    enter: false,
    mission: false,
    buy: false,
    handbrake: held.handbrake,
  };
}

function playSounds() {
  for (const event of game.events) {
    if (event === 'gunshot') playGunshot(audio);
    else if (event === 'punch') playPunch(audio);
    else if (event === 'pickup') playPickup(audio);
    else if (event === 'crash') playCrash(audio, false);
    else if (event === 'explosion') playExplosion(audio);
    else if (event === 'mission-complete') playMissionComplete(audio);
    else if (event === 'mission-start') playClick(audio);
    else if (event === 'busted' || event === 'wasted') playBusted(audio);
  }
  const car = game.player.car;
  setEngine(audio, car ? Math.min(1, Math.hypot(car.vx, car.vy) / 560) : 0, !!car);
  setSiren(audio, game.police.stars > 0, game.time);
}

function handleActions(actions) {
  if (actions & ACTION_MUTE) {
    setMuted(audio, !audio.muted);
    announce(audio.muted ? 'Muted.' : 'Sound on.');
  }
  if (screen === SCREEN_TITLE) {
    if (actions & ACTION_CONFIRM) startGame();
    return;
  }
  if (screen === SCREEN_COMPLETE) {
    if (actions & ACTION_CONFIRM) {
      screen = SCREEN_PLAY;
      announce('Free roam. The city is yours.');
    }
    return;
  }
  if (actions & ACTION_PAUSE) {
    if (screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }
}

function step(dt, actions) {
  const frameInput = buildInput();
  frameInput.punch = !!(actions & ACTION_PUNCH);
  frameInput.enter = !!(actions & ACTION_ENTER);
  frameInput.mission = !!(actions & ACTION_MISSION);
  frameInput.buy = !!(actions & ACTION_BUY);
  stepGame(game, frameInput, dt);
  playSounds();
  if (game.missions.finished && !completeShown) {
    completeShown = true;
    screen = SCREEN_COMPLETE;
    writeBest(Math.max(best, Math.floor(game.player.money)));
  }
  if (Math.floor(game.player.money) > best) {
    best = Math.floor(game.player.money);
    writeBest(best);
  }
}

function runShot(name) {
  const staged = stageShot(name, game);
  // Snap the camera onto the player so the first paint is already framed.
  const px = game.player.car ? game.player.car.x : game.player.x;
  const py = game.player.car ? game.player.car.y : game.player.y;
  renderer.camera.x = px;
  renderer.camera.y = py;
  renderer.camera.zoom = game.player.car ? 0.8 : 1.0;
  let painted = 0;
  function paint() {
    renderer.draw(game);
    drawHud(renderer.ctx, renderer.view, game);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  void staged;
  requestAnimationFrame(paint);
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    // Title clicks.
    if (screen === SCREEN_TITLE && input.takeClick()) {
      const m = input.mouse();
      for (const b of titleButtons) {
        if (m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h) {
          if (b.id === 'start') startGame();
          else if (b.id === 'how') game.showHelp = !game.showHelp;
        }
      }
    }
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        step(STEP, actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(game);
    if (screen === SCREEN_TITLE) {
      titleButtons = drawTitle(renderer.ctx, renderer.view, game);
    } else if (screen === SCREEN_PAUSED) {
      drawHud(renderer.ctx, renderer.view, game);
      drawPaused(renderer.ctx, renderer.view);
    } else if (screen === SCREEN_COMPLETE) {
      drawHud(renderer.ctx, renderer.view, game);
      drawStoryComplete(renderer.ctx, renderer.view, game);
    } else {
      drawHud(renderer.ctx, renderer.view, game);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar Bay. Press Enter or click Start to play.');
  requestAnimationFrame(frame);
}

// Debug hook for play-testing: the whole game state, read-only-ish.
window.__game = game;
window.__screen = () => screen;
window.__restartDay = restartDay;

if (shot) runShot(shot);
else runGame();
